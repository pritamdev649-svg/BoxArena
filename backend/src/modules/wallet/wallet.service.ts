import type { ClientSession, Types } from 'mongoose';
import {
  TransactionModel,
  TransactionType,
  UserModel,
  WalletBucket,
  type IUser,
} from '../../models/index.js';
import { InsufficientBalanceError } from '../../shared/errors/app-error.js';
import { assertPaise, splitDebit, spendablePaise } from '../../shared/utils/money.js';
import { publicId } from '../../shared/utils/ids.js';

/**
 * The financial core.
 *
 * INVARIANT I1: sum(Transaction.amountPaise per bucket) == User.wallet.<bucket>
 * The ledger is the source of truth; the wallet fields are a cache. Every
 * balance change writes a Transaction row IN THE SAME SESSION, stamped with
 * balanceAfterPaise so the ledger can be replayed and audited.
 *
 * Nothing in this file may be called outside a transaction when more than one
 * document changes.
 */

const BUCKET_FIELD: Record<WalletBucket, 'depositPaise' | 'winningsPaise' | 'bonusPaise'> = {
  [WalletBucket.DEPOSIT]: 'depositPaise',
  [WalletBucket.WINNINGS]: 'winningsPaise',
  [WalletBucket.BONUS]: 'bonusPaise',
};

export interface LedgerEntry {
  userId: Types.ObjectId;
  bucket: WalletBucket;
  /** Signed: positive credits the user, negative debits. */
  amountPaise: number;
  type: TransactionType;
  description: string;
  idempotencyKey: string;
  referenceType?: 'Booking' | 'Challenge' | 'Match' | 'PaymentOrder' | 'WithdrawalRequest';
  referenceId?: Types.ObjectId;
  performedByUserId?: Types.ObjectId;
}

/**
 * Applies one signed movement to one bucket and writes its ledger row.
 *
 * The balance update is a CONDITIONAL update, not read-then-write: for a
 * debit we require the bucket to still hold enough. Two concurrent debits with
 * just enough for one therefore cannot both succeed (edge_cases.md §39), and a
 * balance can never go negative (§38).
 */
export async function applyLedgerEntry(
  entry: LedgerEntry,
  session: ClientSession,
): Promise<{ balanceAfterPaise: number }> {
  assertPaise(entry.amountPaise, 'amountPaise');
  if (entry.amountPaise === 0) throw new Error('Refusing to write a zero-value ledger row');

  const field = BUCKET_FIELD[entry.bucket];
  const path = `wallet.${field}`;

  const filter: Record<string, unknown> = { _id: entry.userId };
  if (entry.amountPaise < 0) {
    filter[path] = { $gte: Math.abs(entry.amountPaise) };
  }

  const updated = await UserModel.findOneAndUpdate(
    filter,
    { $inc: { [path]: entry.amountPaise } },
    { returnDocument: 'after', session },
  );

  if (!updated) {
    /** Only reachable on a debit whose guard failed — i.e. a lost race. */
    throw new InsufficientBalanceError(Math.abs(entry.amountPaise));
  }

  const balanceAfterPaise = updated.wallet[field];

  await TransactionModel.create(
    [
      {
        publicId: publicId('txn'),
        userId: entry.userId,
        type: entry.type,
        amountPaise: entry.amountPaise,
        bucket: entry.bucket,
        balanceAfterPaise,
        description: entry.description,
        idempotencyKey: entry.idempotencyKey,
        ...(entry.referenceType === undefined ? {} : { referenceType: entry.referenceType }),
        ...(entry.referenceId === undefined ? {} : { referenceId: entry.referenceId }),
        ...(entry.performedByUserId === undefined
          ? {}
          : { performedByUserId: entry.performedByUserId }),
      },
    ],
    { session },
  );

  return { balanceAfterPaise };
}

export interface DebitRequest {
  user: IUser;
  amountPaise: number;
  type: TransactionType;
  description: string;
  /** Base key; each bucket touched gets a distinct suffix. */
  idempotencyKey: string;
  referenceType?: LedgerEntry['referenceType'];
  referenceId?: Types.ObjectId;
}

/**
 * Debits across buckets in the order bonus -> deposit -> winnings
 * (edge_cases.md §28). Maximises what stays withdrawable for the user.
 *
 * A single charge may span buckets, producing SEVERAL ledger rows — one per
 * bucket touched. That is deliberate: the ledger must show which kind of money
 * was actually spent, because only winnings are withdrawable.
 */
