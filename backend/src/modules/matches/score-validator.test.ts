import { describe, expect, it } from 'vitest';
import { SportType } from '../../models/enums.js';
import {
  normaliseToCreatorFrame,
  scoresAgree,
  validateScore,
  type ScorePayload,
} from './score-validator.js';

const games = (...pairs: [number, number][]): ScorePayload => ({
  badminton: {
    games: pairs.map(([creatorPoints, opponentPoints], i) => ({
      gameNumber: i + 1,
      creatorPoints,
      opponentPoints,
    })),
  },
});

describe('badminton validity — edge_cases.md §58', () => {
  it('accepts a straight-games win', () => {
    expect(validateScore(SportType.BADMINTON, games([21, 18], [21, 15]))).toEqual({
      winner: 'creator',
      isDraw: false,
    });
  });

  it('accepts a three-game match decided 2-1', () => {
    expect(validateScore(SportType.BADMINTON, games([21, 18], [19, 21], [21, 15]))).toEqual({
      winner: 'creator',
      isDraw: false,
    });
  });

  it('accepts 30-29 at the cap', () => {
    expect(() => validateScore(SportType.BADMINTON, games([30, 29], [21, 10]))).not.toThrow();
  });

  it('REJECTS 30-28 — the cap allows only a one-point win', () => {
    expect(() => validateScore(SportType.BADMINTON, games([30, 28], [21, 10]))).toThrow(/30-29/u);
  });

  it('accepts a deuce won by exactly two', () => {
    expect(() => validateScore(SportType.BADMINTON, games([23, 21], [21, 12]))).not.toThrow();
  });

  it('rejects a deuce won by more than two', () => {
    expect(() => validateScore(SportType.BADMINTON, games([24, 21], [21, 12]))).toThrow(
      /exactly 2 points/u,
    );
  });

  it('rejects a winner below 21', () => {
    expect(() => validateScore(SportType.BADMINTON, games([19, 17], [21, 10]))).toThrow(
      /at least 21/u,
    );
  });

  it('rejects a tied game', () => {
    expect(() => validateScore(SportType.BADMINTON, games([21, 21], [21, 10]))).toThrow(
      /cannot be tied/u,
    );
  });

  it('rejects a single game — a match is best of 3', () => {
    expect(() => validateScore(SportType.BADMINTON, games([21, 18]))).toThrow(/best of 3/u);
  });

  it('rejects four games', () => {
    expect(() =>
      validateScore(SportType.BADMINTON, games([21, 18], [18, 21], [21, 15], [21, 10])),
    ).toThrow(/best of 3/u);
  });

  it('rejects a 3-0 "three-game match" — it should have ended at 2-0', () => {
    expect(() => validateScore(SportType.BADMINTON, games([21, 18], [21, 15], [21, 10]))).toThrow(
      /must end 2-1/u,
    );
  });

  it('rejects a third game when the first two were not split', () => {
    // Creator takes games 1 and 2, so game 3 should never have been played —
    // even though the 2-1 tally itself looks legal.
    expect(() => validateScore(SportType.BADMINTON, games([21, 18], [21, 15], [10, 21]))).toThrow(
      /only played when the first two are split/u,
    );
  });
});

describe('perspective normalisation — edge_cases.md §56', () => {
  /**
   * THE bug this whole mechanism exists to prevent: without normalisation,
   * two honest players describing the same result would create a dispute and
   * freeze their money.
   */
  it('treats 21-18 from the creator and 18-21 from the opponent as AGREEMENT', () => {
    const fromCreator = games([21, 18], [21, 15]);
    const fromOpponent = games([18, 21], [15, 21]);

    const a = normaliseToCreatorFrame(fromCreator, 'creator');
    const b = normaliseToCreatorFrame(fromOpponent, 'opponent');

    expect(scoresAgree(a, b)).toBe(true);
  });

  it('still detects a genuine disagreement', () => {
    const a = normaliseToCreatorFrame(games([21, 18], [21, 15]), 'creator');
    // The opponent claims THEY won 21-18, 21-15.
    const b = normaliseToCreatorFrame(games([21, 18], [21, 15]), 'opponent');
    expect(scoresAgree(a, b)).toBe(false);
  });

  it('is order-insensitive across games', () => {
    const inOrder: ScorePayload = {
      badminton: {
        games: [
          { gameNumber: 1, creatorPoints: 21, opponentPoints: 18 },
          { gameNumber: 2, creatorPoints: 21, opponentPoints: 15 },
        ],
      },
    };
    const reversed: ScorePayload = {
      badminton: {
        games: [
          { gameNumber: 2, creatorPoints: 21, opponentPoints: 15 },
          { gameNumber: 1, creatorPoints: 21, opponentPoints: 18 },
        ],
      },
    };
    expect(scoresAgree(inOrder, reversed)).toBe(true);
  });

  it('flips football goals', () => {
    const flipped = normaliseToCreatorFrame(
      { football: { creatorGoals: 3, opponentGoals: 1 } },
      'opponent',
    );
    expect(flipped.football).toEqual({ creatorGoals: 1, opponentGoals: 3 });
  });
});

describe('football', () => {
  it('allows a draw', () => {
    expect(
      validateScore(SportType.FOOTBALL, { football: { creatorGoals: 2, opponentGoals: 2 } }),
    ).toEqual({ winner: null, isDraw: true });
  });

  it('rejects negative goals', () => {
    expect(() =>
      validateScore(SportType.FOOTBALL, { football: { creatorGoals: -1, opponentGoals: 2 } }),
    ).toThrow(/negative/u);
  });
});

describe('cricket — edge_cases.md §59', () => {
  const innings = (runs: number, wickets: number, overs: number) => ({ runs, wickets, overs });

  it('accepts a normal innings', () => {
    expect(
      validateScore(SportType.CRICKET, {
        cricket: { creator: innings(120, 6, 12.4), opponent: innings(118, 8, 12) },
      }),
    ).toEqual({ winner: 'creator', isDraw: false });
  });

  it('rejects 11 wickets', () => {
    expect(() =>
      validateScore(SportType.CRICKET, {
        cricket: { creator: innings(120, 11, 12), opponent: innings(118, 8, 12) },
      }),
    ).toThrow(/wickets/u);
  });

  it('rejects 12.6 overs — an over has 6 balls', () => {
    expect(() =>
      validateScore(SportType.CRICKET, {
        cricket: { creator: innings(120, 6, 12.6), opponent: innings(118, 8, 12) },
      }),
    ).toThrow(/6 balls/u);
  });
});
