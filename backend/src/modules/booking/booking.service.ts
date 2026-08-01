import type { ClientSession, Types } from 'mongoose';
import {
  ArenaModel,
  BookingModel,
  BookingSource,
  BookingStatus,
  SlotModel,
  SlotStatus,
  TransactionType,
  type IBooking,
  type ISlot,
  type IUser,
} from '../../models/index.js';
import { withTransaction } from '../../shared/config/db.js';
import { env } from '../../shared/config/env.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  SlotUnavailableError,
} from '../../shared/errors/app-error.js';
import { checkInCode, publicId } from '../../shared/utils/ids.js';
import { debitWallet } from '../wallet/wallet.service.js';

/**
 * Booking. The concurrency battleground — read edge_cases.md §2 before
 * changing anything here.
 *
 * Two-phase by design: HOLD then CONFIRM. Holding first means we never take
 * money for a slot we cannot deliver, and an abandoned checkout self-heals via
 * holdExpiresAt rather than depending on the client to release.
 */

export interface HoldResult {
  slots: ISlot[];
  totalPaise: number;
  holdExpiresAt: Date;
}

/**
 * Acquires every requested slot ATOMICALLY, or none.
 *
 * Three defences stack here:
 *  1. The conditional update below — the primary guard.
 *  2. Sorted acquisition order, so two users grabbing overlapping ranges from
 *     opposite ends deadlock-free (§15).
 *  3. The unique index {courtId, startAt} as a last resort (§12).
 *
 * NEVER rewrite this as read-then-write; the gap between read and write is
 * exactly the double-booking window.
 */
export async function holdSlots(input: {
  user: IUser;
  slotIds: string[];
  expectedTotalPaise: number;
}): Promise<HoldResult> {
  if (input.slotIds.length === 0) throw new BadRequestError('Select at least one slot');
  if (input.slotIds.length > 6) throw new BadRequestError('Book at most 6 hours at a time');

  return withTransaction(async (session) => {
    const slots = await SlotModel.find({ _id: { $in: input.slotIds } })
      .sort({ startAt: 1 })
      .session(session);

    if (slots.length !== input.slotIds.length) throw new NotFoundError('Slot');

    assertBookable(slots);
    assertContiguousSameCourt(slots);

    const totalPaise = slots.reduce((sum, s) => sum + s.pricePaise, 0);

    /**
     * The price the client displayed must still be the price we charge.
     * Silently charging more is never acceptable (§24).
     */
    if (totalPaise !== input.expectedTotalPaise) {
      throw new ConflictError('PRICE_CHANGED', 'The price for these slots changed', {
        newTotalPaise: totalPaise,
      });
    }

    const holdExpiresAt = new Date(Date.now() + env.SLOT_HOLD_DURATION_SECONDS * 1000);

    for (const slot of slots) {
      const claimed = await SlotModel.findOneAndUpdate(
        { _id: slot._id, status: SlotStatus.AVAILABLE },
        {
          $set: {
            status: SlotStatus.HELD,
            heldByUserId: input.user._id,
            holdExpiresAt,
          },
          $inc: { version: 1 },
        },
        { returnDocument: 'after', session },
      );

      /** Lost the race. The transaction aborts, releasing any earlier claims. */
      if (!claimed) throw new SlotUnavailableError();
    }

    const held = await SlotModel.find({ _id: { $in: input.slotIds } })
      .sort({ startAt: 1 })
      .session(session);

    return { slots: held, totalPaise, holdExpiresAt };
  });
}

function assertBookable(slots: ISlot[]): void {
  const now = new Date();
  const earliestAllowed = new Date(now.getTime() + env.MIN_BOOKING_LEAD_MINUTES * 60_000);

  for (const slot of slots) {
    if (slot.startAt <= now) throw new BadRequestError('That slot has already started');
    if (slot.startAt < earliestAllowed) {
      throw new BadRequestError(
        `Slots must be booked at least ${String(env.MIN_BOOKING_LEAD_MINUTES)} minutes in advance`,
      );
    }
    if (slot.status === SlotStatus.BLOCKED) {
      throw new SlotUnavailableError('That slot is blocked by the venue');
    }
  }
}

