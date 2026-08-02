import type { ClientSession, Types } from 'mongoose';
import {
  MatchModel,
  OfficialModel,
  TeamModel,
  TransactionType,
  UserModel,
  WalletBucket,
  type IMatch,
  type IUser,
} from '../../models/index.js';
import { withTransaction } from '../../shared/config/db.js';
import { env } from '../../shared/config/env.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/app-error.js';
import { applyLedgerEntry, debitWallet } from '../wallet/wallet.service.js';

/**
 * Paying the official (featuredoc/11 §OF4).
 *
 * The official's fee is a **cost of playing**, exactly like the venue fee. It
 * never enters the prize pool and is never refunded out of it — the money
 * model in the spec is explicit that only entry fees form the pool.
 *
 * Flow:
 *   both captains confirm the official  ->  each side is charged its share
 *   match reaches a settled result      ->  the official is paid, minus commission
 *   match is voided before it is played ->  both shares are refunded
 *
 * Charged UPFRONT rather than on completion because an official who turns up
 * and finds the teams cannot pay has already spent their evening.
 */

/** Default split. `feeSplit` on the match can override it later. */
const DEFAULT_CREATOR_SHARE_PERCENT = 50;

function shareFor(totalPaise: number, creatorSharePercent: number) {
  const creator = Math.floor((totalPaise * creatorSharePercent) / 100);
  /** The opponent carries the rounding remainder, so the two always sum. */
  return { creator, opponent: totalPaise - creator };
}

function holdKey(match: IMatch, side: 'creator' | 'opponent'): string {
  return `official-fee:${match.publicId}:${side}`;
}

async function captainOf(teamId: Types.ObjectId, session: ClientSession): Promise<IUser> {
  const team = await TeamModel.findById(teamId).select('captainId').session(session).lean();
  if (!team) throw new NotFoundError('Team');

  const captain = await UserModel.findById(team.captainId).session(session);
  if (!captain) throw new NotFoundError('Captain');
  return captain;
}

/**
 * Charges both sides their share of the official's fee.
 *
 * Idempotent on the ledger key, so a repeated confirmation cannot double
 * charge. Runs in ONE transaction: charging one captain and failing on the
 * other would leave a team paying for an official the match never had.
 */
export async function collectOfficialFee(input: {
  matchPublicId: string;
}): Promise<{ collectedPaise: number; alreadyCollected: boolean }> {
  return withTransaction(async (session) => {
    const match = await MatchModel.findOne({ publicId: input.matchPublicId }).session(session);
    if (!match) throw new NotFoundError('Match');

    if (!match.officialId) throw new BadRequestError('This match has no official');
    if (!match.officialConfirmedByCreator || !match.officialConfirmedByOpponent) {
      throw new ConflictError('CONFLICT', 'Both captains must confirm the official first');
    }
    if (match.officialFeeCollectedAt) {
      return { collectedPaise: match.officialFeePaise ?? 0, alreadyCollected: true };
    }

    const official = await OfficialModel.findById(match.officialId).session(session).lean();
    if (!official) throw new NotFoundError('Official');

    const totalPaise = official.pricePerMatchPaise;
    if (totalPaise <= 0) {
      /** A free official still needs marking, or the sweep retries forever. */
      match.officialFeePaise = 0;
      match.officialFeeCollectedAt = new Date();
      await match.save({ session });
      return { collectedPaise: 0, alreadyCollected: false };
    }

    const split = shareFor(totalPaise, match.officialFeeCreatorSharePercent ?? DEFAULT_CREATOR_SHARE_PERCENT);

    for (const side of ['creator', 'opponent'] as const) {
      const amountPaise = split[side];
      if (amountPaise <= 0) continue;

      const captain = await captainOf(
        side === 'creator' ? match.creatorTeamId : match.opponentTeamId,
        session,
      );

      await debitWallet(
        {
          user: captain,
          amountPaise,
          type: TransactionType.ESCROW_HOLD,
          description: `Official fee for match ${match.publicId}`,
          idempotencyKey: holdKey(match, side),
          referenceType: 'Match',
          referenceId: match._id as Types.ObjectId,
        },
        session,
      );
    }

    match.officialFeePaise = totalPaise;
    match.officialFeeCollectedAt = new Date();
    await match.save({ session });

    return { collectedPaise: totalPaise, alreadyCollected: false };
  });
}

/**
 * Pays the official once the match has a settled result.
 *
 * The platform's cut is taken here rather than at collection, so the amount
 * the official was quoted is the amount both teams were charged — a fee that
 * shrinks between quote and payout is the fastest way to lose officials.
 *
 * Credited to WINNINGS because it is earned income the official may withdraw,
 * unlike a bonus.
 */
