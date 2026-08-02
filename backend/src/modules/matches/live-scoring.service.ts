import type { ClientSession, Types } from 'mongoose';
import {
  MatchEventModel,
  MatchEventType,
  MatchModel,
  MatchPointModel,
  MatchSetModel,
  MatchFormat,
  MatchStatus,
  OfficialModel,
  TeamModel,
  UserModel,
  PointOutcome,
  SportType,
  type IMatch,
  type IMatchPoint,
  type IUser,
  UserRole,
} from '../../models/index.js';
import { withTransaction } from '../../shared/config/db.js';
import { env } from '../../shared/config/env.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/app-error.js';
import { validateScore, type Side } from './score-validator.js';
import {
  awardPoint,
  gamesWon,
  replay,
  startMatch as startEngine,
  toScorePayload,
  type RallyState,
} from './badminton-engine.js';
import { settleVerified } from './match.service.js';
import { broadcastToUsers } from '../../shared/services/socket.js';

/**
 * Official-run live scoring (games_rule/badminton.md).
 *
 * Two rules govern everything here:
 *
 * 1. **The point log is the score.** Nothing stores a running total. Every
 *    read replays the log through the rules engine, so a corrected match and
 *    a clean one are computed by the identical code path.
 *
 * 2. **The client never states a score.** It says "point to the creator" and
 *    the engine decides what that means — including whether the game just
 *    ended. That is what makes "21-20 wins the set" unrepresentable rather
 *    than merely rejected.
 */

/** Badminton only for now; other sports keep the dual-captain flow. */
function assertScorableSport(match: IMatch): void {
  if (match.sport !== SportType.BADMINTON) {
    throw new BadRequestError('Live scoring currently supports badminton only');
  }
}

/**
 * Who may operate the scoreboard.
 *
 * When an official is assigned they are the ONLY scorer — that is the whole
 * point of the feature. Until the officials marketplace ships (featuredoc/11),
 * matches have no official, so we fall back to an admin. Captains are
 * deliberately NOT trusted to score their own match.
 */
async function assertCanScore(match: IMatch, user: IUser): Promise<void> {
  if (match.officialId) {
    const official = await OfficialModel.findById(match.officialId).lean();
    if (!official) throw new NotFoundError('Official');
    if (String(official.userId) !== String(user._id)) {
      throw new ForbiddenError('Only the assigned official can score this match');
    }
    return;
  }

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  if (!isAdmin) {
    throw new ForbiddenError('This match has no assigned official yet');
  }
}

// ---------------------------------------------------------------------------
// Deriving state from the log
// ---------------------------------------------------------------------------

/**
 * Collapses the append-only log into the rallies that actually count.
 *
 * A correction row means "the previous rally was a mistake" — it pops rather
 * than appends. The mistaken rally stays on the record, which is the point:
 * you can see that the official fixed something at 15-12 and when.
 */
export function effectiveRows<T extends { isCorrection: boolean }>(points: T[]): T[] {
  const stack: T[] = [];
  for (const point of points) {
    if (point.isCorrection) stack.pop();
    else stack.push(point);
  }
  return stack;
}

export function effectiveRallies(points: Pick<IMatchPoint, 'scoringSide' | 'isCorrection'>[]): Side[] {
  return effectiveRows(points).map((point) => point.scoringSide);
}

async function loadState(match: IMatch, session?: ClientSession): Promise<RallyState> {
  const query = MatchPointModel.find({ matchId: match._id }).sort({ createdAt: 1, _id: 1 });
  const points = await (session ? query.session(session) : query).lean();

  return replay({
    bestOf: match.bestOf,
    /** Creator serves first unless a rally says otherwise — see startLiveMatch. */
    firstServer: 'creator',
    isDoubles: match.format === MatchFormat.DOUBLES,
    rallies: effectiveRallies(points),
  });
}

/**
 * Everyone entitled to watch this match live: both captains and the official.
 *
 * Resolved fresh each broadcast rather than cached — a line-up can change
 * between rallies and a stale audience list means somebody stops receiving
 * the score mid-match with no error anywhere.
 */
async function audienceFor(match: IMatch): Promise<string[]> {
  const teams = await TeamModel.find({
    _id: { $in: [match.creatorTeamId, match.opponentTeamId] },
  })
    .select('captainId members.userId')
    .lean();

  const ids = teams.flatMap((team) => [
    String(team.captainId),
    ...team.members.map((member) => String(member.userId)),
  ]);

  if (match.officialId) {
    const official = await OfficialModel.findById(match.officialId).select('userId').lean();
    if (official) ids.push(String(official.userId));
  }
  return ids;
}

