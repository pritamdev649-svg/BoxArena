import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { clearDatabase, startTestDatabase, stopTestDatabase } from '../../test/setup.js';
import {
  ArenaModel,
  BookingStatus,
  CourtModel,
  SlotModel,
  SlotStatus,
  SportType,
  TransactionModel,
  UserModel,
  WalletBucket,
  type IUser,
} from '../../models/index.js';
import { publicId, referralCode } from '../../shared/utils/ids.js';
import { confirmBooking, holdSlots, releaseExpiredHolds } from './booking.service.js';

/**
 * The tests that matter most. If these pass on a standalone mongod they prove
 * nothing — see test/setup.ts.
 */

beforeAll(async () => {
  await startTestDatabase();
});

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await clearDatabase();
});

async function makeUser(depositPaise = 1_000_000): Promise<IUser> {
  return UserModel.create({
    publicId: publicId('usr'),
    phoneNumber: `+9198${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`,
    fullName: 'Test Player',
    referralCode: referralCode(),
    wallet: { depositPaise, winningsPaise: 0, bonusPaise: 0, lockedPaise: 0 },
  });
}

async function makeSlot(pricePaise = 120_000) {
  const owner = await makeUser();
  const arena = await ArenaModel.create({
    publicId: publicId('arn'),
    name: 'The Turf Arena',
    slug: `turf-${publicId('a')}`,
    ownerId: owner._id,
    address: {
      line1: 'Vibhuti Khand',
      areaName: 'Gomti Nagar',
      city: 'Lucknow',
      state: 'Uttar Pradesh',
      pincode: '226010',
    },
    location: { type: 'Point', coordinates: [81.0035, 26.8607] },
    sportsSupported: [SportType.FOOTBALL],
    contactPhone: '+919876543210',
  });

  const court = await CourtModel.create({
    arenaId: arena._id,
    name: 'Turf A',
    sport: SportType.FOOTBALL,
    basePricePerHourPaise: pricePaise,
  });

  /** Two hours from now clears MIN_BOOKING_LEAD_MINUTES comfortably. */
  const startAt = new Date(Date.now() + 2 * 3_600_000);
  const slot = await SlotModel.create({
    arenaId: arena._id,
    courtId: court._id,
    sport: SportType.FOOTBALL,
    startAt,
    endAt: new Date(startAt.getTime() + 3_600_000),
    localDate: '2026-08-14',
    pricePaise,
  });

  return { arena, court, slot };
}

