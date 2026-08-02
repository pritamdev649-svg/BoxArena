import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, startTestDatabase, stopTestDatabase } from '../../test/setup.js';
import {
  ArenaModel,
  ChallengeModel,
  ChallengeStatus,
  MatchFormat,
  MatchModel,
  MatchPointModel,
  MatchSetModel,
  MatchStatus,
  OfficialModel,
  OfficialType,
  OfficialVerificationStatus,
  SportType,
  TeamModel,
  UserModel,
  UserRole,
  type IUser,
} from '../../models/index.js';
import { publicId, referralCode } from '../../shared/utils/ids.js';
import { autoResolveExpiredMatches, confirmProposedResult } from './match.service.js';
import {
  confirmOfficialResult,
  effectiveRallies,
  getLiveState,
  recordPoint,
  startLiveMatch,
  undoLastPoint,
} from './live-scoring.service.js';
import type { Side } from './score-validator.js';

beforeAll(async () => {
  await startTestDatabase();
});
afterAll(async () => {
  await stopTestDatabase();
});
beforeEach(async () => {
  await clearDatabase();
});

async function makeUser(role: UserRole = UserRole.PLAYER): Promise<IUser> {
  return UserModel.create({
    publicId: publicId('usr'),
    phoneNumber: `+9198${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`,
    fullName: 'Test Person',
    role,
    referralCode: referralCode(),
  });
}

/** A badminton match with an assigned, payout-triggering official. */
async function makeMatch(options: { canTriggerPayout?: boolean } = {}) {
  const owner = await makeUser(UserRole.ARENA_OWNER);
  const officialUser = await makeUser();
  const creator = await makeUser();
  const opponent = await makeUser();

  const arena = await ArenaModel.create({
    publicId: publicId('arn'),
    name: 'Smash Point',
    slug: `smash-${publicId('a')}`,
    ownerId: owner._id,
    address: {
      line1: 'Sector H',
      areaName: 'Aliganj',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      pincode: '226024',
    },
    location: { type: 'Point', coordinates: [80.9346, 26.8894] },
    sportsSupported: [SportType.BADMINTON],
    contactPhone: '+919810000001',
  });

  const official = await OfficialModel.create({
    publicId: publicId('ofc'),
    userId: officialUser._id,
    type: OfficialType.INDEPENDENT,
    displayName: 'R. Sharma',
    sports: [SportType.BADMINTON],
    pricePerMatchPaise: 30_000,
    verificationStatus: OfficialVerificationStatus.VERIFIED,
  });

  const teamA = await TeamModel.create({
    publicId: publicId('tm'),
    name: 'Smash Bros',
    slug: `smash-bros-${publicId('t')}`,
    captainId: creator._id,
    sport: SportType.BADMINTON,
    format: MatchFormat.SINGLES,
    members: [{ userId: creator._id, role: 'captain', joinedAt: new Date(), isActive: true }],
  });
  const teamB = await TeamModel.create({
    publicId: publicId('tm'),
    name: 'Net Ninjas',
    slug: `net-ninjas-${publicId('t')}`,
    captainId: opponent._id,
    sport: SportType.BADMINTON,
    format: MatchFormat.SINGLES,
    members: [{ userId: opponent._id, role: 'captain', joinedAt: new Date(), isActive: true }],
  });

  const challenge = await ChallengeModel.create({
    publicId: publicId('chl'),
    creatorUserId: creator._id,
    creatorTeamId: teamA._id,
    opponentUserId: opponent._id,
    opponentTeamId: teamB._id,
    sport: SportType.BADMINTON,
    format: MatchFormat.SINGLES,
    bookingId: arena._id,
    arenaId: arena._id,
    startAt: new Date(),
    endAt: new Date(Date.now() + 3_600_000),
    entryFeePaise: 0,
    status: ChallengeStatus.MATCHED,
    matchExpiresAt: new Date(Date.now() + 86_400_000),
  });

  const match = await MatchModel.create({
    publicId: publicId('mch'),
    challengeId: challenge._id,
    sport: SportType.BADMINTON,
    format: MatchFormat.SINGLES,
    arenaId: arena._id,
    creatorTeamId: teamA._id,
    opponentTeamId: teamB._id,
    scheduledAt: new Date(),
    status: MatchStatus.SCHEDULED,
    bestOf: 3,
    officialId: official._id,
    officialCanTriggerPayout: options.canTriggerPayout ?? true,
  });

  return { match, officialUser, creator, opponent };
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `test-key-${String(keyCounter).padStart(8, '0')}`;
}

