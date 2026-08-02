import { BadRequestError } from '../../shared/errors/app-error.js';
import type { Side } from './score-validator.js';

/**
 * Rally-by-rally badminton state machine.
 *
 * Deliberately PURE — no database, no clock, no I/O. Given a state and "who
 * won the rally", it returns the next state. That makes every BWF rule here
 * unit-testable without a match existing, and it means the official's device
 * can never state a score: it sends "point to A" and this decides what that
 * means (games_rule/badminton.md §2).
 *
 * Scores are held in the CREATOR's frame throughout, matching
 * score-validator.ts, so a derived result can be handed straight to
 * validateBadminton without a flip.
 *
 * ## The rules encoded
 *
 * - A game is to 21, win by 2, hard cap 30 (so 30-29 ends it, 30-28 cannot happen).
 * - Rally-point scoring: **the side that wins a rally serves the next one.**
 *   There is no "serve retained only on your own serve" — that is the pre-2006
 *   system.
 * - The winner of a game serves first in the next game.
 * - Ends are changed after every game, and in the deciding game the moment a
 *   side reaches 11.
 * - Best-of-N is configurable (1, 3, 5); a side needs `ceil(N / 2)` games.
 * - Draws are impossible.
 */

export interface GameScore {
  creator: number;
  opponent: number;
}

export interface RallyState {
  /** 1, 3 or 5. Default 3 (games_rule §2). */
  bestOf: number;
  /** Completed games, in order. */
  games: GameScore[];
  /** The game in progress. Meaningless once `isComplete`. */
  current: GameScore;
  /** 1-based. */
  currentGameNumber: number;
  /** Who serves the NEXT rally. */
  serving: Side;
  /**
   * True once ends have been swapped in the deciding game. Tracked rather
   * than derived because it happens once, at 11, and must not re-fire if the
   * score passes 11 again after a correction.
   */
  decidingEndsSwapped: boolean;
  isComplete: boolean;
  winner: Side | null;
  /**
   * Which service court the server delivers from.
   *
   * Derived from the SERVER's own score: even -> right, odd -> left. Not
   * stored, because deriving it means a corrected score can never leave the
   * diagram showing the wrong half of the court.
   */
  serveCourt: ServiceCourt;
  /**
   * Doubles only: index (0 or 1) of the player serving within the serving
   * pair, and where each pair currently stands.
   *
   * Badminton doubles has no "server rotation" of its own — a pair only swaps
   * courts when it WINS a point while serving. Receivers never move. Modelling
   * it as a swap-on-serving-win is the whole rule.
   */
  doubles: DoublesPositions | null;
}

export type ServiceCourt = 'right' | 'left';

/**
 * Which player of each pair occupies the right-hand service court.
 * The partner is implicitly in the left.
 */
export interface DoublesPositions {
  creatorRightIndex: 0 | 1;
  opponentRightIndex: 0 | 1;
}

/** What changed on the last rally — the UI needs this to prompt the official. */
export interface RallyOutcome {
  state: RallyState;
  gameEnded: boolean;
  matchEnded: boolean;
  /** Set when ends must be changed: after a game, or at 11 in the decider. */
  changeEnds: boolean;
}

const POINTS_TO_WIN = 21;
const HARD_CAP = 30;
/** Ends change in the deciding game when either side reaches this. */
const DECIDER_SWAP_AT = 11;

const ALLOWED_BEST_OF = [1, 3, 5];

