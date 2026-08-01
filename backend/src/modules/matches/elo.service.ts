import { env } from '../../shared/config/env.js';

/**
 * Standard Elo. Ratings are computed from the values SNAPSHOTTED at match
 * start, never live ones — two matches settling concurrently would otherwise
 * corrupt each other (edge_cases.md §68).
 *
 * Voided matches never reach this module (§69).
 */

export interface EloOutcome {
  creatorAfter: number;
  opponentAfter: number;
  creatorDelta: number;
  opponentDelta: number;
}

/** Probability that A beats B, given their ratings. */
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function computeElo(input: {
  creatorBefore: number;
  opponentBefore: number;
  /** 1 = creator won, 0 = opponent won, 0.5 = draw. */
  creatorResult: 1 | 0 | 0.5;
  kFactor?: number;
}): EloOutcome {
  const k = input.kFactor ?? env.ELO_K_FACTOR;

  const expectedCreator = expectedScore(input.creatorBefore, input.opponentBefore);
  const expectedOpponent = 1 - expectedCreator;
  const opponentResult = 1 - input.creatorResult;

  const creatorDelta = Math.round(k * (input.creatorResult - expectedCreator));
  const opponentDelta = Math.round(k * (opponentResult - expectedOpponent));

  return {
    creatorAfter: input.creatorBefore + creatorDelta,
    opponentAfter: input.opponentBefore + opponentDelta,
    creatorDelta,
    opponentDelta,
  };
}

export function resultFromWinner(winner: 'creator' | 'opponent' | null): 1 | 0 | 0.5 {
  if (winner === 'creator') return 1;
  if (winner === 'opponent') return 0;
  return 0.5;
}
