import type { ClientSession, Types } from 'mongoose';
import {
  BookingModel,
  ChallengeModel,
  ChallengeStatus,
  MatchFormat,
  MatchModel,
  MatchStatus,
  TeamModel,
  TransactionType,
  WalletBucket,
  UserModel,
  type IChallenge,
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
import { publicId } from '../../shared/utils/ids.js';
import { commissionPaise, prizePoolPaise } from '../../shared/utils/money.js';
import { debitWallet, refundEscrow } from '../wallet/wallet.service.js';
import { newMatchPublicId } from '../matches/match.service.js';

/**
 * Challenges and escrow (edge_cases.md §4).
 *
 * Money enters escrow at CREATE (creator) and ACCEPT (opponent). Both debits
 * for the accept path happen in one transaction — if the opponent's debit
 * fails, the whole accept rolls back rather than leaving half a contract.
 */

const TEAM_SIZE: Record<MatchFormat, number> = {
  [MatchFormat.SINGLES]: 1,
  [MatchFormat.DOUBLES]: 2,
  [MatchFormat.TEAM]: 1, // cricket/football validate a minimum, not an exact count
};

export async function createChallenge(input: {
  user: IUser;
  bookingId: string;
  teamId: string;
  entryFeePaise: number;
  notes?: string;
}): Promise<IChallenge> {
  assertEntryFeeAllowed(input.entryFeePaise);

  return withTransaction(async (session) => {
    const booking = await BookingModel.findById(input.bookingId).session(session);
    if (!booking) throw new NotFoundError('Booking');

    if (String(booking.bookerId) !== String(input.user._id)) {
      throw new ForbiddenError('You can only post a challenge on your own booking');
    }

    const existing = await ChallengeModel.findOne({ bookingId: booking._id }).session(session);
    if (existing) throw new ConflictError('CONFLICT', 'This booking already has a challenge');

    const team = await TeamModel.findById(input.teamId).session(session);
    if (!team) throw new NotFoundError('Team');
    assertCaptain(team.captainId, input.user);
    assertTeamSize(team.members.filter((m) => m.isActive).length, team.format);

    const commission = commissionPaise(
      input.entryFeePaise * 2,
      env.PLATFORM_COMMISSION_PERCENT,
    );

    /**
     * The challenge must be accepted before the slot starts, with a buffer —
     * matching seconds before tip-off helps nobody (§46).
     */
    const matchExpiresAt = new Date(
      booking.startAt.getTime() - env.CHALLENGE_MATCH_WINDOW_MINUTES * 60_000,
    );
    if (matchExpiresAt <= new Date()) {
      throw new BadRequestError('This slot starts too soon to post a challenge');
    }

    const challengePublicId = publicId('chl');

    if (input.entryFeePaise > 0) {
      await debitWallet(
        {
          user: input.user,
          amountPaise: input.entryFeePaise,
          type: TransactionType.ESCROW_HOLD,
          description: `Entry fee held for challenge ${challengePublicId}`,
          idempotencyKey: `escrow:${challengePublicId}:creator`,
        },
        session,
      );
    }

    const [challenge] = await ChallengeModel.create(
      [
        {
          publicId: challengePublicId,
          sport: booking.sport,
          format: team.format,
          creatorTeamId: team._id,
          creatorUserId: input.user._id,
          bookingId: booking._id,
          arenaId: booking.arenaId,
          startAt: booking.startAt,
          entryFeePaise: input.entryFeePaise,
          prizePoolPaise: prizePoolPaise(input.entryFeePaise, env.PLATFORM_COMMISSION_PERCENT),
          commissionPaise: commission,
          status: ChallengeStatus.OPEN,
          matchExpiresAt,
          ...(input.notes === undefined ? {} : { notes: input.notes }),
        },
      ],
      { session },
    );

    if (!challenge) throw new Error('Challenge creation returned nothing');

    /** Escrow is locked money — surface it separately from spendable balance. */
    if (input.entryFeePaise > 0) {
      await UserModel.updateOne(
        { _id: input.user._id },
        { $inc: { 'wallet.lockedPaise': input.entryFeePaise } },
        { session },
      );
    }

    return challenge;
  });
}

function assertEntryFeeAllowed(entryFeePaise: number): void {
  if (entryFeePaise === 0) return;

  /**
   * Master kill-switch. Paid play stays off until legal sign-off, and this is
   * checked server-side so a modified client cannot bypass it (compliance.md).
   */
  if (!env.ENABLE_PAID_CHALLENGES) {
    throw new ForbiddenError('Paid challenges are not available yet', 'GEO_RESTRICTED');
  }
  if (entryFeePaise < env.MIN_ENTRY_FEE_PAISE || entryFeePaise > env.MAX_ENTRY_FEE_PAISE) {
    throw new BadRequestError('That entry fee is outside the allowed range');
  }
}

function assertCaptain(captainId: Types.ObjectId, user: IUser): void {
  if (String(captainId) !== String(user._id)) {
    throw new ForbiddenError('Only the captain can do this');
  }
}

function assertTeamSize(activeMembers: number, format: MatchFormat): void {
  const required = TEAM_SIZE[format];
  if (format === MatchFormat.TEAM) {
    if (activeMembers < 1) throw new BadRequestError('Your team has no active members');
    return;
  }
  if (activeMembers !== required) {
    throw new BadRequestError(
      `${format} needs exactly ${String(required)} active player(s) in the team`,
    );
  }
}

/**
 * Accepting is an ATOMIC state transition. Two users tapping accept at the
 * same instant: the conditional filter on status means exactly one wins and
 * the other gets a clean 409 (§47).
 */
export async function acceptChallenge(input: {
  user: IUser;
  challengePublicId: string;
  teamId: string;
}): Promise<{ challenge: IChallenge; matchPublicId: string }> {
  return withTransaction(async (session) => {
    const challenge = await ChallengeModel.findOne({
      publicId: input.challengePublicId,
    }).session(session);
    if (!challenge) throw new NotFoundError('Challenge');

    /** You cannot play yourself — the classic money-laundering vector (§45). */
    if (String(challenge.creatorUserId) === String(input.user._id)) {
      throw new BadRequestError('You cannot accept your own challenge');
    }

    const team = await TeamModel.findById(input.teamId).session(session);
    if (!team) throw new NotFoundError('Team');
    assertCaptain(team.captainId, input.user);
    assertTeamSize(team.members.filter((m) => m.isActive).length, team.format);

    if (String(team._id) === String(challenge.creatorTeamId)) {
      throw new BadRequestError('That team is already on the other side of this challenge');
    }

    await assertNoSharedPlayers(challenge.creatorTeamId, team._id as Types.ObjectId, session);

    if (challenge.matchExpiresAt < new Date()) {
      throw new ConflictError('CHALLENGE_ALREADY_MATCHED', 'This challenge has expired');
    }

    const claimed = await ChallengeModel.findOneAndUpdate(
      { _id: challenge._id, status: ChallengeStatus.OPEN },
      {
        $set: {
          status: ChallengeStatus.MATCHED,
          opponentTeamId: team._id,
          opponentUserId: input.user._id,
          matchedAt: new Date(),
        },
      },
      { returnDocument: 'after', session },
    );

    if (!claimed) {
      throw new ConflictError(
        'CHALLENGE_ALREADY_MATCHED',
        'Someone else just accepted this challenge',
      );
    }

    if (claimed.entryFeePaise > 0) {
      await debitWallet(
        {
          user: input.user,
          amountPaise: claimed.entryFeePaise,
          type: TransactionType.ESCROW_HOLD,
          description: `Entry fee held for challenge ${claimed.publicId}`,
          idempotencyKey: `escrow:${claimed.publicId}:opponent`,
          referenceType: 'Challenge',
          referenceId: claimed._id as Types.ObjectId,
        },
        session,
      );
      await UserModel.updateOne(
        { _id: input.user._id },
        { $inc: { 'wallet.lockedPaise': claimed.entryFeePaise } },
        { session },
      );
    }

    const matchPublicId = newMatchPublicId();

    /**
     * The lineup is FROZEN here. Roster changes afterwards must not affect a
     * match already in flight (§50).
     */
    const creatorTeam = await TeamModel.findById(claimed.creatorTeamId).session(session);
    if (!creatorTeam) throw new NotFoundError('Creator team');

    await MatchModel.create(
      [
        {
          publicId: matchPublicId,
          challengeId: claimed._id,
          sport: claimed.sport,
          format: claimed.format,
          arenaId: claimed.arenaId,
          creatorTeamId: claimed.creatorTeamId,
          opponentTeamId: team._id,
          lineup: [
            {
              teamId: creatorTeam._id,
              userIds: creatorTeam.members.filter((m) => m.isActive).map((m) => m.userId),
            },
            {
              teamId: team._id,
              userIds: team.members.filter((m) => m.isActive).map((m) => m.userId),
            },
          ],
          scheduledAt: claimed.startAt,
          status: MatchStatus.SCHEDULED,
        },
      ],
      { session },
    );

    return { challenge: claimed, matchPublicId };
  });
}

/** Alt accounts on both sides is collusion, not a coincidence (§45). */
async function assertNoSharedPlayers(
  teamAId: Types.ObjectId,
  teamBId: Types.ObjectId,
  session: ClientSession,
): Promise<void> {
  const teams = await TeamModel.find({ _id: { $in: [teamAId, teamBId] } }).session(session);
  const [a, b] = teams;
  if (!a || !b) return;

  const aIds = new Set(a.members.filter((m) => m.isActive).map((m) => String(m.userId)));
  const overlap = b.members
    .filter((m) => m.isActive)
    .some((m) => aIds.has(String(m.userId)));

  if (overlap) {
    throw new BadRequestError('A player cannot appear on both sides of a match');
  }
}

/**
 * Unmatched challenges expire and refund in full. Holding a creator's money
 * because nobody accepted would be indefensible (§46).
 */
export async function expireUnmatchedChallenges(now: Date = new Date()): Promise<number> {
  const expired = await ChallengeModel.find({
    status: ChallengeStatus.OPEN,
    matchExpiresAt: { $lt: now },
  })
    .select('_id')
    .lean();

  let count = 0;

  for (const item of expired) {
    await withTransaction(async (session) => {
      const challenge = await ChallengeModel.findOneAndUpdate(
        { _id: item._id, status: ChallengeStatus.OPEN },
        { $set: { status: ChallengeStatus.EXPIRED, cancelledAt: new Date() } },
        { returnDocument: 'after', session },
      );
      if (!challenge) return;

      if (challenge.entryFeePaise > 0) {
        const refunded = await refundEscrow(
          {
            userId: challenge.creatorUserId,
            challengeId: challenge._id as Types.ObjectId,
            holdIdempotencyKey: `escrow:${challenge.publicId}:creator`,
            description: 'No opponent found — entry fee refunded',
          },
          session,
        );
        await UserModel.updateOne(
          { _id: challenge.creatorUserId },
          { $inc: { 'wallet.lockedPaise': -refunded } },
          { session },
        );
      }
      count += 1;
    });
  }

  return count;
}

export const ESCROW_BUCKET_ORDER = [
  WalletBucket.BONUS,
  WalletBucket.DEPOSIT,
  WalletBucket.WINNINGS,
] as const;