export async function debitWallet(
  request: DebitRequest,
  session: ClientSession,
): Promise<{ splits: { bucket: WalletBucket; amountPaise: number }[] }> {
  assertPaise(request.amountPaise, 'amountPaise');
  if (request.amountPaise <= 0) throw new Error('Debit amount must be positive');

  const wallet = request.user.wallet;
  const split = splitDebit(wallet, request.amountPaise);

  if (split.shortfallPaise > 0) {
    throw new InsufficientBalanceError(split.shortfallPaise);
  }

  const movements: { bucket: WalletBucket; amountPaise: number }[] = [
    { bucket: WalletBucket.BONUS, amountPaise: split.bonusPaise },
    { bucket: WalletBucket.DEPOSIT, amountPaise: split.depositPaise },
    { bucket: WalletBucket.WINNINGS, amountPaise: split.winningsPaise },
  ].filter((m) => m.amountPaise > 0);

  for (const movement of movements) {
    await applyLedgerEntry(
      {
        userId: request.user._id as Types.ObjectId,
        bucket: movement.bucket,
        amountPaise: -movement.amountPaise,
        type: request.type,
        description: request.description,
        idempotencyKey: `${request.idempotencyKey}:${movement.bucket}`,
        ...(request.referenceType === undefined ? {} : { referenceType: request.referenceType }),
        ...(request.referenceId === undefined ? {} : { referenceId: request.referenceId }),
      },
      session,
    );
  }

  return { splits: movements };
}

/** Winnings credit — the payout path. Always its own bucket. */
export async function creditWinnings(
  input: {
    userId: Types.ObjectId;
    amountPaise: number;
    description: string;
    idempotencyKey: string;
    referenceType?: LedgerEntry['referenceType'];
    referenceId?: Types.ObjectId;
  },
  session: ClientSession,
): Promise<void> {
  await applyLedgerEntry(
    {
      userId: input.userId,
      bucket: WalletBucket.WINNINGS,
      amountPaise: input.amountPaise,
      type: TransactionType.PRIZE_PAYOUT,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      ...(input.referenceType === undefined ? {} : { referenceType: input.referenceType }),
      ...(input.referenceId === undefined ? {} : { referenceId: input.referenceId }),
    },
    session,
  );
}

/**
 * Refunds an escrow back to the buckets it came from, so a user who paid with
 * bonus money does not get withdrawable winnings back. Reads the original
 * ledger rows rather than guessing.
 */
export async function refundEscrow(
  input: {
    userId: Types.ObjectId;
    challengeId: Types.ObjectId;
    holdIdempotencyKey: string;
    description: string;
  },
  session: ClientSession,
): Promise<number> {
  const holds = await TransactionModel.find({
    userId: input.userId,
    type: TransactionType.ESCROW_HOLD,
    referenceId: input.challengeId,
  }).session(session);

  let total = 0;
  for (const hold of holds) {
    const amount = Math.abs(hold.amountPaise);
    total += amount;
    await applyLedgerEntry(
      {
        userId: input.userId,
        bucket: hold.bucket,
        amountPaise: amount,
        type: TransactionType.ESCROW_REFUND,
        description: input.description,
        idempotencyKey: `${input.holdIdempotencyKey}:refund:${hold.bucket}`,
        referenceType: 'Challenge',
        referenceId: input.challengeId,
      },
      session,
    );
  }
  return total;
}

export function assertSufficientBalance(user: IUser, amountPaise: number): void {
  const available = spendablePaise(user.wallet);
  if (available < amountPaise) {
    throw new InsufficientBalanceError(amountPaise - available);
  }
}

/**
 * Recomputes balances from the ledger. Invariant I1.
 * The nightly job compares this to the cached wallet and FREEZES the account
 * on drift — never auto-corrects, because a mismatch means a bug we must see.
 */
export async function reconcileUser(userId: Types.ObjectId): Promise<{
  ledger: Record<WalletBucket, number>;
  cached: Record<WalletBucket, number>;
  drift: Record<WalletBucket, number>;
  isConsistent: boolean;
}> {
  const rows = await TransactionModel.aggregate<{ _id: WalletBucket; total: number }>([
    { $match: { userId } },
    { $group: { _id: '$bucket', total: { $sum: '$amountPaise' } } },
  ]);

  const user = await UserModel.findById(userId).lean();
  if (!user) throw new Error(`User ${String(userId)} not found`);

  const ledger = {
    [WalletBucket.DEPOSIT]: 0,
    [WalletBucket.WINNINGS]: 0,
    [WalletBucket.BONUS]: 0,
  };
  for (const row of rows) ledger[row._id] = row.total;

  const cached = {
    [WalletBucket.DEPOSIT]: user.wallet.depositPaise,
    [WalletBucket.WINNINGS]: user.wallet.winningsPaise,
    [WalletBucket.BONUS]: user.wallet.bonusPaise,
  };

  const drift = {
    [WalletBucket.DEPOSIT]: cached.deposit - ledger.deposit,
    [WalletBucket.WINNINGS]: cached.winnings - ledger.winnings,
    [WalletBucket.BONUS]: cached.bonus - ledger.bonus,
  };

  return {
    ledger,
    cached,
    drift,
    isConsistent: Object.values(drift).every((d) => d === 0),
  };
}