/** Plays `count` rallies for one side through the real service. */
async function play(user: IUser, matchPublicId: string, side: Side, count: number) {
  let last;
  for (let i = 0; i < count; i += 1) {
    last = await recordPoint({ user, matchPublicId, side, idempotencyKey: nextKey() });
  }
  return last;
}

describe('starting a match', () => {
  it('only the assigned official may start it', async () => {
    const { match, creator } = await makeMatch();

    await expect(
      startLiveMatch({ user: creator, matchPublicId: match.publicId }),
    ).rejects.toThrow(/only the assigned official/iu);
  });

  it('moves the match to in_progress and is safe to double-tap', async () => {
    const { match, officialUser } = await makeMatch();

    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });
    const again = await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });

    expect(again.state.games).toHaveLength(0);
    const reloaded = await MatchModel.findById(match._id).lean();
    expect(reloaded?.status).toBe(MatchStatus.IN_PROGRESS);
    expect(reloaded?.startedAt).toBeDefined();
  });
});

describe('recording rallies', () => {
  it('rejects a point before the match is started', async () => {
    const { match, officialUser } = await makeMatch();

    await expect(
      recordPoint({
        user: officialUser,
        matchPublicId: match.publicId,
        side: 'creator',
        idempotencyKey: nextKey(),
      }),
    ).rejects.toThrow(/not live/iu);
  });

  it('a replayed idempotency key does not create a phantom point', async () => {
    const { match, officialUser } = await makeMatch();
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });

    const key = nextKey();
    await recordPoint({ user: officialUser, matchPublicId: match.publicId, side: 'creator', idempotencyKey: key });
    const retry = await recordPoint({
      user: officialUser,
      matchPublicId: match.publicId,
      side: 'creator',
      idempotencyKey: key,
    });

    expect(retry.state.current).toEqual({ creator: 1, opponent: 0 });
    expect(await MatchPointModel.countDocuments({ matchId: match._id })).toBe(1);
  });

  it('writes a set row when a game closes', async () => {
    const { match, officialUser } = await makeMatch();
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });

    const last = await play(officialUser, match.publicId, 'creator', 21);
    expect(last?.gameEnded).toBe(true);

    const sets = await MatchSetModel.find({ matchId: match._id }).lean();
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ gameNumber: 1, creatorPoints: 21, opponentPoints: 0, winnerSide: 'creator' });
  });

  it('parks a finished match in pending_confirmation, not verified', async () => {
    const { match, officialUser } = await makeMatch();
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });

    await play(officialUser, match.publicId, 'creator', 21);
    const last = await play(officialUser, match.publicId, 'creator', 21);

    expect(last?.matchEnded).toBe(true);
    const reloaded = await MatchModel.findById(match._id).lean();
    expect(reloaded?.status).toBe(MatchStatus.PENDING_CONFIRMATION);
    expect(reloaded?.endedAt).toBeDefined();
  });
});

