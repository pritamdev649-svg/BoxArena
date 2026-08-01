import { SportType } from '../../models/index.js';
import { BadRequestError } from '../../shared/errors/app-error.js';

/**
 * Sport scoring rules and, critically, PERSPECTIVE NORMALISATION.
 *
 * All scores are stored in the CREATOR's frame: creatorPoints first. When the
 * opponent submits, their client sends it in their own frame — "we got 21,
 * they got 18". Comparing raw payloads would turn every honest match into a
 * dispute (edge_cases.md §56). Normalise, then compare.
 */

export interface BadmintonGame {
  gameNumber: number;
  creatorPoints: number;
  opponentPoints: number;
}

export interface ScorePayload {
  cricket?: {
    creator: { runs: number; wickets: number; overs: number };
    opponent: { runs: number; wickets: number; overs: number };
  };
  football?: { creatorGoals: number; opponentGoals: number };
  badminton?: { games: BadmintonGame[] };
}

export type Side = 'creator' | 'opponent';

export interface ValidationResult {
  winner: Side | null;
  isDraw: boolean;
}

/**
 * Flips a payload from the opponent's frame into the creator's frame.
 * Called on every submission from the opponent side, before storage.
 */
export function normaliseToCreatorFrame(score: ScorePayload, submittedBy: Side): ScorePayload {
  if (submittedBy === 'creator') return score;

  if (score.badminton) {
    return {
      badminton: {
        games: score.badminton.games.map((g) => ({
          gameNumber: g.gameNumber,
          creatorPoints: g.opponentPoints,
          opponentPoints: g.creatorPoints,
        })),
      },
    };
  }

  if (score.football) {
    return {
      football: {
        creatorGoals: score.football.opponentGoals,
        opponentGoals: score.football.creatorGoals,
      },
    };
  }

  if (score.cricket) {
    return { cricket: { creator: score.cricket.opponent, opponent: score.cricket.creator } };
  }

  throw new BadRequestError('Score payload has no recognised sport');
}

/**
 * Deep equality on normalised payloads. Both sides must have already been
 * flipped into the creator frame.
 */
export function scoresAgree(a: ScorePayload, b: ScorePayload): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

/** Sorts games so submission order can't cause a false mismatch. */
function canonical(score: ScorePayload): unknown {
  if (score.badminton) {
    return {
      sport: 'badminton',
      games: [...score.badminton.games]
        .sort((x, y) => x.gameNumber - y.gameNumber)
        .map((g) => [g.gameNumber, g.creatorPoints, g.opponentPoints]),
    };
  }
  if (score.football) {
    return { sport: 'football', g: [score.football.creatorGoals, score.football.opponentGoals] };
  }
  if (score.cricket) {
    const { creator, opponent } = score.cricket;
    return {
      sport: 'cricket',
      c: [creator.runs, creator.wickets, creator.overs],
      o: [opponent.runs, opponent.wickets, opponent.overs],
    };
  }
  return { sport: 'unknown' };
}

export function validateScore(sport: SportType, score: ScorePayload): ValidationResult {
  switch (sport) {
    case SportType.BADMINTON:
      return validateBadminton(score);
    case SportType.FOOTBALL:
      return validateFootball(score);
    case SportType.CRICKET:
      return validateCricket(score);
  }
}

/**
 * BWF rules (edge_cases.md §58):
 *  - A game is won at 21, UNLESS tied at 20-all, then win by 2.
 *  - Hard cap 30: 30-29 is legal, 30-28 is not.
 *  - Best of 3: exactly 2 or 3 games, never 1, never 4.
 *  - 2 games => same side won both. 3 games => the first two were split.
 *  - A draw is impossible.
 */
