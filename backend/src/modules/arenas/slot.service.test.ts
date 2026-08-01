import type { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  ArenaModel,
  CourtModel,
  PricingRuleModel,
  SlotModel,
  SlotStatus,
  SportType,
} from '../../models/index.js';
import { clearDatabase, startTestDatabase, stopTestDatabase } from '../../test/setup.js';
import { istDayOfWeek, toLocalDate } from '../../shared/utils/datetime.js';
import { materialiseAllArenaSlots, materialiseArenaSlots } from './slot.service.js';

/**
 * End-to-end proof that the operating-hours template actually becomes priced,
 * bookable inventory — the pipeline arena_onboarding.md §4 describes.
 */

const BASE_PRICE = 30_000;
const EVENING_PRICE = 42_000;

beforeAll(async () => {
  await startTestDatabase();
  /**
   * Idempotency here rests entirely on the unique {courtId, startAt} index.
   * Mongoose builds indexes lazily in the background, so without this the
   * first inserts can win the race and duplicate slots appear.
   */
  await SlotModel.init();
});

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await clearDatabase();
});

async function seedArena(options: { openTime?: string; closeTime?: string } = {}) {
  const arena = await ArenaModel.create({
    publicId: 'arn_test',
    name: 'Gomti Nagar Sports Arena',
    slug: 'gomti-nagar-sports-arena',
    ownerId: new (await import('mongoose')).Types.ObjectId(),
    address: {
      line1: 'Vibhuti Khand',
      areaName: 'Gomti Nagar',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      pincode: '226010',
    },
    location: { type: 'Point', coordinates: [81.0, 26.85] },
    sportsSupported: [SportType.BADMINTON],
    operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      openTime: options.openTime ?? '06:00',
      closeTime: options.closeTime ?? '23:00',
      isClosed: false,
    })),
    contactPhone: '+919876543210',
    isVerified: true,
    isActive: true,
  });

  const court = await CourtModel.create({
    arenaId: arena._id,
    name: 'Court 1',
    sport: SportType.BADMINTON,
    basePricePerHourPaise: BASE_PRICE,
  });

  return { arena, court, arenaId: arena._id as Types.ObjectId };
}

describe('slot materialisation', () => {
  it('expands the weekly template into hourly slots', async () => {
    const { arenaId } = await seedArena();

    const created = await materialiseArenaSlots({ arenaId, daysAhead: 3 });

    expect(created).toBeGreaterThan(0);
    const slots = await SlotModel.find({ arenaId }).lean();
    expect(slots).toHaveLength(created);
    expect(slots.every((slot) => slot.status === SlotStatus.AVAILABLE)).toBe(true);
  });

  it('never materialises the past', async () => {
    const { arenaId } = await seedArena();
    await materialiseArenaSlots({ arenaId, daysAhead: 2 });

    const slots = await SlotModel.find({ arenaId }).lean();
    expect(slots.every((slot) => slot.startAt.getTime() >= Date.now() - 60_000)).toBe(true);
  });

  it('is idempotent — a second pass creates no duplicates', async () => {
    const { arenaId } = await seedArena();
    const first = await materialiseArenaSlots({ arenaId, daysAhead: 3 });
    const second = await materialiseArenaSlots({ arenaId, daysAhead: 3 });

    expect(second).toBe(0);
    expect(await SlotModel.countDocuments({ arenaId })).toBe(first);
  });

  it('extends the window on a later pass instead of starting over', async () => {
    const { arenaId } = await seedArena();
    const threeDays = await materialiseArenaSlots({ arenaId, daysAhead: 3 });
    const added = await materialiseArenaSlots({ arenaId, daysAhead: 5 });

    expect(added).toBeGreaterThan(0);
    expect(await SlotModel.countDocuments({ arenaId })).toBe(threeDays + added);
  });

  it('prices slots from the pricing bands, not just the court base rate', async () => {
    const { arenaId, court } = await seedArena();
    await PricingRuleModel.create({
      arenaId,
      appliesTo: 'custom_days',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: '16:00',
      endTime: '23:00',
      pricePerHourPaise: EVENING_PRICE,
    });

    await materialiseArenaSlots({ arenaId, daysAhead: 3 });

    const slots = await SlotModel.find({ arenaId, courtId: court._id }).lean();
    const evening = slots.filter((slot) => {
      const hour = Number(slot.startAt.toISOString().slice(11, 13));
      /** 16:00 IST is 10:30 UTC; compare in IST terms via localDate + hour. */
      return hourInIst(slot.startAt) >= 16 && hourInIst(slot.startAt) < 23 && hour >= 0;
    });
    const morning = slots.filter((slot) => hourInIst(slot.startAt) < 16);

    expect(evening.length).toBeGreaterThan(0);
    expect(morning.length).toBeGreaterThan(0);
    expect(evening.every((slot) => slot.pricePaise === EVENING_PRICE)).toBe(true);
    expect(morning.every((slot) => slot.pricePaise === BASE_PRICE)).toBe(true);
  });

  it('skips days the venue is closed', async () => {
    const { arenaId, arena } = await seedArena();
    const closedDay = 1;
    arena.operatingHours = arena.operatingHours.map((h) =>
      h.dayOfWeek === closedDay ? { ...h, isClosed: true } : h,
    );
    await arena.save();

    await materialiseArenaSlots({ arenaId, daysAhead: 7 });

    const slots = await SlotModel.find({ arenaId }).lean();
    expect(slots.some((slot) => istDayOfWeek(slot.startAt) === closedDay)).toBe(false);
  });

  it('sweeps every live arena in one pass', async () => {
    const { arenaId } = await seedArena();
    const total = await materialiseAllArenaSlots();

    expect(total).toBeGreaterThan(0);
    expect(await SlotModel.countDocuments({ arenaId })).toBe(total);
  });

  it('ignores arenas that are not live', async () => {
    const { arena } = await seedArena();
    arena.isVerified = false;
    await arena.save();

    expect(await materialiseAllArenaSlots()).toBe(0);
  });
});

/** IST hour of an instant, derived from the same helper the resolver uses. */
function hourInIst(instant: Date): number {
  const localDate = toLocalDate(instant);
  const offsetMs = instant.getTime() - Date.parse(`${localDate}T00:00:00+05:30`);
  return Math.floor(offsetMs / 3_600_000);
}
