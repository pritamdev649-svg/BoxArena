import { SportType } from '../../models/index.js';
import { env } from './env.js';
import { BadRequestError } from '../errors/app-error.js';

/**
 * Three different scopes, deliberately separate.
 *
 * They are not the same question, and collapsing them is how a venue owner
 * ends up unable to list the football pitch they own:
 *
 *   bookable   what a VENUE may list and a player may book — everything
 *   challenge  what a COMPETITIVE CHALLENGE may be posted in — badminton only
 *   scorable   what an OFFICIAL may score rally-by-rally — badminton only
 *
 * Each narrows the one above it. Booking a cricket pitch is fine; staking
 * money on a cricket result is not, because nothing verifies that result to
 * the standard the prize model needs.
 */

function known(values: string[]): SportType[] {
  return values.filter((sport): sport is SportType =>
    Object.values(SportType).includes(sport as SportType),
  );
}

/** Everything a venue can sell. */
export function bookableSports(): SportType[] {
  return known(env.BOOKABLE_SPORTS);
}

/** What a challenge can be posted in. */
export function challengeSports(): SportType[] {
  return known(env.CHALLENGE_SPORTS);
}

export function assertBookableSport(sport: SportType): void {
  if (bookableSports().includes(sport)) return;
  throw new BadRequestError(`${sport} is not available on BoxArena.`);
}

/**
 * Guards challenge creation.
 *
 * The message names what IS open rather than only refusing — someone who has
 * just booked a cricket pitch and tried to post a challenge on it needs to
 * know the booking is still fine.
 */
export function assertChallengeSport(sport: SportType): void {
  if (challengeSports().includes(sport)) return;
  throw new BadRequestError(
    `Challenges are ${challengeSports().join(' and ')} only for now. ` +
      `Your ${sport} booking is unaffected — you can still play, just not stake on it here yet.`,
  );
}

/**
 * Sports an official can score rally-by-rally.
 *
 * Cricket's engine — balls, overs, wickets rather than rallies — is on hold:
 * the log -> set -> match shape from `games_rule/badminton.md §8` is meant to
 * carry over, but nothing has been built for it, and a half-implemented
 * cricket scoreboard settling money would be worse than none.
 */
export function isLiveScorable(sport: SportType): boolean {
  return env.LIVE_SCORING_SPORTS.includes(sport);
}

export function liveScorableSports(): SportType[] {
  return known(env.LIVE_SCORING_SPORTS);
}