export function gamesNeededToWin(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

/** Server's own score decides the court: even right, odd left. */
export function serveCourtFor(score: GameScore, serving: Side): ServiceCourt {
  return (serving === 'creator' ? score.creator : score.opponent) % 2 === 0 ? 'right' : 'left';
}

export function startMatch(input: {
  bestOf?: number;
  firstServer: Side;
  isDoubles?: boolean;
}): RallyState {
  const bestOf = input.bestOf ?? 3;
  if (!ALLOWED_BEST_OF.includes(bestOf)) {
    throw new BadRequestError('A match must be best of 1, 3 or 5 games');
  }

  const current = { creator: 0, opponent: 0 };

  return {
    bestOf,
    games: [],
    current,
    currentGameNumber: 1,
    serving: input.firstServer,
    decidingEndsSwapped: false,
    isComplete: false,
    winner: null,
    serveCourt: serveCourtFor(current, input.firstServer),
    doubles: input.isDoubles ? { creatorRightIndex: 0, opponentRightIndex: 0 } : null,
  };
}

/** A game is over at 21 with a 2-point margin, or the instant someone hits 30. */
export function isGameOver(score: GameScore): boolean {
  const high = Math.max(score.creator, score.opponent);
  const low = Math.min(score.creator, score.opponent);

  if (high >= HARD_CAP) return true;
  return high >= POINTS_TO_WIN && high - low >= 2;
}

function gameWinner(score: GameScore): Side {
  return score.creator > score.opponent ? 'creator' : 'opponent';
}

export function gamesWon(state: RallyState): { creator: number; opponent: number } {
  return state.games.reduce(
    (tally, game) => {
      if (game.creator > game.opponent) tally.creator += 1;
      else tally.opponent += 1;
      return tally;
    },
    { creator: 0, opponent: 0 },
  );
}

/** True when this game decides the match — the last game a match can go to. */
function isDecidingGame(state: RallyState): boolean {
  const needed = gamesNeededToWin(state.bestOf);
  const tally = gamesWon(state);
  return tally.creator === needed - 1 && tally.opponent === needed - 1;
}

/**
 * The whole engine: award one rally and return what follows.
 *
 * Never mutates the input — a corrected match is replayed from its point log,
 * so states must be safe to keep and discard.
 */
export function awardPoint(state: RallyState, to: Side): RallyOutcome {
  if (state.isComplete) {
    throw new BadRequestError('This match is already complete');
  }

  const current: GameScore = {
    creator: state.current.creator + (to === 'creator' ? 1 : 0),
    opponent: state.current.opponent + (to === 'opponent' ? 1 : 0),
  };

  /**
   * Rally-point scoring: winning the rally wins the serve.
   *
   * In doubles the serving pair swaps courts ONLY when it wins a point while
   * already serving. A pair that wins the serve back does not rotate — the
   * player standing in the correct court for the new score serves.
   */
  const heldServe = state.serving === to;
  const doubles = state.doubles && heldServe ? swapPair(state.doubles, to) : state.doubles;

  const next: RallyState = {
    ...state,
    current,
    serving: to,
    serveCourt: serveCourtFor(current, to),
    doubles,
  };

  if (!isGameOver(current)) {
    /**
     * Ends change once in the deciding game, when a side first reaches 11.
     * Guarded by the flag so a correction that dips back below 11 and climbs
     * again does not ask the players to swap twice.
     */
    const reachedEleven = Math.max(current.creator, current.opponent) >= DECIDER_SWAP_AT;
    const swapNow = isDecidingGame(state) && reachedEleven && !state.decidingEndsSwapped;

    return {
      state: swapNow ? { ...next, decidingEndsSwapped: true } : next,
      gameEnded: false,
      matchEnded: false,
      changeEnds: swapNow,
    };
  }

  // --- the game just ended -------------------------------------------------

  const winnerOfGame = gameWinner(current);
  const games = [...state.games, current];
  const tally = games.reduce(
    (acc, game) => {
      if (game.creator > game.opponent) acc.creator += 1;
      else acc.opponent += 1;
      return acc;
    },
    { creator: 0, opponent: 0 },
  );

  const needed = gamesNeededToWin(state.bestOf);
  const matchEnded = tally.creator >= needed || tally.opponent >= needed;

  return {
    state: {
      ...state,
      games,
      current: { creator: 0, opponent: 0 },
      currentGameNumber: state.currentGameNumber + 1,
      /** The winner of a game serves first in the next. */
      serving: winnerOfGame,
      serveCourt: 'right',
      /** Fresh game, fresh line-up positions. */
      doubles: state.doubles ? { creatorRightIndex: 0, opponentRightIndex: 0 } : null,
      decidingEndsSwapped: false,
      isComplete: matchEnded,
      winner: matchEnded ? (tally.creator > tally.opponent ? 'creator' : 'opponent') : null,
    },
    gameEnded: true,
    matchEnded,
    /** Ends change after every game — including the last, harmlessly. */
    changeEnds: true,
  };
}

function swapPair(positions: DoublesPositions, side: Side): DoublesPositions {
  const flip = (index: 0 | 1): 0 | 1 => (index === 0 ? 1 : 0);
  return side === 'creator'
    ? { ...positions, creatorRightIndex: flip(positions.creatorRightIndex) }
    : { ...positions, opponentRightIndex: flip(positions.opponentRightIndex) };
}

/**
 * Rebuilds state by replaying a point log from the start.
 *
 * This is how undo works: drop the last rally and replay, rather than trying
 * to invert a transition. Inverting is where the subtle bugs live — a
 * subtracted point cannot know whether it also un-ended a game or un-swapped
 * ends, but a replay never has to ask.
 */
export function replay(input: {
  bestOf?: number;
  firstServer: Side;
  isDoubles?: boolean;
  rallies: Side[];
}): RallyState {
  return input.rallies.reduce<RallyState>(
    (state, winner) => awardPoint(state, winner).state,
    startMatch({
      ...(input.bestOf === undefined ? {} : { bestOf: input.bestOf }),
      ...(input.isDoubles === undefined ? {} : { isDoubles: input.isDoubles }),
      firstServer: input.firstServer,
    }),
  );
}

/**
 * The completed games, shaped for `validateScore`.
 *
 * The bridge between this engine and the existing validator: a live-scored
 * match must survive exactly the same checks as a hand-entered one, or the
 * two paths can disagree about who won — which is the trust hole the whole
 * officials feature exists to close.
 */
export function toScorePayload(state: RallyState): {
  badminton: { games: { gameNumber: number; creatorPoints: number; opponentPoints: number }[] };
} {
  return {
    badminton: {
      games: state.games.map((game, index) => ({
        gameNumber: index + 1,
        creatorPoints: game.creator,
        opponentPoints: game.opponent,
      })),
    },
  };
}
