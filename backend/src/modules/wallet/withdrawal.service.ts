import type { Types } from 'mongoose';
import {
  KycStatus,
  TransactionType,
  UserModel,
  WalletBucket,
  WithdrawalRequestModel,
  type IUser,
  type IWithdrawalRequest,
} from '../../models/index.js';
import { withTransaction } from '../../shared/config/db.js';
import { env } from '../../shared/config/env.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/app-error.js';
import { publicId } from '../../shared/utils/ids.js';
import { applyLedgerEntry } from './wallet.service.js';

/**
 * Withdrawals — money leaving the platform.
 *
 * Three rules the whole file exists to enforce:
 *
 * 1. **Winnings only.** Deposits are refunded through the payment gateway they
 *    arrived on, never paid out as cash, and bonus credit is playable but
 *    never withdrawable. Allowing either would turn the wallet into a
 *    money-transfer service (compliance.md).
 * 2. **KYC first.** No verified identity, no payout.
 * 3. **Debited on request, not on approval.** The balance leaves the wallet
 *    the moment a request is made, so a player cannot request twice against
 *    the same rupees while ops works the queue.
 */

/** s.194BA — 30% TDS on net winnings withdrawn. */
const TDS_PERCENT = 30;

/** Matches the model's floor. */
const MIN_WITHDRAWAL_PAISE = 10_000;

export function computeTds(amountPaise: number): { tdsPaise: number; netPayablePaise: number } {
  const tdsPaise = Math.floor((amountPaise * TDS_PERCENT) / 100);
  return { tdsPaise, netPayablePaise: amountPaise - tdsPaise };
}

function assertWithdrawable(user: IUser, amountPaise: number): void {
  if (!Number.isInteger(amountPaise) || amountPaise < MIN_WITHDRAWAL_PAISE) {
    throw new BadRequestError(
      `Minimum withdrawal is ₹${String(MIN_WITHDRAWAL_PAISE / 100)}`,
    );
  }

  if (user.kyc.status !== KycStatus.VERIFIED) {
    throw new ForbiddenError('Verify your identity before withdrawing');
  }

  if (!user.bankAccount?.ifsc && !user.bankAccount?.vpa) {
    throw new BadRequestError('Add a bank account or UPI id before withdrawing');
  }

  /**
   * Only the winnings bucket. Checked against the bucket itself rather than
   * spendable balance, which includes deposit and bonus.
   */
  if (user.wallet.winningsPaise < amountPaise) {
    throw new BadRequestError(
      'You can only withdraw winnings. Deposits and bonus credit are not withdrawable.',
    );
  }
}

export async function requestWithdrawal(input: {
  user: IUser;
  amountPaise: number;
  /** Falls back to whichever destination the user has on file. */
  prefer?: 'bank' | 'upi';
}): Promise<IWithdrawalRequest> {
  return withTransaction(async (session) => {
    const user = await UserModel.findById(input.user._id).session(session);
    if (!user) throw new NotFoundError('User');

    assertWithdrawable(user, input.amountPaise);

    const pending = await WithdrawalRequestModel.findOne({
      userId: user._id,
      status: { $in: ['pending', 'approved', 'processing'] },
    }).session(session);
    if (pending) {
      throw new ConflictError('CONFLICT', 'You already have a withdrawal in progress');
    }

    const { tdsPaise, netPayablePaise } = computeTds(input.amountPaise);
    const requestPublicId = publicId('wd');

    /**
     * Debit now. The money is committed the moment the request exists — ops
     * approving later must not race a second request against the same balance.
     */
    await applyLedgerEntry(
      {
        userId: user._id as Types.ObjectId,
        bucket: WalletBucket.WINNINGS,
        amountPaise: -input.amountPaise,
        type: TransactionType.WITHDRAWAL,
        description: `Withdrawal ${requestPublicId}`,
        idempotencyKey: `withdrawal:${requestPublicId}`,
      },
      session,
    );

    const useUpi =
      input.prefer === 'upi' || (!user.bankAccount?.ifsc && Boolean(user.bankAccount?.vpa));

    /** Only the fields the chosen destination actually has — exactOptionalPropertyTypes. */
    const destination = useUpi
      ? { type: 'upi' as const, ...(user.bankAccount?.vpa ? { vpa: user.bankAccount.vpa } : {}) }
      : {
        type: 'bank' as const,
        ...(user.bankAccount?.ifsc ? { ifsc: user.bankAccount.ifsc } : {}),
        ...(user.bankAccount?.accountNumberLast4
          ? { accountLast4: user.bankAccount.accountNumberLast4 }
          : {}),
      };

    const request = await WithdrawalRequestModel.create(
      [
        {
          publicId: requestPublicId,
          userId: user._id,
          amountPaise: input.amountPaise,
          tdsPaise,
          netPayablePaise,
          status: 'pending' as const,
          destination,
          requestedAt: new Date(),
        },
      ],
      { session },
    );

    const created = request[0];
    if (!created) throw new Error('Withdrawal creation returned nothing');
    return created;
  });
}

export async function listMyWithdrawals(user: IUser) {
  return WithdrawalRequestModel.find({ userId: user._id })
    .sort({ requestedAt: -1 })
    .limit(50)
    .lean();
}

// ---------------------------------------------------------------------------
// Ops queue
// ---------------------------------------------------------------------------

export type WithdrawalStatus = IWithdrawalRequest['status'];

export async function listWithdrawalQueue(status: WithdrawalStatus = 'pending') {
  return WithdrawalRequestModel.find({ status })
    .populate('userId', 'fullName phoneNumber publicId')
    .sort({ requestedAt: 1 })
    .limit(100)
    .lean();
}

/**
 * Ops decision.
 *
 * Rejecting REFUNDS the winnings, because they were debited at request time.
 * Approving does not move money again — it only marks the request payable;
 * the actual transfer is the payout provider's job and is recorded when it
 * settles.
 */
export async function reviewWithdrawal(input: {
  admin: IUser;
  withdrawalPublicId: string;
  decision: 'approve' | 'reject';
  reason?: string;
}): Promise<IWithdrawalRequest> {
  return withTransaction(async (session) => {
    const request = await WithdrawalRequestModel.findOne({
      publicId: input.withdrawalPublicId,
    }).session(session);
    if (!request) throw new NotFoundError('Withdrawal request');

    if (request.status !== 'pending') {
      throw new ConflictError('CONFLICT', `This request is already ${request.status}`);
    }

    if (input.decision === 'reject') {
      if (!input.reason?.trim()) {
        throw new BadRequestError('A rejection needs a reason the player can read');
      }

      await applyLedgerEntry(
        {
          userId: request.userId as Types.ObjectId,
          bucket: WalletBucket.WINNINGS,
          amountPaise: request.amountPaise,
          type: TransactionType.WITHDRAWAL_REVERSAL,
          description: `Withdrawal ${request.publicId} rejected`,
          idempotencyKey: `withdrawal-reversal:${request.publicId}`,
        },
        session,
      );

      request.status = 'rejected';
      request.rejectionReason = input.reason.trim();
    } else {
      request.status = 'approved';
    }

    request.reviewedByAdminId = input.admin._id as Types.ObjectId;
    request.processedAt = new Date();
    await request.save({ session });

    return request;
  });
}

export { MIN_WITHDRAWAL_PAISE, TDS_PERCENT };
export const withdrawalsEnabled = (): boolean => env.ENABLE_WITHDRAWALS;