function validateBadminton(score: ScorePayload): ValidationResult {
  const games = score.badminton?.games;
  if (!games) throw new BadRequestError('Badminton scores require games');

  if (games.length < 2 || games.length > 3) {
    throw new BadRequestError('A badminton match is best of 3 — enter 2 or 3 games');
  }

  const numbers = games.map((g) => g.gameNumber).sort((a, b) => a - b);
  const expected = games.map((_, i) => i + 1);
  if (JSON.stringify(numbers) !== JSON.stringify(expected)) {
    throw new BadRequestError('Games must be numbered consecutively from 1');
  }

  let creatorGames = 0;
  let opponentGames = 0;

  for (const game of [...games].sort((a, b) => a.gameNumber - b.gameNumber)) {
    validateBadmintonGame(game);
    if (game.creatorPoints > game.opponentPoints) creatorGames += 1;
    else opponentGames += 1;
  }

  if (games.length === 2 && creatorGames !== 2 && opponentGames !== 2) {
    throw new BadRequestError('A 2-game match must be won 2-0 by one side');
  }
  if (games.length === 3 && (creatorGames !== 2 && opponentGames !== 2)) {
    throw new BadRequestError('A 3-game match must end 2-1');
  }
  if (games.length === 3) {
    const first = games.find((g) => g.gameNumber === 1);
    const second = games.find((g) => g.gameNumber === 2);
    if (!first || !second) throw new BadRequestError('Missing game 1 or 2');
    const firstWinner = first.creatorPoints > first.opponentPoints ? 'creator' : 'opponent';
    const secondWinner = second.creatorPoints > second.opponentPoints ? 'creator' : 'opponent';
    if (firstWinner === secondWinner) {
      throw new BadRequestError('A third game is only played when the first two are split');
    }
  }

  return { winner: creatorGames > opponentGames ? 'creator' : 'opponent', isDraw: false };
}

function validateBadmintonGame(game: BadmintonGame): void {
  const { creatorPoints: a, opponentPoints: b } = game;
  const label = `Game ${String(game.gameNumber)}`;

  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    throw new BadRequestError(`${label}: points must be whole numbers`);
  }
  if (a === b) throw new BadRequestError(`${label}: a badminton game cannot be tied`);

  const high = Math.max(a, b);
  const low = Math.min(a, b);

  if (high > 30) throw new BadRequestError(`${label}: a game cannot go past 30 points`);
  if (high < 21) throw new BadRequestError(`${label}: the winner must reach at least 21`);

  /** At 30 the cap applies, so a 1-point win is the only legal ending. */
  if (high === 30) {
    if (low !== 29) {
      throw new BadRequestError(`${label}: at 30 the score can only be 30-29 (the cap)`);
    }
    return;
  }

  /** Below the cap: 21 wins outright unless the opponent reached 20. */
  if (high === 21) {
    if (low > 20) throw new BadRequestError(`${label}: invalid score ${String(a)}-${String(b)}`);
    return;
  }

  /** 22-29 only arise from a deuce, so must be exactly 2 clear. */
  if (high - low !== 2) {
    throw new BadRequestError(
      `${label}: past 21 a game is won by exactly 2 points (or 30-29 at the cap)`,
    );
  }
}

function validateFootball(score: ScorePayload): ValidationResult {
  const football = score.football;
  if (!football) throw new BadRequestError('Football scores require goals');

  const { creatorGoals, opponentGoals } = football;
  if (!Number.isInteger(creatorGoals) || !Number.isInteger(opponentGoals)) {
    throw new BadRequestError('Goals must be whole numbers');
  }
  if (creatorGoals < 0 || opponentGoals < 0) throw new BadRequestError('Goals cannot be negative');

  if (creatorGoals === opponentGoals) return { winner: null, isDraw: true };
  return { winner: creatorGoals > opponentGoals ? 'creator' : 'opponent', isDraw: false };
}

function validateCricket(score: ScorePayload): ValidationResult {
  const cricket = score.cricket;
  if (!cricket) throw new BadRequestError('Cricket scores require both innings');

  for (const [side, innings] of Object.entries(cricket)) {
    if (innings.runs < 0) throw new BadRequestError(`${side}: runs cannot be negative`);
    if (innings.wickets < 0 || innings.wickets > 10) {
      throw new BadRequestError(`${side}: wickets must be between 0 and 10`);
    }
    /** 12.6 is not a thing — the decimal is balls bowled, 0-5. */
    const balls = Math.round((innings.overs % 1) * 10);
    if (balls > 5) throw new BadRequestError(`${side}: an over has 6 balls, so .6 is invalid`);
  }

  if (cricket.creator.runs === cricket.opponent.runs) return { winner: null, isDraw: true };
  return {
    winner: cricket.creator.runs > cricket.opponent.runs ? 'creator' : 'opponent',
    isDraw: false,
  };
}