describe('undo', () => {
  it('appends a correction rather than deleting the mistake', async () => {
    const { match, officialUser } = await makeMatch();
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });

    await play(officialUser, match.publicId, 'creator', 3);
    const after = await undoLastPoint({
      user: officialUser,
      matchPublicId: match.publicId,
      idempotencyKey: nextKey(),
    });

    expect(after.current).toEqual({ creator: 2, opponent: 0 });

    /** Four rows: three rallies plus the correction. Nothing was removed. */
    const rows = await MatchPointModel.find({ matchId: match._id }).sort({ createdAt: 1 }).lean();
    expect(rows).toHaveLength(4);
    expect(rows[3]?.isCorrection).toBe(true);
  });

  it('reopens a closed game and removes its set row', async () => {
    const { match, officialUser } = await makeMatch();
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });

    await play(officialUser, match.publicId, 'creator', 21);
    expect(await MatchSetModel.countDocuments({ matchId: match._id })).toBe(1);

    const after = await undoLastPoint({
      user: officialUser,
      matchPublicId: match.publicId,
      idempotencyKey: nextKey(),
    });

    expect(after.games).toHaveLength(0);
    expect(after.current).toEqual({ creator: 20, opponent: 0 });
    expect(await MatchSetModel.countDocuments({ matchId: match._id })).toBe(0);
  });

  it('un-ends a finished match and returns it to in_progress', async () => {
    const { match, officialUser } = await makeMatch();
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });

    await play(officialUser, match.publicId, 'creator', 21);
    await play(officialUser, match.publicId, 'creator', 21);
    expect((await MatchModel.findById(match._id).lean())?.status).toBe(MatchStatus.PENDING_CONFIRMATION);

    await undoLastPoint({ user: officialUser, matchPublicId: match.publicId, idempotencyKey: nextKey() });

    const reloaded = await MatchModel.findById(match._id).lean();
    expect(reloaded?.status).toBe(MatchStatus.IN_PROGRESS);
  });

  it('refuses when there is nothing to undo', async () => {
    const { match, officialUser } = await makeMatch();
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });

    await expect(
      undoLastPoint({ user: officialUser, matchPublicId: match.publicId, idempotencyKey: nextKey() }),
    ).rejects.toThrow(/no point to undo/iu);
  });
});

describe('effectiveRallies', () => {
  it('pops the last rally for each correction', () => {
    expect(
      effectiveRallies([
        { scoringSide: 'creator', isCorrection: false },
        { scoringSide: 'opponent', isCorrection: false },
        { scoringSide: 'opponent', isCorrection: true },
        { scoringSide: 'creator', isCorrection: false },
      ]),
    ).toEqual(['creator', 'creator']);
  });
});

describe('confirming the result', () => {
  it('refuses before the match is finished', async () => {
    const { match, officialUser } = await makeMatch();
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });
    await play(officialUser, match.publicId, 'creator', 5);

    await expect(
      confirmOfficialResult({ user: officialUser, matchPublicId: match.publicId }),
    ).rejects.toThrow(/not finished/iu);
  });

  it('settles immediately when the official can trigger payout', async () => {
    const { match, officialUser } = await makeMatch({ canTriggerPayout: true });
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });
    await play(officialUser, match.publicId, 'creator', 21);
    await play(officialUser, match.publicId, 'creator', 21);

    const result = await confirmOfficialResult({ user: officialUser, matchPublicId: match.publicId });

    expect(result).toEqual({ settled: true, awaitingCaptains: false });
    const reloaded = await MatchModel.findById(match._id).lean();
    expect(reloaded?.status).toBe(MatchStatus.VERIFIED);
    expect(reloaded?.winnerTeamId).toBeDefined();
    expect(reloaded?.finalScore?.badminton?.games).toHaveLength(2);
  });

  it('waits for both captains when the official cannot trigger payout', async () => {
    const { match, officialUser } = await makeMatch({ canTriggerPayout: false });
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });
    await play(officialUser, match.publicId, 'opponent', 21);
    await play(officialUser, match.publicId, 'opponent', 21);

    const result = await confirmOfficialResult({ user: officialUser, matchPublicId: match.publicId });

    expect(result).toEqual({ settled: false, awaitingCaptains: true });
    const reloaded = await MatchModel.findById(match._id).lean();
    expect(reloaded?.status).toBe(MatchStatus.PENDING_CONFIRMATION);
    /** The result is recorded even though nothing has been paid out. */
    expect(reloaded?.finalScore?.badminton?.games).toHaveLength(2);
  });

  it('bumps the official matches-officiated tally', async () => {
    const { match, officialUser } = await makeMatch();
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });
    await play(officialUser, match.publicId, 'creator', 21);
    await play(officialUser, match.publicId, 'creator', 21);
    await confirmOfficialResult({ user: officialUser, matchPublicId: match.publicId });

    const official = await OfficialModel.findById(match.officialId).lean();
    expect(official?.matchesOfficiated).toBe(1);
  });
});

