import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';
import type { IPricingRule } from '../../models/index.js';
import { istDateTimeToUtc } from '../../shared/utils/datetime.js';
import { resolvePricePaise, type PriceContext } from './pricing.service.js';

/**
 * Pure resolution logic — no database. The band an hour lands in is the single
 * most common source of "why did it charge that?" tickets
 * (arena_onboarding.md §4 step 5), so it is worth pinning precisely.
 */

const COURT_ID = new Types.ObjectId();
const OTHER_COURT_ID = new Types.ObjectId();

const court = { _id: COURT_ID, basePricePerHourPaise: 30_000 };

/** 2026-08-15 is a Saturday — used to prove holiday outranks weekend. */
const SATURDAY_HOLIDAY = '2026-08-15';
const PLAIN_SATURDAY = '2026-08-22';
const PLAIN_TUESDAY = '2026-08-18';

function rule(overrides: Partial<IPricingRule>): IPricingRule {
  return {
    arenaId: new Types.ObjectId(),
    appliesTo: 'weekday',
    daysOfWeek: [],
    startTime: '00:00',
    endTime: '00:00',
    pricePerHourPaise: 0,
    priority: 0,
    isActive: true,
    ...overrides,
  } as IPricingRule;
}

function contextOf(rules: IPricingRule[], holidays: string[] = []): PriceContext {
  return { rules, holidays: new Set(holidays) };
}

function priceAt(localDate: string, time: string, context: PriceContext): number {
  return resolvePricePaise({ court, startAt: istDateTimeToUtc(localDate, time), context });
}

describe('pricing resolution', () => {
  it('falls back to the court base price when nothing matches', () => {
    expect(priceAt(PLAIN_TUESDAY, '10:00', contextOf([]))).toBe(30_000);
  });

  it('applies a weekday band inside its window only', () => {
    const context = contextOf([
      rule({ appliesTo: 'weekday', startTime: '09:00', endTime: '16:00', pricePerHourPaise: 30_000 }),
      rule({ appliesTo: 'weekday', startTime: '16:00', endTime: '23:00', pricePerHourPaise: 42_000 }),
    ]);
    expect(priceAt(PLAIN_TUESDAY, '10:00', context)).toBe(30_000);
    expect(priceAt(PLAIN_TUESDAY, '18:00', context)).toBe(42_000);
  });

  it('does not apply a weekday band on a weekend', () => {
    const context = contextOf([
      rule({ appliesTo: 'weekday', startTime: '06:00', endTime: '23:00', pricePerHourPaise: 42_000 }),
    ]);
    expect(priceAt(PLAIN_SATURDAY, '18:00', context)).toBe(30_000);
  });

  /** B4's done-when. */
  it('lets a holiday band beat a weekend band on the same day', () => {
    const context = contextOf(
      [
        rule({ appliesTo: 'weekend', startTime: '06:00', endTime: '23:00', pricePerHourPaise: 50_000 }),
        rule({ appliesTo: 'holiday', startTime: '06:00', endTime: '23:00', pricePerHourPaise: 55_000 }),
      ],
      [SATURDAY_HOLIDAY],
    );
    expect(priceAt(SATURDAY_HOLIDAY, '18:00', context)).toBe(55_000);
    /** The very same rules on an ordinary Saturday fall back to the weekend rate. */
    expect(priceAt(PLAIN_SATURDAY, '18:00', context)).toBe(50_000);
  });

  it('lets a specific date beat a holiday', () => {
    const context = contextOf(
      [
        rule({ appliesTo: 'holiday', startTime: '06:00', endTime: '23:00', pricePerHourPaise: 55_000 }),
        rule({
          appliesTo: 'specific_date',
          specificDate: SATURDAY_HOLIDAY,
          startTime: '06:00',
          endTime: '23:00',
          pricePerHourPaise: 70_000,
        }),
      ],
      [SATURDAY_HOLIDAY],
    );
    expect(priceAt(SATURDAY_HOLIDAY, '18:00', context)).toBe(70_000);
  });

  it('lets an explicit priority override specificity', () => {
    const context = contextOf(
      [
        rule({ appliesTo: 'holiday', startTime: '06:00', endTime: '23:00', pricePerHourPaise: 55_000 }),
        rule({
          appliesTo: 'weekend',
          startTime: '06:00',
          endTime: '23:00',
          pricePerHourPaise: 90_000,
          priority: 10,
        }),
      ],
      [SATURDAY_HOLIDAY],
    );
    expect(priceAt(SATURDAY_HOLIDAY, '18:00', context)).toBe(90_000);
  });

  it('ignores bands scoped to a different court', () => {
    const context = contextOf([
      rule({
        appliesTo: 'weekday',
        courtId: OTHER_COURT_ID,
        startTime: '06:00',
        endTime: '23:00',
        pricePerHourPaise: 99_000,
      }),
    ]);
    expect(priceAt(PLAIN_TUESDAY, '18:00', context)).toBe(30_000);
  });

  it('prefers a court-scoped band over an arena-wide one at equal specificity', () => {
    const context = contextOf([
      rule({ appliesTo: 'weekday', startTime: '06:00', endTime: '23:00', pricePerHourPaise: 40_000 }),
      rule({
        appliesTo: 'weekday',
        courtId: COURT_ID,
        startTime: '06:00',
        endTime: '23:00',
        pricePerHourPaise: 46_000,
      }),
    ]);
    expect(priceAt(PLAIN_TUESDAY, '18:00', context)).toBe(46_000);
  });

  it('treats endTime "00:00" as end of day, not start', () => {
    const context = contextOf([
      rule({ appliesTo: 'weekday', startTime: '22:00', endTime: '00:00', pricePerHourPaise: 25_000 }),
    ]);
    expect(priceAt(PLAIN_TUESDAY, '23:00', context)).toBe(25_000);
  });

  it('respects validFrom / validTo', () => {
    const context = contextOf([
      rule({
        appliesTo: 'weekday',
        startTime: '06:00',
        endTime: '23:00',
        pricePerHourPaise: 60_000,
        validTo: istDateTimeToUtc('2026-08-17', '00:00'),
      }),
    ]);
    expect(priceAt(PLAIN_TUESDAY, '18:00', context)).toBe(30_000);
  });

  it('matches custom_days only on the listed days', () => {
    const context = contextOf([
      rule({
        appliesTo: 'custom_days',
        daysOfWeek: [2],
        startTime: '06:00',
        endTime: '23:00',
        pricePerHourPaise: 33_000,
      }),
    ]);
    expect(priceAt(PLAIN_TUESDAY, '18:00', context)).toBe(33_000);
    expect(priceAt(PLAIN_SATURDAY, '18:00', context)).toBe(30_000);
  });
});
