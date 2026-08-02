import { describe, expect, it } from 'vitest';
import {
  awardPoint,
  isGameOver,
  replay,
  startMatch,
  toScorePayload,
  type RallyState,
} from './badminton-engine.js';
import { validateScore, type Side } from './score-validator.js';
import { SportType } from '../../models/index.js';

/** Plays `count` rallies for one side. */
function run(state: RallyState, to: Side, count: number): RallyState {
  let next = state;
  for (let i = 0; i < count; i += 1) next = awardPoint(next, to).state;
  return next;
}

/** Alternates rallies to reach a given tied score. */
function tieAt(state: RallyState, points: number): RallyState {
  let next = state;
  for (let i = 0; i < points; i += 1) {
    next = awardPoint(next, 'creator').state;
    next = awardPoint(next, 'opponent').state;
  }
  return next;
}

describe('game endings', () => {
  it('ends at 21 when the loser is on 19 or less', () => {
    expect(isGameOver({ creator: 21, opponent: 19 })).toBe(true);
  });

  it('does NOT end at 21-20 — win by two', () => {
    expect(isGameOver({ creator: 21, opponent: 20 })).toBe(false);
  });

  it('ends at 24-22 out of a deuce', () => {
    expect(isGameOver({ creator: 24, opponent: 22 })).toBe(true);
    expect(isGameOver({ creator: 23, opponent: 22 })).toBe(false);
  });

  it('ends at 30-29 — the hard cap overrides win-by-two', () => {
    expect(isGameOver({ creator: 30, opponent: 29 })).toBe(true);
  });
});

describe('a game in progress', () => {
  it('20-20 does not end the game; 21-20 does not either', () => {
    const state = tieAt(startMatch({ firstServer: 'creator' }), 20);
    expect(state.current).toEqual({ creator: 20, opponent: 20 });
    expect(state.games).toHaveLength(0);

    const at21 = awardPoint(state, 'creator');
    expect(at21.gameEnded).toBe(false);
    expect(at21.state.current).toEqual({ creator: 21, opponent: 20 });
  });

  it('takes the game at 22-20, two clear', () => {
    const state = tieAt(startMatch({ firstServer: 'creator' }), 20);
    const at21 = awardPoint(state, 'creator').state;
    const at22 = awardPoint(at21, 'creator');

    expect(at22.gameEnded).toBe(true);
    expect(at22.state.games[0]).toEqual({ creator: 22, opponent: 20 });
  });

  it('caps at 30-29 from 29-29', () => {
    const state = tieAt(startMatch({ firstServer: 'creator' }), 29);
    expect(state.current).toEqual({ creator: 29, opponent: 29 });

    const capped = awardPoint(state, 'opponent');
    expect(capped.gameEnded).toBe(true);
    expect(capped.state.games[0]).toEqual({ creator: 29, opponent: 30 });
  });
});

describe('serving', () => {
  it('gives the serve to whoever won the rally — rally-point scoring', () => {
    const state = startMatch({ firstServer: 'creator' });
    expect(awardPoint(state, 'opponent').state.serving).toBe('opponent');
    expect(awardPoint(state, 'creator').state.serving).toBe('creator');
  });

  it('hands first serve of the next game to the winner of the last', () => {
    let state = startMatch({ firstServer: 'creator' });
    state = run(state, 'opponent', 21);

    expect(state.games[0]).toEqual({ creator: 0, opponent: 21 });
    expect(state.serving).toBe('opponent');
    expect(state.currentGameNumber).toBe(2);
  });
});

describe('changing ends', () => {
  it('changes ends after every game', () => {
    let state = startMatch({ firstServer: 'creator' });
    state = run(state, 'creator', 20);
    const final = awardPoint(state, 'creator');

    expect(final.gameEnded).toBe(true);
    expect(final.changeEnds).toBe(true);
  });

  it('changes ends at 11 in the deciding game only', () => {
    // Game 1 to creator, game 2 to opponent -> game 3 decides.
    let state = startMatch({ firstServer: 'creator' });
    state = run(state, 'creator', 21);
    state = run(state, 'opponent', 21);
    expect(state.currentGameNumber).toBe(3);

    state = run(state, 'creator', 10);
    expect(state.decidingEndsSwapped).toBe(false);

    const eleventh = awardPoint(state, 'creator');
    expect(eleventh.changeEnds).toBe(true);
    expect(eleventh.state.decidingEndsSwapped).toBe(true);

    /** And never a second time in the same game. */
    const twelfth = awardPoint(eleventh.state, 'creator');
    expect(twelfth.changeEnds).toBe(false);
  });

  it('does not change ends at 11 in a non-deciding game', () => {
    let state = startMatch({ firstServer: 'creator' });
    state = run(state, 'creator', 10);
    expect(awardPoint(state, 'creator').changeEnds).toBe(false);
  });
});

