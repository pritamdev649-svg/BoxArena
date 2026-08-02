import type { ClientSession, Types } from 'mongoose';
import {
  ChallengeModel,
  ChallengeStatus,
  DisputeModel,
  MatchModel,
  MatchStatus,
  TeamModel,
  TransactionType,
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
import { publicId } from '../../shared/utils/ids.js';
import { minutesFromNow } from '../../shared/utils/datetime.js';
import { creditWinnings, refundEscrow } from '../wallet/wallet.service.js';
import { computeElo, resultFromWinner } from './elo.service.js';
import { payOfficial, refundOfficialFee } from '../officials/official-fee.service.js';
import {
  normaliseToCreatorFrame,
  scoresAgree,
  validateScore,
  type ScorePayload,
  type Side,
} from './score-validator.js';

/**
 * Match settlement — the heart of the platform.
 *
 * The flow (edge_cases.md §5):
 *   first submission   -> PENDING_CONFIRMATION, deadline set, opponent notified
 *   second, agreeing   -> VERIFIED, payout + ELO, all in one transaction
 *   second, disagreeing-> DISPUTED, escrow held, admins notified
 *   deadline passes    -> auto-accept the single submission and settle
 */

export interface SubmitScoreInput {
  matchPublicId: string;
  user: IUser;
  score: ScorePayload;
}

export interface SubmitScoreResult {
  match: IMatch;
  outcome: 'awaiting_opponent' | 'verified' | 'disputed';
}

export async function submitScore(input: SubmitScoreInput): Promise<SubmitScoreResult> {
  return withTransaction(async (session) => {
    const match = await MatchModel.findOne({ publicId: input.matchPublicId }).session(session);
    if (!match) throw new NotFoundError('Match');

    const side = await resolveSide(match, input.user, session);

    assertSubmissionWindowOpen(match);

    /** Reject invalid scores at the boundary, before anything is stored. */
    const normalised = normaliseToCreatorFrame(input.score, side);
    const validation = validateScore(match.sport, normalised);

    const alreadySubmitted = match.submissions.some(
      (s) => String(s.byUserId) === String(input.user._id),
    );
    if (alreadySubmitted) {
      throw new ConflictError('CONFLICT', 'You have already submitted a score for this match');
    }

    match.submissions.push({
      byTeamId: side === 'creator' ? match.creatorTeamId : match.opponentTeamId,
      byUserId: input.user._id as Types.ObjectId,
      score: normalised,
      submittedAt: new Date(),
      ...(validation.winner === null
        ? {}
        : {
          claimedWinnerTeamId:
            validation.winner === 'creator' ? match.creatorTeamId : match.opponentTeamId,
        }),
    });

    /** First submission: start the clock and wait for the other side. */
    if (match.submissions.length === 1) {
      match.status = MatchStatus.PENDING_CONFIRMATION;
      match.confirmationDeadline = minutesFromNow(env.SCORE_CONFIRMATION_WINDOW_MINUTES);
      await match.save({ session });
      return { match, outcome: 'awaiting_opponent' as const };
    }

    const [first, second] = match.submissions;
    if (!first || !second) throw new Error('Expected two submissions');

    /**
     * Both payloads are already in the creator's frame, so 21-18 from one side
     * and 18-21 from the other are now identical. Comparing raw client payloads
     * here would make every honest match a dispute (§56).
     */
    if (scoresAgree(first.score, second.score)) {
      await settleVerified(match, normalised, validation.winner, validation.isDraw, session);
      return { match, outcome: 'verified' as const };
    }

    await raiseDispute(match, session, 'score_mismatch');
    return { match, outcome: 'disputed' as const };
  });
}

async function resolveSide(
  match: IMatch,
  user: IUser,
  session: ClientSession,
): Promise<Side> {
  const teams = await TeamModel.find({
    _id: { $in: [match.creatorTeamId, match.opponentTeamId] },
  }).session(session);

  const userId = String(user._id);

  for (const team of teams) {
    const isCaptain = String(team.captainId) === userId;
    const isMember = team.members.some((m) => String(m.userId) === userId && m.isActive);
    if (isCaptain || isMember) {
      return String(team._id) === String(match.creatorTeamId) ? 'creator' : 'opponent';
    }
  }

  /** Non-participants must never be able to write a score (§64). */
  throw new ForbiddenError('You are not a participant in this match');
}

function assertSubmissionWindowOpen(match: IMatch): void {
  if (match.scheduledAt > new Date()) {
    throw new BadRequestError('This match has not started yet');
  }

  const terminal: MatchStatus[] = [
    MatchStatus.VERIFIED,
    MatchStatus.ADMIN_RESOLVED,
    MatchStatus.VOIDED,
    MatchStatus.WALKOVER,
  ];
  if (terminal.includes(match.status)) {
    throw new ConflictError('CONFLICT', 'This match has already been settled');
  }

  if (match.confirmationDeadline && match.confirmationDeadline < new Date()) {
    throw new ConflictError(
      'CONFIRMATION_WINDOW_CLOSED',
      'The window to submit a score for this match has closed',
    );
  }
}

/**
 * Verified settlement: status, payout, commission and ELO in ONE transaction.
 * A payout without a status flip would double-pay on retry.
 */
export async function settleVerified(
  match: IMatch,
  finalScore: ScorePayload,
  winner: Side | null,
  isDraw: boolean,
  session: ClientSession,
): Promise<void> {
  /** Guard against a double payout even if called twice (§66). */
  if (match.payoutTransactionIds.length > 0) return;

  const challenge = await ChallengeModel.findById(match.challengeId).session(session);
  if (!challenge) throw new NotFoundError('Challenge');

  match.finalScore = finalScore;
  match.isDraw = isDraw;
  match.status = MatchStatus.VERIFIED;

  if (winner) {
    match.winnerTeamId = winner === 'creator' ? match.creatorTeamId : match.opponentTeamId;
  }

  await applyEloAndStats(match, winner, session);

  /**
   * The official is paid in the SAME transaction as the prize. A settled match
   * that pays the winner but not the umpire is a support ticket the venue
   * hears about before we do.
   */
  await payOfficial(match, session);

  if (challenge.entryFeePaise > 0) {
    if (isDraw) {
      /** A draw refunds both sides rather than splitting — friendlier at MVP (§60). */
      await refundEscrow(
        {
          userId: challenge.creatorUserId,
          challengeId: challenge._id as Types.ObjectId,
          holdIdempotencyKey: `escrow:${challenge.publicId}:creator`,
          description: 'Match drawn — entry fee refunded',
        },
        session,
      );
      if (challenge.opponentUserId) {
        await refundEscrow(
          {
            userId: challenge.opponentUserId,
            challengeId: challenge._id as Types.ObjectId,
            holdIdempotencyKey: `escrow:${challenge.publicId}:opponent`,
            description: 'Match drawn — entry fee refunded',
          },
          session,
        );
      }
    } else if (winner) {
      const winnerUserId =
        winner === 'creator' ? challenge.creatorUserId : challenge.opponentUserId;
      if (!winnerUserId) throw new Error('Winning side has no user');

      await creditWinnings(
        {
          userId: winnerUserId,
          amountPaise: challenge.prizePoolPaise,
          description: `Prize for match ${match.publicId}`,
          idempotencyKey: `payout:${match.publicId}`,
          referenceType: 'Match',
          referenceId: match._id as Types.ObjectId,
        },
        session,
      );

      match.payoutTransactionIds.push(match._id as Types.ObjectId);
    }
  }

  challenge.status = ChallengeStatus.COMPLETED;
  await challenge.save({ session });
  await match.save({ session });
}

/**
 * ELO from ratings snapshotted at match start. Recording before/after on the
 * match makes settlement replayable and auditable.
 */
async function applyEloAndStats(
  match: IMatch,
  winner: Side | null,
  session: ClientSession,
): Promise<void> {
  const [creatorTeam, opponentTeam] = await Promise.all([
    TeamModel.findById(match.creatorTeamId).session(session),
    TeamModel.findById(match.opponentTeamId).session(session),
  ]);
  if (!creatorTeam || !opponentTeam) throw new NotFoundError('Team');

  const elo = computeElo({
    creatorBefore: creatorTeam.eloRating,
    opponentBefore: opponentTeam.eloRating,
    creatorResult: resultFromWinner(winner),
  });

  match.eloDelta = [
    {
      teamId: creatorTeam._id as Types.ObjectId,
      before: creatorTeam.eloRating,
      after: elo.creatorAfter,
    },
    {
      teamId: opponentTeam._id as Types.ObjectId,
      before: opponentTeam.eloRating,
      after: elo.opponentAfter,
    },
  ];

  creatorTeam.eloRating = elo.creatorAfter;
  opponentTeam.eloRating = elo.opponentAfter;

  creatorTeam.stats.played += 1;
  opponentTeam.stats.played += 1;

  if (winner === 'creator') {
    creatorTeam.stats.won += 1;
    opponentTeam.stats.lost += 1;
  } else if (winner === 'opponent') {
    opponentTeam.stats.won += 1;
    creatorTeam.stats.lost += 1;
  } else {
    creatorTeam.stats.drawn += 1;
    opponentTeam.stats.drawn += 1;
  }

  await creatorTeam.save({ session });
  await opponentTeam.save({ session });
}

async function raiseDispute(
  match: IMatch,
  session: ClientSession,
  reason: 'score_mismatch' | 'no_show',
): Promise<void> {
  match.status = MatchStatus.DISPUTED;

  const [dispute] = await DisputeModel.create(
    [
      {
        matchId: match._id,
        reason,
        status: 'open',
        slaDueAt: new Date(Date.now() + env.DISPUTE_SLA_HOURS * 3_600_000),
      },
    ],
    { session },
  );

  if (dispute) match.disputeId = dispute._id as Types.ObjectId;
  await match.save({ session });
}

/**
 * A captain accepts — or contests — a result somebody else proposed.
 *
 * This is the branch for an official who cannot trigger payout: a team's own
 * person officiated, so their scorecard is recorded but the money still waits
 * on both captains (games_rule/badminton.md §6).
 *
 * Deliberately sport-agnostic. It never inspects the score, only who agreed to
 * it, so cricket and football reuse it the day they get live scoring.
 */
export async function confirmProposedResult(input: {
  user: IUser;
  matchPublicId: string;
  agree: boolean;
}): Promise<{ settled: boolean; disputed: boolean; awaiting: Side | null }> {
  return withTransaction(async (session) => {
    const match = await MatchModel.findOne({ publicId: input.matchPublicId }).session(session);
    if (!match) throw new NotFoundError('Match');

    const side = await resolveSide(match, input.user, session);

    if (!match.officialResultConfirmedAt || !match.finalScore) {
      throw new ConflictError('CONFLICT', 'There is no proposed result to confirm');
    }
    if (match.status !== MatchStatus.PENDING_CONFIRMATION) {
      throw new ConflictError('CONFLICT', 'This match is not awaiting confirmation');
    }

    /** Contesting is a dispute, exactly as a score mismatch would be. */
    if (!input.agree) {
      await raiseDispute(match, session, 'score_mismatch');
      return { settled: false, disputed: true, awaiting: null };
    }

    if (side === 'creator') match.resultConfirmedByCreator = true;
    else match.resultConfirmedByOpponent = true;

    if (!match.resultConfirmedByCreator || !match.resultConfirmedByOpponent) {
      await match.save({ session });
      return {
        settled: false,
        disputed: false,
        awaiting: match.resultConfirmedByCreator ? 'opponent' : 'creator',
      };
    }

    const validation = validateScore(match.sport, match.finalScore);
    await settleVerified(match, match.finalScore, validation.winner, validation.isDraw, session);
    await match.save({ session });

    return { settled: true, disputed: false, awaiting: null };
  });
}

/**
 * The most common real case: one side submits and the loser simply closes the
 * app (§54). After the deadline we accept the single submission and settle,
 * rather than holding money indefinitely.
 */
export async function autoResolveExpiredMatches(now: Date = new Date()): Promise<number> {
  const candidates = await MatchModel.find({
    status: MatchStatus.PENDING_CONFIRMATION,
    confirmationDeadline: { $lt: now },
  })
    .select('publicId')
    .lean();

  let resolved = 0;

  for (const candidate of candidates) {
    await withTransaction(async (session) => {
      const match = await MatchModel.findById(candidate._id).session(session);
      if (!match || match.status !== MatchStatus.PENDING_CONFIRMATION) return;

      /**
       * Two ways a match reaches here, and both must drain.
       *
       * The original: one captain submitted and the other never answered.
       * The newer one: an official who cannot trigger payout recorded a
       * result and a captain never confirmed it. Reading only `submissions[0]`
       * left officiated matches parked forever with escrow still held.
       */
      const proposed = match.submissions[0]?.score ?? match.finalScore;
      if (!proposed) return;

      const validation = validateScore(match.sport, proposed);
      await settleVerified(match, proposed, validation.winner, validation.isDraw, session);

      match.status = MatchStatus.ADMIN_RESOLVED;
      await match.save({ session });
      resolved += 1;
    });
  }

  return resolved;
}

/**
 * Neither side submitted. After the void window we refund both and close it —
 * escrow must never be held indefinitely (§55).
 */
export async function voidStaleMatches(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - env.MATCH_VOID_AFTER_HOURS * 3_600_000);

  const stale = await MatchModel.find({
    status: { $in: [MatchStatus.SCHEDULED, MatchStatus.PENDING_SCORES] },
    scheduledAt: { $lt: cutoff },
    'submissions.0': { $exists: false },
  })
    .select('_id')
    .lean();

  let voided = 0;

  for (const item of stale) {
    await withTransaction(async (session) => {
      const match = await MatchModel.findById(item._id).session(session);
      if (!match) return;

      const challenge = await ChallengeModel.findById(match.challengeId).session(session);
      if (challenge && challenge.entryFeePaise > 0) {
        await refundEscrow(
          {
            userId: challenge.creatorUserId,
            challengeId: challenge._id as Types.ObjectId,
            holdIdempotencyKey: `escrow:${challenge.publicId}:creator`,
            description: 'Match abandoned — entry fee refunded',
          },
          session,
        );
        if (challenge.opponentUserId) {
          await refundEscrow(
            {
              userId: challenge.opponentUserId,
              challengeId: challenge._id as Types.ObjectId,
              holdIdempotencyKey: `escrow:${challenge.publicId}:opponent`,
              description: 'Match abandoned — entry fee refunded',
            },
            session,
          );
        }
        challenge.status = ChallengeStatus.CANCELLED;
        await challenge.save({ session });
      }

      /**
       * The official was paid nothing because the match was never played, so
       * both captains get their share back. Without this the fee sits held
       * against a match that will never settle.
       */
      await refundOfficialFee(match, session);

      /** Voided matches never touch ELO or stats (§69). */
      match.status = MatchStatus.VOIDED;
      await match.save({ session });
      voided += 1;
    });
  }

  return voided;
}

export function newMatchPublicId(): string {
  return publicId('mch');
}

export const __testing = { TransactionType };