/** Multi-hour bookings must be one court and contiguous (§15). */
function assertContiguousSameCourt(slots: ISlot[]): void {
  const first = slots[0];
  if (!first) throw new BadRequestError('Select at least one slot');

  const courtId = String(first.courtId);
  if (slots.some((s) => String(s.courtId) !== courtId)) {
    throw new BadRequestError('All slots must be on the same court');
  }

  for (let i = 1; i < slots.length; i += 1) {
    const previous = slots[i - 1];
    const current = slots[i];
    if (!previous || !current) continue;
    if (previous.endAt.getTime() !== current.startAt.getTime()) {
      throw new BadRequestError('Selected hours must be back to back');
    }
  }
}

export interface ConfirmBookingInput {
  user: IUser;
  slotIds: string[];
  idempotencyKey: string;
  isPayAtVenue?: boolean;
  source?: BookingSource;
  recordedByUserId?: Types.ObjectId;
}

/**
 * Confirms a held booking: charges the wallet and flips slots to BOOKED.
 * Everything happens in one transaction — a charge without a booking, or a
 * booking without a charge, are both unrecoverable.
 */
export async function confirmBooking(input: ConfirmBookingInput): Promise<IBooking> {
  /** Replaying the same key returns the ORIGINAL booking, never a second one (§25). */
  const existing = await BookingModel.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) return existing;

  return withTransaction(async (session) => {
    const slots = await SlotModel.find({ _id: { $in: input.slotIds } })
      .sort({ startAt: 1 })
      .session(session);

    if (slots.length !== input.slotIds.length) throw new NotFoundError('Slot');

    const first = slots[0];
    const last = slots[slots.length - 1];
    if (!first || !last) throw new BadRequestError('Select at least one slot');

    assertHoldStillValid(slots, input.user._id as Types.ObjectId);

    const arena = await ArenaModel.findById(first.arenaId).session(session);
    if (!arena) throw new NotFoundError('Arena');

    const subtotalPaise = slots.reduce((sum, s) => sum + s.pricePaise, 0);
    const payAtVenue = input.isPayAtVenue === true;

    if (payAtVenue && arena.bookingMode !== 'pay_at_venue_allowed') {
      throw new BadRequestError('This venue requires payment in advance');
    }

    /**
     * Pay-at-venue takes a forfeitable deposit rather than the full amount.
     * Without it the arena carries all the no-show risk (§116).
     */
    const chargeNowPaise = payAtVenue
      ? Math.floor((subtotalPaise * arena.depositPercent) / 100)
      : subtotalPaise;
    const balanceDuePaise = subtotalPaise - chargeNowPaise;

    if (chargeNowPaise > 0) {
      await debitWallet(
        {
          user: input.user,
          amountPaise: chargeNowPaise,
          type: TransactionType.BOOKING_FEE,
          description: `Booking at ${arena.name}`,
          idempotencyKey: `booking:${input.idempotencyKey}`,
        },
        session,
      );
    }

    const [booking] = await BookingModel.create(
      [
        {
          publicId: publicId('bkg'),
          arenaId: first.arenaId,
          courtId: first.courtId,
          slotIds: slots.map((s) => s._id),
          bookerId: input.user._id,
          sport: first.sport,
          startAt: first.startAt,
          endAt: last.endAt,
          subtotalPaise,
          totalPaise: subtotalPaise,
          paidFromWalletPaise: chargeNowPaise,
          status: BookingStatus.CONFIRMED,
          source: input.source ?? BookingSource.APP,
          isPayAtVenue: payAtVenue,
          depositPaidPaise: payAtVenue ? chargeNowPaise : 0,
          balanceDuePaise,
          idempotencyKey: input.idempotencyKey,
          checkInCode: checkInCode(),
          ...(input.recordedByUserId === undefined
            ? {}
            : { recordedByUserId: input.recordedByUserId }),
        },
      ],
      { session },
    );

    if (!booking) throw new Error('Booking creation returned nothing');

    await SlotModel.updateMany(
      { _id: { $in: input.slotIds } },
      {
        $set: { status: SlotStatus.BOOKED, bookingId: booking._id },
        $unset: { heldByUserId: '', holdExpiresAt: '' },
      },
      { session },
    );

    return booking;
  });
}

