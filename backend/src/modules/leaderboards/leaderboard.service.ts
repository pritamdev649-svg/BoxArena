import type { Types } from 'mongoose';
import {
  ArenaModel,
  MatchFormat,
  MatchModel,
  MatchStatus,
  PlayerSportStatsModel,
  SportType,
  TeamModel,
  UserModel,
} from '../../models/index.js';
import { NotFoundError } from '../../shared/errors/app-error.js';



export type FormResult = 'W' | 'L' | 'D';

/** How many recent results the form strip shows. */
const FORM_LENGTH = 5;

/** Everyone starts here; you are unranked until your first result (§10). */
const STARTING_ELO = 1200;

const SETTLED: MatchStatus[] = [
  MatchStatus.VERIFIED,
  MatchStatus.ADMIN_RESOLVED,
  MatchStatus.WALKOVER,
];

export interface LeaderboardQuery {
  sport?: SportType | undefined;
  format?: MatchFormat | undefined;
  areaName?: string | undefined;
  period?: 'all' | 'month' | undefined;
  limit?: number | undefined;
}

export interface LeaderboardRow {
  /** Null for a player with no completed matches — they are listed, not ranked. */
  rank: number | null;
  publicId: string;
  fullName: string;
  areaName: string | null;
  sport: SportType;
  format: MatchFormat;
  eloRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  form: FormResult[];
  /** True until a first completed match — shown, never silently ranked. */
  isUnranked: boolean;
}


async function formByUser(input: {
  userIds: Types.ObjectId[];
  sport: SportType;
  since?: Date | undefined;
}): Promise<Map<string, FormResult[]>> {
  const result = new Map<string, FormResult[]>();
  if (input.userIds.length === 0) return result;

  const matches = await MatchModel.find({
    sport: input.sport,
    status: { $in: SETTLED },
    'lineup.userIds': { $in: input.userIds },
    ...(input.since ? { scheduledAt: { $gte: input.since } } : {}),
  })
    .select('lineup winnerTeamId isDraw creatorTeamId opponentTeamId scheduledAt sport')
    .sort({ scheduledAt: -1 })
    /** Enough to fill five per player without scanning the whole history. */
    .limit(input.userIds.length * FORM_LENGTH * 2)
    .lean();

  for (const match of matches) {
    for (const entry of match.lineup ?? []) {
      for (const userId of entry.userIds) {
        const key = String(userId);
        const current = result.get(key) ?? [];
        if (current.length >= FORM_LENGTH) continue;

        current.push(outcomeFor(match, entry.teamId));
        result.set(key, current);
      }
    }
  }

  return result;
}

function outcomeFor(
  match: { winnerTeamId?: Types.ObjectId; isDraw?: boolean; sport: SportType },
  teamId: Types.ObjectId,
): FormResult {
  /**
   * A badminton match cannot be drawn, so `isDraw` is ignored for it — if a
   * row somehow carried the flag, reporting D would put an impossible result
   * on the ladder rather than surfacing the bug.
   */
  if (match.isDraw && match.sport !== SportType.BADMINTON) return 'D';
  if (!match.winnerTeamId) return 'L';
  return String(match.winnerTeamId) === String(teamId) ? 'W' : 'L';
}

export async function getLeaderboard(query: LeaderboardQuery): Promise<LeaderboardRow[]> {
  const sport = query.sport ?? SportType.BADMINTON;
  const format = query.format ?? MatchFormat.SINGLES;
  const limit = Math.min(query.limit ?? 50, 100);

  /**
   * Ranked players first, then everyone else.
   *
   * A player with a starting rating and no results has not earned a position,
   * and putting them at #1 on an unplayed rating is the exact dishonesty this
   * endpoint replaced. They still appear — a ladder nobody can join looks
   * broken — but without a rank number.
   */
  const stats = await PlayerSportStatsModel.aggregate<{
    userId: Types.ObjectId;
    eloRating: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    areaName?: string;
    hasPlayed: number;
  }>([
    {
      $match: {
        sport,
        format,
        ...(query.areaName ? { areaName: query.areaName } : {}),
      },
    },
    { $addFields: { hasPlayed: { $cond: [{ $gt: ['$matchesPlayed', 0] }, 1, 0] } } },
    { $sort: { hasPlayed: -1, eloRating: -1, matchesPlayed: -1 } },
    { $limit: limit },
  ]);

  if (stats.length === 0) return [];

  const userIds = stats.map((row) => row.userId as Types.ObjectId);
  const [users, form] = await Promise.all([
    UserModel.find({ _id: { $in: userIds } }).select('publicId fullName homeAreaName').lean(),
    formByUser({
      userIds,
      sport,
      /** "This month" means matches played since, not ratings recomputed. */
      since:
        query.period === 'month'
          ? new Date(Date.now() - 30 * 86_400_000)
          : undefined,
    }),
  ]);

  const userById = new Map(users.map((user) => [String(user._id), user]));

  let rank = 0;

  return stats.map((row) => {
    const user = userById.get(String(row.userId));
    const isUnranked = row.matchesPlayed === 0;
    if (!isUnranked) rank += 1;

    return {
      rank: isUnranked ? null : rank,
      publicId: user?.publicId ?? '',
      fullName: user?.fullName ?? 'Unknown player',
      areaName: row.areaName ?? user?.homeAreaName ?? null,
      sport,
      format,
      eloRating: row.eloRating,
      matchesPlayed: row.matchesPlayed,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      form: form.get(String(row.userId)) ?? [],
      isUnranked,
    };
  });
}


export async function getRecentPublicMatches(limit = 10) {
  const matches = await MatchModel.find({ status: { $in: SETTLED } })
    .select('publicId sport format scheduledAt finalScore winnerTeamId isDraw creatorTeamId opponentTeamId arenaId')
    .sort({ scheduledAt: -1 })
    .limit(Math.min(limit, 50))
    .lean();

  if (matches.length === 0) return [];

  const teamIds = matches.flatMap((match) => [match.creatorTeamId, match.opponentTeamId]);
  const [teams, arenas] = await Promise.all([
    TeamModel.find({ _id: { $in: teamIds } }).select('name publicId').lean(),
    ArenaModel.find({ _id: { $in: matches.map((match) => match.arenaId) } })
      .select('name slug')
      .lean(),
  ]);

  const teamById = new Map(teams.map((team) => [String(team._id), team]));
  const arenaById = new Map(arenas.map((arena) => [String(arena._id), arena]));

  return matches.map((match) => ({
    publicId: match.publicId,
    sport: match.sport,
    format: match.format,
    playedAt: match.scheduledAt,
    finalScore: match.finalScore ?? null,
    isDraw: match.isDraw ?? false,
    creator: teamById.get(String(match.creatorTeamId))?.name ?? 'Team',
    opponent: teamById.get(String(match.opponentTeamId))?.name ?? 'Team',
    winner:
      match.winnerTeamId
        ? teamById.get(String(match.winnerTeamId))?.name ?? null
        : null,
    arena: arenaById.get(String(match.arenaId))?.name ?? null,
    arenaSlug: arenaById.get(String(match.arenaId))?.slug ?? null,
  }));
}

/** The SEO arena page — public, so no owner or payout detail. */
export async function getPublicArena(slug: string) {
  const arena = await ArenaModel.findOne({ slug, isActive: true })
    .select('publicId name slug images amenities sportsSupported rating address operatingHours isVerified description')
    .lean();
  if (!arena) throw new NotFoundError('Arena');
  return arena;
}

export { STARTING_ELO };