export async function payOfficial(match: IMatch, session: ClientSession): Promise<number> {
  if (!match.officialId) return 0;
  if (!match.officialFeeCollectedAt) return 0;
  if (match.officialFeePaidAt) return 0;

  const totalPaise = match.officialFeePaise ?? 0;
  if (totalPaise <= 0) return 0;

  const official = await OfficialModel.findById(match.officialId).session(session).lean();
  if (!official) return 0;

  const commissionPaise = Math.floor(
    (totalPaise * env.OFFICIAL_COMMISSION_PERCENT) / 100,
  );
  const netPaise = totalPaise - commissionPaise;

  if (netPaise > 0) {
    await applyLedgerEntry(
      {
        userId: official.userId as Types.ObjectId,
        bucket: WalletBucket.WINNINGS,
        amountPaise: netPaise,
        type: TransactionType.PRIZE_PAYOUT,
        description: `Officiating fee for match ${match.publicId}`,
        idempotencyKey: `official-payout:${match.publicId}`,
        referenceType: 'Match',
        referenceId: match._id as Types.ObjectId,
      },
      session,
    );
  }

  if (commissionPaise > 0) {
    await applyLedgerEntry(
      {
        userId: official.userId as Types.ObjectId,
        bucket: WalletBucket.WINNINGS,
        amountPaise: -commissionPaise,
        type: TransactionType.PLATFORM_COMMISSION,
        description: `Platform commission on match ${match.publicId}`,
        idempotencyKey: `official-commission:${match.publicId}`,
        referenceType: 'Match',
        referenceId: match._id as Types.ObjectId,
      },
      session,
    );
  }

  match.officialFeePaidAt = new Date();
  return netPaise;
}

/**
 * Gives both sides their share back when the match never happened.
 *
 * Refunded to DEPOSIT rather than through `refundEscrow`, because the official
 * fee is a service charge, not stake money — returning it as winnings would
 * make a cancelled booking a withdrawal route.
 */
export async function refundOfficialFee(match: IMatch, session: ClientSession): Promise<number> {
  if (!match.officialFeeCollectedAt || match.officialFeePaidAt) return 0;
  if (match.officialFeeRefundedAt) return 0;

  const totalPaise = match.officialFeePaise ?? 0;
  if (totalPaise <= 0) return 0;

  const split = shareFor(
    totalPaise,
    match.officialFeeCreatorSharePercent ?? DEFAULT_CREATOR_SHARE_PERCENT,
  );

  for (const side of ['creator', 'opponent'] as const) {
    const amountPaise = split[side];
    if (amountPaise <= 0) continue;

    const captain = await captainOf(
      side === 'creator' ? match.creatorTeamId : match.opponentTeamId,
      session,
    );

    await applyLedgerEntry(
      {
        userId: captain._id as Types.ObjectId,
        bucket: WalletBucket.DEPOSIT,
        amountPaise,
        type: TransactionType.ESCROW_REFUND,
        description: `Official fee refunded for match ${match.publicId}`,
        idempotencyKey: `official-refund:${match.publicId}:${side}`,
        referenceType: 'Match',
        referenceId: match._id as Types.ObjectId,
      },
      session,
    );
  }

  match.officialFeeRefundedAt = new Date();
  return totalPaise;
}

/** What each side owes, for the pre-accept cost breakdown. */
export async function quoteOfficialFee(input: {
  user: IUser;
  matchPublicId: string;
}): Promise<{
  totalPaise: number;
  creatorSharePaise: number;
  opponentSharePaise: number;
  collected: boolean;
}> {
  const match = await MatchModel.findOne({ publicId: input.matchPublicId }).lean();
  if (!match) throw new NotFoundError('Match');
  if (!match.officialId) throw new BadRequestError('This match has no official');

  const official = await OfficialModel.findById(match.officialId).select('pricePerMatchPaise').lean();
  if (!official) throw new NotFoundError('Official');

  const totalPaise = official.pricePerMatchPaise;
  const split = shareFor(
    totalPaise,
    match.officialFeeCreatorSharePercent ?? DEFAULT_CREATOR_SHARE_PERCENT,
  );

  return {
    totalPaise,
    creatorSharePaise: split.creator,
    opponentSharePaise: split.opponent,
    collected: Boolean(match.officialFeeCollectedAt),
  };
}

/** Guards the fee routes — only a captain of either side may trigger them. */
export async function assertCaptain(match: IMatch, user: IUser): Promise<void> {
  const teams = await TeamModel.find({
    _id: { $in: [match.creatorTeamId, match.opponentTeamId] },
  })
    .select('captainId')
    .lean();

  if (!teams.some((team) => String(team.captainId) === String(user._id))) {
    throw new ForbiddenError('Only a team captain can do that');
  }
}