/**
 * A hold can lapse between hold and confirm — the user's payment sheet was
 * open too long, or they backgrounded the app (§14).
 */
function assertHoldStillValid(slots: ISlot[], userId: Types.ObjectId): void {
  const now = new Date();
  for (const slot of slots) {
    if (slot.status === SlotStatus.BOOKED) {
      throw new SlotUnavailableError('That slot was booked by someone else');
    }
    if (slot.status !== SlotStatus.HELD) {
      throw new SlotUnavailableError('Your hold on that slot has expired');
    }
    if (String(slot.heldByUserId) !== String(userId)) {
      throw new SlotUnavailableError('That slot is held by someone else');
    }
    if (!slot.holdExpiresAt || slot.holdExpiresAt < now) {
      throw new SlotUnavailableError('Your hold expired. Please select the slot again.');
    }
  }
}

/**
 * Sweeper for abandoned checkouts. Never rely on the client to release a hold —
 * a force-quit app never sends anything (§13).
 */
export async function releaseExpiredHolds(now: Date = new Date()): Promise<number> {
  const result = await SlotModel.updateMany(
    { status: SlotStatus.HELD, holdExpiresAt: { $lt: now } },
    {
      $set: { status: SlotStatus.AVAILABLE },
      $unset: { heldByUserId: '', holdExpiresAt: '' },
    },
  );
  return result.modifiedCount;
}

/**
 * Refund tiers are computed against the SLOT START TIME, not booking creation
 * (§20). Arena-initiated cancellations always refund in full regardless of
 * policy — arena fault is not user fault (§19).
 */
export function computeRefundPaise(input: {
  paidPaise: number;
  startAt: Date;
  freeCancellationHours: number;
  partialRefundPercent: number;
  cancelledByArena: boolean;
  now?: Date;
}): number {
  if (input.cancelledByArena) return input.paidPaise;

  const now = input.now ?? new Date();
  if (now >= input.startAt) return 0;

  const hoursUntilStart = (input.startAt.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntilStart >= input.freeCancellationHours) return input.paidPaise;

  return Math.floor((input.paidPaise * input.partialRefundPercent) / 100);
}

export async function cancelBooking(input: {
  bookingId: string;
  cancelledBy: IUser;
  reason: string;
  byArena?: boolean;
}): Promise<IBooking> {
  return withTransaction(async (session: ClientSession) => {
    const booking = await BookingModel.findById(input.bookingId).session(session);
    if (!booking) throw new NotFoundError('Booking');

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestError('This booking cannot be cancelled');
    }

    const arena = await ArenaModel.findById(booking.arenaId).session(session);
    if (!arena) throw new NotFoundError('Arena');

    const refundPaise = computeRefundPaise({
      paidPaise: booking.paidFromWalletPaise,
      startAt: booking.startAt,
      freeCancellationHours: arena.cancellationPolicy.freeCancellationHours,
      partialRefundPercent: arena.cancellationPolicy.partialRefundPercent,
      cancelledByArena: input.byArena === true,
    });

    if (refundPaise > 0) {
      const { applyLedgerEntry } = await import('../wallet/wallet.service.js');
      const { WalletBucket } = await import('../../models/index.js');
      await applyLedgerEntry(
        {
          userId: booking.bookerId,
          bucket: WalletBucket.DEPOSIT,
          amountPaise: refundPaise,
          type: TransactionType.BOOKING_REFUND,
          description: `Refund for booking ${booking.publicId}`,
          idempotencyKey: `refund:${booking.publicId}`,
          referenceType: 'Booking',
          referenceId: booking._id as Types.ObjectId,
        },
        session,
      );
    }

    booking.status = input.byArena
      ? BookingStatus.CANCELLED_BY_ARENA
      : BookingStatus.CANCELLED_BY_USER;
    booking.cancelledAt = new Date();
    booking.cancelledBy = input.cancelledBy._id as Types.ObjectId;
    booking.cancellationReason = input.reason;
    booking.refundPaise = refundPaise;
    await booking.save({ session });

    await SlotModel.updateMany(
      { _id: { $in: booking.slotIds } },
      { $set: { status: SlotStatus.AVAILABLE }, $unset: { bookingId: '' } },
      { session },
    );

    return booking;
  });
}
