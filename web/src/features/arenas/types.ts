import type { SeedCourt, Sport } from '@/mocks/seed/arenas';

export const SPORTS: readonly Sport[] = ['cricket', 'football', 'badminton'];

/**
 * Narrows an API string to a known sport.
 *
 * Sport IS a closed set — unlike an area name — because each one drives a
 * distinct accent colour and scoring engine. An unrecognised value is dropped
 * rather than rendered with a broken style.
 */
export function isSport(value: string): value is Sport {
  return (SPORTS as readonly string[]).includes(value);
}

/**
 * What an arena looks like to this feature's components.
 *
 * Deliberately NOT `SeedArena`. That type comes from the mock fixture and
 * narrows `areaName` to the eight seeded Lucknow areas, so real API data — where
 * an area is any string an owner typed during onboarding — cannot flow through
 * a component typed against it. A UI card must not be constrained by the shape
 * of the test data.
 *
 * `SeedArena` is assignable to this (narrow → wide), so fixtures keep working.
 */
export interface ArenaSummary {
  publicId: string;
  slug: string;
  name: string;
  areaName: string;
  addressLine: string;
  /** GeoJSON order: [longitude, latitude]. */
  coordinates: [number, number];
  sports: Sport[];
  amenities: string[];
  rating: { average: number; count: number };
  courts: SeedCourt[];
  openTime: string;
  closeTime: string;
  isVerified: boolean;
  bookingMode: 'prepaid_only' | 'pay_at_venue_allowed';
  freeCancellationHours: number;
}