describe('match completion', () => {
  it('is decided 2-0 without playing a third game', () => {
    let state = startMatch({ firstServer: 'creator' });
    state = run(state, 'creator', 21);
    state = run(state, 'creator', 21);

    expect(state.isComplete).toBe(true);
    expect(state.winner).toBe('creator');
    expect(state.games).toHaveLength(2);
  });

  it('goes to a third game when the first two are split', () => {
    let state = startMatch({ firstServer: 'creator' });
    state = run(state, 'creator', 21);
    state = run(state, 'opponent', 21);

    expect(state.isComplete).toBe(false);

    state = run(state, 'opponent', 21);
    expect(state.isComplete).toBe(true);
    expect(state.winner).toBe('opponent');
    expect(state.games).toHaveLength(3);
  });

  it('refuses another point once complete', () => {
    let state = startMatch({ firstServer: 'creator' });
    state = run(state, 'creator', 21);
    state = run(state, 'creator', 21);

    expect(() => awardPoint(state, 'creator')).toThrow(/already complete/u);
  });

  it('honours best-of-1 and best-of-5', () => {
    let one = startMatch({ bestOf: 1, firstServer: 'creator' });
    one = run(one, 'creator', 21);
    expect(one.isComplete).toBe(true);

    let five = startMatch({ bestOf: 5, firstServer: 'creator' });
    five = run(five, 'creator', 21);
    five = run(five, 'creator', 21);
    expect(five.isComplete).toBe(false);
    five = run(five, 'creator', 21);
    expect(five.isComplete).toBe(true);
  });

  it('rejects an even best-of', () => {
    expect(() => startMatch({ bestOf: 2, firstServer: 'creator' })).toThrow(/best of 1, 3 or 5/u);
  });
});

describe('replay — how undo works', () => {
  it('rebuilds the same state from a rally log', () => {
    const rallies: Side[] = [
      ...Array<Side>(21).fill('creator'),
      ...Array<Side>(21).fill('opponent'),
      ...Array<Side>(15).fill('creator'),
    ];
    const state = replay({ firstServer: 'creator', rallies });

    expect(state.games).toEqual([
      { creator: 21, opponent: 0 },
      { creator: 0, opponent: 21 },
    ]);
    expect(state.current).toEqual({ creator: 15, opponent: 0 });
    expect(state.isComplete).toBe(false);
  });

  it('undoing the game-winning rally reopens the game', () => {
    const rallies = Array<Side>(21).fill('creator');

    const won = replay({ firstServer: 'creator', rallies });
    expect(won.games).toHaveLength(1);

    /** Drop the last rally and replay — the game is live again at 20-0. */
    const undone = replay({ firstServer: 'creator', rallies: rallies.slice(0, -1) });
    expect(undone.games).toHaveLength(0);
    expect(undone.current).toEqual({ creator: 20, opponent: 0 });
  });

  it('undoing past 11 in the decider clears the ends-swapped flag', () => {
    const rallies: Side[] = [
      ...Array<Side>(21).fill('creator'),
      ...Array<Side>(21).fill('opponent'),
      ...Array<Side>(11).fill('creator'),
    ];
    expect(replay({ firstServer: 'creator', rallies }).decidingEndsSwapped).toBe(true);
    expect(replay({ firstServer: 'creator', rallies: rallies.slice(0, -1) }).decidingEndsSwapped).toBe(
      false,
    );
  });
});

describe('round-trip into the existing validator', () => {
  /**
   * The engine and score-validator must never disagree about who won. Two
   * paths to a result that can differ is exactly the hole officials exist to
   * close, so every finished match is handed straight to the validator.
   */
  it('a 2-0 match validates and agrees on the winner', () => {
    let state = startMatch({ firstServer: 'creator' });
    state = run(state, 'creator', 21);
    state = run(state, 'creator', 21);

    const result = validateScore(SportType.BADMINTON, toScorePayload(state));
    expect(result.winner).toBe(state.winner);
    expect(result.isDraw).toBe(false);
  });

  it('a 2-1 match that went to a deuce validates', () => {
    let state = startMatch({ firstServer: 'creator' });
    state = run(state, 'creator', 21);
    state = run(state, 'opponent', 21);
    state = tieAt(state, 20);
    state = run(state, 'creator', 2);

    expect(state.isComplete).toBe(true);
    expect(state.games[2]).toEqual({ creator: 22, opponent: 20 });

    const result = validateScore(SportType.BADMINTON, toScorePayload(state));
    expect(result.winner).toBe('creator');
  });

  it('a capped 30-29 game validates', () => {
    let state = startMatch({ firstServer: 'creator' });
    state = tieAt(state, 29);
    state = run(state, 'creator', 1);
    state = run(state, 'creator', 21);

    expect(state.games[0]).toEqual({ creator: 30, opponent: 29 });
    expect(validateScore(SportType.BADMINTON, toScorePayload(state)).winner).toBe('creator');
  });
});