describe('the live scoreboard read', () => {
  it('reports games won, sets and current score', async () => {
    const { match, officialUser } = await makeMatch();
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });
    await play(officialUser, match.publicId, 'creator', 21);
    await play(officialUser, match.publicId, 'opponent', 5);

    const live = await getLiveState(match.publicId);

    expect(live.gamesWon).toEqual({ creator: 1, opponent: 0 });
    expect(live.sets).toHaveLength(1);
    expect(live.state.current).toEqual({ creator: 0, opponent: 5 });
    expect(live.state.serving).toBe('opponent');
  });
});

describe('captain confirmation — the non-triggering official branch (LS6)', () => {
  /** Plays a full 2-0 match and has the official sign off, without settling. */
  async function playAndSignOff() {
    const fixture = await makeMatch({ canTriggerPayout: false });
    const { match, officialUser } = fixture;
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });
    await play(officialUser, match.publicId, 'creator', 21);
    await play(officialUser, match.publicId, 'creator', 21);
    await confirmOfficialResult({ user: officialUser, matchPublicId: match.publicId });
    return fixture;
  }

  it('sets a confirmation deadline so escrow can never be held forever', async () => {
    const { match } = await playAndSignOff();

    const reloaded = await MatchModel.findById(match._id).lean();
    expect(reloaded?.confirmationDeadline).toBeDefined();
    expect(reloaded?.confirmationDeadline?.getTime()).toBeGreaterThan(Date.now());
  });

  it('waits for the second captain, then settles', async () => {
    const { match, creator, opponent } = await playAndSignOff();

    const first = await confirmProposedResult({
      user: creator,
      matchPublicId: match.publicId,
      agree: true,
    });
    expect(first).toEqual({ settled: false, disputed: false, awaiting: 'opponent' });
    expect((await MatchModel.findById(match._id).lean())?.status).toBe(
      MatchStatus.PENDING_CONFIRMATION,
    );

    const second = await confirmProposedResult({
      user: opponent,
      matchPublicId: match.publicId,
      agree: true,
    });
    expect(second).toEqual({ settled: true, disputed: false, awaiting: null });

    const reloaded = await MatchModel.findById(match._id).lean();
    expect(reloaded?.status).toBe(MatchStatus.VERIFIED);
    expect(reloaded?.winnerTeamId).toBeDefined();
  });

  it('a captain who disagrees raises a dispute instead of settling', async () => {
    const { match, opponent } = await playAndSignOff();

    const result = await confirmProposedResult({
      user: opponent,
      matchPublicId: match.publicId,
      agree: false,
    });

    expect(result).toEqual({ settled: false, disputed: true, awaiting: null });
    const reloaded = await MatchModel.findById(match._id).lean();
    expect(reloaded?.status).toBe(MatchStatus.DISPUTED);
    expect(reloaded?.disputeId).toBeDefined();
  });

  it('a non-participant cannot confirm', async () => {
    const { match } = await playAndSignOff();
    const stranger = await makeUser();

    await expect(
      confirmProposedResult({ user: stranger, matchPublicId: match.publicId, agree: true }),
    ).rejects.toThrow(/not a participant/iu);
  });

  it('the sweep settles an officiated match nobody confirmed', async () => {
    const { match } = await playAndSignOff();

    /** Wind the deadline into the past, as the real window expiring would. */
    await MatchModel.updateOne(
      { _id: match._id },
      { $set: { confirmationDeadline: new Date(Date.now() - 1000) } },
    );

    const resolved = await autoResolveExpiredMatches();
    expect(resolved).toBeGreaterThanOrEqual(1);

    const reloaded = await MatchModel.findById(match._id).lean();
    expect(reloaded?.status).toBe(MatchStatus.ADMIN_RESOLVED);
    expect(reloaded?.winnerTeamId).toBeDefined();
  });

  it('refuses when the official could settle it themselves', async () => {
    const { match, officialUser, creator } = await makeMatch({ canTriggerPayout: true });
    await startLiveMatch({ user: officialUser, matchPublicId: match.publicId });
    await play(officialUser, match.publicId, 'creator', 21);
    await play(officialUser, match.publicId, 'creator', 21);
    await confirmOfficialResult({ user: officialUser, matchPublicId: match.publicId });

    /** Already VERIFIED — there is nothing left to confirm. */
    await expect(
      confirmProposedResult({ user: creator, matchPublicId: match.publicId, agree: true }),
    ).rejects.toThrow(/not awaiting confirmation/iu);
  });
});