/**
 * Pushes the new state to watchers.
 *
 * ALWAYS called after the transaction commits, never inside it — a score frame
 * for a rally that then rolled back is unrecoverable trust damage
 * (featuredoc/06).
 */
async function publish(match: IMatch, state: RallyState): Promise<void> {
  try {
    broadcastToUsers(await audienceFor(match), 'match.score', {
      matchPublicId: match.publicId,
      state,
    });
  } catch {
    /** A failed push must never fail the rally that was already recorded. */
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function startLiveMatch(input: {
  user: IUser;
  matchPublicId: string;
}): Promise<{ match: IMatch; state: RallyState }> {
  return withTransaction(async (session) => {
    const match = await MatchModel.findOne({ publicId: input.matchPublicId }).session(session);
    if (!match) throw new NotFoundError('Match');

    assertScorableSport(match);
    await assertCanScore(match, input.user);

    if (match.status === MatchStatus.IN_PROGRESS) {
      /** Idempotent: a double-tap on "Start Match" must not reset the clock. */
      return { match, state: await loadState(match, session) };
    }
    if (match.status !== MatchStatus.SCHEDULED) {
      throw new ConflictError('CONFLICT', `A ${match.status} match cannot be started`);
    }

    match.status = MatchStatus.IN_PROGRESS;
    match.startedAt = new Date();
    await match.save({ session });

    return {
      match,
      state: startEngine({
        bestOf: match.bestOf,
        firstServer: 'creator',
        isDoubles: match.format === MatchFormat.DOUBLES,
      }),
    };
  });
}

export interface RecordPointResult {
  state: RallyState;
  gameEnded: boolean;
  matchEnded: boolean;
  changeEnds: boolean;
}

export async function recordPoint(input: {
  user: IUser;
  matchPublicId: string;
  side: Side;
  idempotencyKey: string;
  /** Optional colour for the stats screen. A bare tap is still a valid rally. */
  outcome?: PointOutcome | undefined;
  attributedToUserId?: string | undefined;
}): Promise<RecordPointResult> {
  const result = await recordPointCommitted(input);
  const match = await MatchModel.findOne({ publicId: input.matchPublicId }).lean();
  if (match) await publish(match as IMatch, result.state);
  return result;
}

async function recordPointCommitted(input: {
  user: IUser;
  matchPublicId: string;
  side: Side;
  idempotencyKey: string;
  outcome?: PointOutcome | undefined;
  attributedToUserId?: string | undefined;
}): Promise<RecordPointResult> {
  return withTransaction(async (session) => {
    const match = await MatchModel.findOne({ publicId: input.matchPublicId }).session(session);
    if (!match) throw new NotFoundError('Match');

    assertScorableSport(match);
    await assertCanScore(match, input.user);
    assertLive(match);

    /**
     * The retry guard. A tap on 4G at a turf at 9pm WILL be retried, and a
     * retried rally is a phantom point nobody can argue with afterwards.
     */
    const replayed = await MatchPointModel.findOne({
      matchId: match._id,
      idempotencyKey: input.idempotencyKey,
    }).session(session);
    if (replayed) {
      const state = await loadState(match, session);
      return { state, gameEnded: false, matchEnded: state.isComplete, changeEnds: false };
    }

    const before = await loadState(match, session);
    const outcome = awardPoint(before, input.side);

    await MatchPointModel.create(
      [
        {
          matchId: match._id,
          gameNumber: before.currentGameNumber,
          pointNumber: before.current.creator + before.current.opponent + 1,
          scoringSide: input.side,
          /** After the rally, before any game reset — what a replay should show. */
          scoreAfter: {
            creator: before.current.creator + (input.side === 'creator' ? 1 : 0),
            opponent: before.current.opponent + (input.side === 'opponent' ? 1 : 0),
          },
          servingSide: before.serving,
          recordedByUserId: input.user._id,
          ...(input.outcome ? { outcome: input.outcome } : {}),
          ...(input.attributedToUserId ? { attributedToUserId: input.attributedToUserId } : {}),
          isCorrection: false,
          idempotencyKey: input.idempotencyKey,
        },
      ],
      { session },
    );

    if (outcome.gameEnded) {
      await closeGame(match, before.currentGameNumber, outcome.state, session);
    }
    if (outcome.changeEnds) {
      await MatchEventModel.create(
        [
          {
            matchId: match._id,
            gameNumber: before.currentGameNumber,
            eventType: MatchEventType.ENDS_CHANGED,
            recordedByUserId: input.user._id,
          },
        ],
        { session },
      );
    }

    /**
     * The match is over on court, but nothing settles yet — the official signs
     * off first (§6). Parking it in PENDING_CONFIRMATION means the existing
     * auto-resolve sweep cannot mistake it for an unsubmitted match.
     */
    if (outcome.matchEnded) {
      match.status = MatchStatus.PENDING_CONFIRMATION;
      match.endedAt = new Date();
      await match.save({ session });
    }

    return {
      state: outcome.state,
      gameEnded: outcome.gameEnded,
      matchEnded: outcome.matchEnded,
      changeEnds: outcome.changeEnds,
    };
  });
}

/**
 * Undo appends; it never deletes.
 *
 * The mistaken rally stays in the log with the correction beside it, so the
 * record shows what happened AND what was fixed. Deleting would leave a log
 * that silently disagrees with what the players saw on the scoreboard.
 */
export async function undoLastPoint(input: {
  user: IUser;
  matchPublicId: string;
  idempotencyKey: string;
}): Promise<RallyState> {
  const state = await undoCommitted(input);
  const match = await MatchModel.findOne({ publicId: input.matchPublicId }).lean();
  if (match) await publish(match as IMatch, state);
  return state;
}

async function undoCommitted(input: {
  user: IUser;
  matchPublicId: string;
  idempotencyKey: string;
}): Promise<RallyState> {
  return withTransaction(async (session) => {
    const match = await MatchModel.findOne({ publicId: input.matchPublicId }).session(session);
    if (!match) throw new NotFoundError('Match');

    assertScorableSport(match);
    await assertCanScore(match, input.user);

    if (match.status !== MatchStatus.IN_PROGRESS && match.status !== MatchStatus.PENDING_CONFIRMATION) {
      throw new ConflictError('CONFLICT', 'This match is not being scored');
    }
    if (match.officialResultConfirmedAt) {
      throw new ConflictError('CONFLICT', 'The result is already confirmed and cannot be changed');
    }

    const existing = await MatchPointModel.findOne({
      matchId: match._id,
      idempotencyKey: input.idempotencyKey,
    }).session(session);
    if (existing) return loadState(match, session);

    const points = await MatchPointModel.find({ matchId: match._id })
      .sort({ createdAt: 1, _id: 1 })
      .session(session)
      .lean();

    const live = effectiveRows(points);
    const undone = live[live.length - 1];
    if (!undone) throw new BadRequestError('There is no point to undo');

    /**
     * The state this undo reverts TO. Computed before writing so the audit row
     * can carry the resulting score — a correction whose `scoreAfter` was the
     * pre-undo score would read as if it had scored a point.
     */
    const reverted = replay({
      bestOf: match.bestOf,
      firstServer: 'creator',
      rallies: live.slice(0, -1).map((point) => point.scoringSide),
    });

    await MatchPointModel.create(
      [
        {
          matchId: match._id,
          /**
           * Points AT the rally being cancelled, not at the current state —
           * undoing a game-winning rally happens after the engine has already
           * rolled into the next game, and "game 2, point 0" describes nothing.
           */
          gameNumber: undone.gameNumber,
          pointNumber: undone.pointNumber,
          scoringSide: undone.scoringSide,
          scoreAfter: { creator: reverted.current.creator, opponent: reverted.current.opponent },
          servingSide: reverted.serving,
          recordedByUserId: input.user._id,
          isCorrection: true,
          idempotencyKey: input.idempotencyKey,
        },
      ],
      { session },
    );

    const after = await loadState(match, session);

    /** An undo can reopen a finished game, so any closed set must follow it back. */
    await MatchSetModel.deleteMany(
      { matchId: match._id, gameNumber: { $gt: after.games.length } },
      { session },
    );

    if (!after.isComplete && match.status === MatchStatus.PENDING_CONFIRMATION) {
      match.status = MatchStatus.IN_PROGRESS;
      match.endedAt = undefined as unknown as Date;
      await match.save({ session });
    }

    return after;
  });
}

export async function recordEvent(input: {
  user: IUser;
  matchPublicId: string;
  eventType: MatchEventType;
  side?: Side;
  note?: string;
}): Promise<void> {
  const match = await MatchModel.findOne({ publicId: input.matchPublicId });
  if (!match) throw new NotFoundError('Match');

  await assertCanScore(match, input.user);
  assertLive(match);

  const state = await loadState(match);

  await MatchEventModel.create({
    matchId: match._id,
    gameNumber: state.currentGameNumber,
    eventType: input.eventType,
    recordedByUserId: input.user._id,
    ...(input.side ? { side: input.side } : {}),
    ...(input.note ? { note: input.note } : {}),
  });
}

/**
 * The official signs off (§6).
 *
 * Where they can trigger payout, this settles immediately through the SAME
 * transaction the dual-captain path uses. Where they cannot — a team-added
 * person — the result is recorded and the match waits for both captains,
 * exactly as it would have without an official.
 */
export async function confirmOfficialResult(input: {
  user: IUser;
  matchPublicId: string;
}): Promise<{ settled: boolean; awaitingCaptains: boolean }> {
  return withTransaction(async (session) => {
    const match = await MatchModel.findOne({ publicId: input.matchPublicId }).session(session);
    if (!match) throw new NotFoundError('Match');

    assertScorableSport(match);
    await assertCanScore(match, input.user);

    const state = await loadState(match, session);
    if (!state.isComplete) {
      throw new ConflictError('CONFLICT', 'The match is not finished yet');
    }
    if (match.officialResultConfirmedAt) {
      return { settled: match.status === MatchStatus.VERIFIED, awaitingCaptains: false };
    }

    /**
     * The reconciliation rule. The derived result goes through the same
     * validator a hand-entered score would. If the engine ever produced
     * something the validator rejects, that is a bug worth failing loudly for
     * — two paths to a result that disagree is the exact trust hole officials
     * exist to close.
     */
    const payload = toScorePayload(state);
    const validation = validateScore(match.sport, payload);
    if (validation.winner !== state.winner) {
      throw new Error(
        `Live score and validator disagree on match ${match.publicId} — refusing to settle`,
      );
    }

    match.officialResultConfirmedAt = new Date();

    if (match.officialCanTriggerPayout === true) {
      await settleVerified(match, payload, validation.winner, validation.isDraw, session);
      await match.save({ session });
      await bumpOfficialTally(match, session);
      return { settled: true, awaitingCaptains: false };
    }

    /**
     * Non-triggering official: recorded, but the captains still decide.
     *
     * The deadline is what stops this becoming a dead end. Without it the
     * match sits in PENDING_CONFIRMATION with escrow held and no sweep will
     * ever pick it up — escrow must never be held indefinitely (§55).
     */
    match.finalScore = payload;
    match.status = MatchStatus.PENDING_CONFIRMATION;
    match.confirmationDeadline = new Date(
      Date.now() + env.SCORE_CONFIRMATION_WINDOW_MINUTES * 60_000,
    );
    await match.save({ session });
    await bumpOfficialTally(match, session);

    return { settled: false, awaitingCaptains: true };
  });
}

async function bumpOfficialTally(match: IMatch, session: ClientSession): Promise<void> {
  if (!match.officialId) return;
  await OfficialModel.updateOne(
    { _id: match.officialId },
    { $inc: { matchesOfficiated: 1 } },
    { session },
  );
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The scoreboard, for the official's device and for spectators. */
export async function getLiveState(matchPublicId: string) {
  const match = await MatchModel.findOne({ publicId: matchPublicId }).lean();
  if (!match) throw new NotFoundError('Match');

  const [state, sets, events, names] = await Promise.all([
    loadState(match as IMatch),
    MatchSetModel.find({ matchId: match._id }).sort({ gameNumber: 1 }).lean(),
    MatchEventModel.find({ matchId: match._id }).sort({ createdAt: 1 }).lean(),
    sideNames(match as IMatch),
  ]);

  return {
    matchPublicId: match.publicId,
    ...names,
    status: match.status,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    bestOf: match.bestOf,
    gamesWon: gamesWon(state),
    state,
    sets,
    events,
  };
}

/**
 * Match and per-player statistics, derived from the point log.
 *
 * Nothing here is stored. Every figure is recomputed from the rallies that
 * actually count, so a correction changes the stats the same instant it
 * changes the score — a cached stat that survives an undo is a stat that
 * argues with the scoreboard beside it.
 */
export async function getMatchStats(matchPublicId: string) {
  const match = await MatchModel.findOne({ publicId: matchPublicId }).lean();
  if (!match) throw new NotFoundError('Match');

  const rows = await MatchPointModel.find({ matchId: match._id })
    .sort({ createdAt: 1, _id: 1 })
    .lean();
  const live = effectiveRows(rows);

  const blank = () => ({
    pointsWon: 0,
    pointsWonOnServe: 0,
    longestStreak: 0,
    winners: 0,
    unforcedErrors: 0,
    serviceFaults: 0,
  });
  const totals = { creator: blank(), opponent: blank() };

  let streakSide: Side | null = null;
  let streak = 0;

  for (const point of live) {
    const side = point.scoringSide;
    const tally = totals[side];

    tally.pointsWon += 1;
    /** Won the rally while already serving — the "points won on serve" stat. */
    if (point.servingSide === side) tally.pointsWonOnServe += 1;

    if (point.outcome === PointOutcome.WINNER) tally.winners += 1;
    if (point.outcome === PointOutcome.UNFORCED_ERROR) {
      /** An error is charged to the side that MADE it, i.e. the loser. */
      totals[side === 'creator' ? 'opponent' : 'creator'].unforcedErrors += 1;
    }
    if (point.outcome === PointOutcome.SERVICE_FAULT) {
      totals[side === 'creator' ? 'opponent' : 'creator'].serviceFaults += 1;
    }

    streak = streakSide === side ? streak + 1 : 1;
    streakSide = side;
    if (streak > tally.longestStreak) tally.longestStreak = streak;
  }

  return {
    totalPointsPlayed: live.length,
    corrections: rows.length - live.length,
    creator: totals.creator,
    opponent: totals.opponent,
  };
}

/**
 * Who is actually on court, per side.
 *
 * Prefers the recorded line-up — a doubles court diagram needs the two players
 * by name, not the team. Falls back to the team name when no line-up was
 * captured, which is the common case for a casual singles match.
 */
async function sideNames(match: IMatch): Promise<{
  creatorNames: string[];
  opponentNames: string[];
}> {
  const lineupIds = (match.lineup ?? []).flatMap((entry) => entry.userIds);

  const [teams, players] = await Promise.all([
    TeamModel.find({ _id: { $in: [match.creatorTeamId, match.opponentTeamId] } })
      .select('_id name')
      .lean(),
    lineupIds.length > 0
      ? UserModel.find({ _id: { $in: lineupIds } }).select('_id fullName').lean()
      : Promise.resolve([]),
  ]);

  const nameById = new Map(players.map((player) => [String(player._id), player.fullName]));
  const teamName = (id: unknown) =>
    teams.find((team) => String(team._id) === String(id))?.name ?? 'Team';

  const forTeam = (teamId: unknown): string[] => {
    const entry = (match.lineup ?? []).find((row) => String(row.teamId) === String(teamId));
    const named = (entry?.userIds ?? [])
      .map((id) => nameById.get(String(id)))
      .filter((name): name is string => Boolean(name));
    return named.length > 0 ? named : [teamName(teamId)];
  };

  return {
    creatorNames: forTeam(match.creatorTeamId),
    opponentNames: forTeam(match.opponentTeamId),
  };
}

/** The full rally-by-rally record — what makes a disputed result replayable. */
export async function getPointLog(matchPublicId: string) {
  const match = await MatchModel.findOne({ publicId: matchPublicId }).select('_id').lean();
  if (!match) throw new NotFoundError('Match');

  return MatchPointModel.find({ matchId: match._id })
    .sort({ createdAt: 1, _id: 1 })
    .populate('recordedByUserId', 'fullName publicId')
    .lean();
}

// ---------------------------------------------------------------------------

function assertLive(match: IMatch): void {
  if (match.status !== MatchStatus.IN_PROGRESS) {
    throw new ConflictError('CONFLICT', 'This match is not live');
  }
}

/** Writes the completed game once the engine says it closed. */
async function closeGame(
  match: IMatch,
  gameNumber: number,
  after: RallyState,
  session: ClientSession,
): Promise<void> {
  const game = after.games[gameNumber - 1];
  if (!game) return;

  const previous = await MatchSetModel.findOne({ matchId: match._id, gameNumber: gameNumber - 1 })
    .session(session)
    .lean();
  const startedAt = previous?.endedAt ?? match.startedAt ?? new Date();
  const endedAt = new Date();

  await MatchSetModel.create(
    [
      {
        matchId: match._id,
        gameNumber,
        creatorPoints: game.creator,
        opponentPoints: game.opponent,
        winnerSide: game.creator > game.opponent ? 'creator' : 'opponent',
        startedAt,
        endedAt,
        durationSeconds: Math.max(
          0,
          Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 1000),
        ),
      },
    ],
    { session },
  );
}

export type { RallyState };
export type LiveScoringMatchId = Types.ObjectId;