describe('slot booking concurrency — edge_cases.md §12', () => {
  it('lets exactly ONE of 50 simultaneous holds win', async () => {
    const { slot } = await makeSlot();
    const users = await Promise.all(Array.from({ length: 50 }, () => makeUser()));

    const results = await Promise.allSettled(
      users.map((user) =>
        holdSlots({ user, slotIds: [String(slot._id)], expectedTotalPaise: 120_000 }),
      ),
    );

    const won = results.filter((r) => r.status === 'fulfilled');
    const lost = results.filter((r) => r.status === 'rejected');

    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(49);

    const finalSlot = await SlotModel.findById(slot._id);
    expect(finalSlot?.status).toBe(SlotStatus.HELD);
  });

  it('charges nobody who lost the race', async () => {
    const { slot } = await makeSlot();
    const users = await Promise.all(Array.from({ length: 10 }, () => makeUser()));

    await Promise.allSettled(
      users.map(async (user) => {
        await holdSlots({ user, slotIds: [String(slot._id)], expectedTotalPaise: 120_000 });
        return confirmBooking({
          user,
          slotIds: [String(slot._id)],
          idempotencyKey: `idem-${user.publicId}`,
        });
      }),
    );

    const debits = await TransactionModel.countDocuments({ amountPaise: { $lt: 0 } });
    expect(debits).toBe(1);

    /** Exactly one wallet moved; the other nine are untouched. */
    const charged = await UserModel.countDocuments({ 'wallet.depositPaise': { $lt: 1_000_000 } });
    expect(charged).toBe(1);
  });

  it('rejects a stale price rather than silently charging more (§24)', async () => {
    const { slot } = await makeSlot();
    const user = await makeUser();

    await expect(
      holdSlots({ user, slotIds: [String(slot._id)], expectedTotalPaise: 100_000 }),
    ).rejects.toMatchObject({ code: 'PRICE_CHANGED' });
  });

  it('returns the ORIGINAL booking when an idempotency key is replayed (§25)', async () => {
    const { slot } = await makeSlot();
    const user = await makeUser();

    await holdSlots({ user, slotIds: [String(slot._id)], expectedTotalPaise: 120_000 });

    const first = await confirmBooking({
      user,
      slotIds: [String(slot._id)],
      idempotencyKey: 'same-key',
    });
    const second = await confirmBooking({
      user,
      slotIds: [String(slot._id)],
      idempotencyKey: 'same-key',
    });

    expect(String(second._id)).toBe(String(first._id));
    expect(await TransactionModel.countDocuments()).toBe(1);
  });

  it('confirms a booking and debits exactly once', async () => {
    const { slot } = await makeSlot();
    const user = await makeUser();

    await holdSlots({ user, slotIds: [String(slot._id)], expectedTotalPaise: 120_000 });
    const booking = await confirmBooking({
      user,
      slotIds: [String(slot._id)],
      idempotencyKey: 'confirm-once',
    });

    expect(booking.status).toBe(BookingStatus.CONFIRMED);
    expect(booking.checkInCode).toMatch(/^\d{6}$/u);

    const after = await UserModel.findById(user._id);
    expect(after?.wallet.depositPaise).toBe(1_000_000 - 120_000);

    const ledger = await TransactionModel.find({ userId: user._id });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.amountPaise).toBe(-120_000);
    expect(ledger[0]?.bucket).toBe(WalletBucket.DEPOSIT);
    /** balanceAfterPaise makes the ledger replayable. */
    expect(ledger[0]?.balanceAfterPaise).toBe(880_000);
  });
});

describe('abandoned holds — edge_cases.md §13', () => {
  it('releases a lapsed hold so the slot becomes bookable again', async () => {
    const { slot } = await makeSlot();
    const user = await makeUser();

    await holdSlots({ user, slotIds: [String(slot._id)], expectedTotalPaise: 120_000 });

    /** Simulate the user force-quitting the app mid-checkout. */
    await SlotModel.updateOne(
      { _id: slot._id },
      { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
    );

    expect(await releaseExpiredHolds()).toBe(1);

    const released = await SlotModel.findById(slot._id);
    expect(released?.status).toBe(SlotStatus.AVAILABLE);
    expect(released?.heldByUserId).toBeUndefined();
  });

  it('refuses to confirm against an expired hold (§14)', async () => {
    const { slot } = await makeSlot();
    const user = await makeUser();

    await holdSlots({ user, slotIds: [String(slot._id)], expectedTotalPaise: 120_000 });
    await SlotModel.updateOne(
      { _id: slot._id },
      { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
    );

    await expect(
      confirmBooking({ user, slotIds: [String(slot._id)], idempotencyKey: 'late' }),
    ).rejects.toMatchObject({ code: 'SLOT_UNAVAILABLE' });

    expect(await TransactionModel.countDocuments()).toBe(0);
  });
});

describe('unique index is the last line of defence', () => {
  it('prevents two slots existing for the same court and start time', async () => {
    const { court, arena, slot } = await makeSlot();
    await SlotModel.syncIndexes();

    await expect(
      SlotModel.create({
        arenaId: arena._id,
        courtId: court._id,
        sport: SportType.FOOTBALL,
        startAt: slot.startAt,
        endAt: slot.endAt,
        localDate: slot.localDate,
        pricePaise: 120_000,
      }),
    ).rejects.toThrow();
  });
});

describe('mongoose transactions are real here', () => {
  it('is connected to a replica set, so sessions actually apply', async () => {
    const info = (await mongoose.connection.db?.admin().command({ hello: 1 })) as {
      setName?: string;
    };
    expect(info.setName).toBeTruthy();
  });
});
