import type { Types } from 'mongoose';
import {
  ArenaModel,
  BookingModel,
  BookingSource,
  BookingStatus,
  ChallengeModel,
  DisputeModel,
  MatchModel,
  SettlementModel,
  type IArena,
  type IBooking,
  type IUser,
} from '../../models/index.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { istDayOfWeek, istStartOfDay } from '../../shared/utils/datetime.js';
import { publicId } from '../../shared/utils/ids.js';
import { assertCanAccessArena, accessibleArenaIds } from '../partner/partner.service.js';

/**
 * Weekly payouts to venues.
 *
 * The money model, stated once so the numbers on the panel can be explained to
 * an owner who disputes them:
 *
 *   gross        every ONLINE booking played in the period, at face value
 *   commission   our percentage of gross (arena.commissionPercent)
 *   refunds      money we already returned to players out of that gross
 *   adjustments  negative for pay-at-venue balances the venue collected at the
 *                gate — that cash never reached us, so we cannot send it on
 *   net payable  gross − commission − refunds + adjustments
 *
 * Walk-ins and desk bookings are excluded entirely: the venue took that money
 * directly and we charge no commission on it (partner pricing page).
 *
 * Bookings attached to an open dispute are held back rather than netted, so a
 * contested match cannot be paid out and then clawed back.
 */

/** Only bookings the venue actually hosted are owed for. */
const PAYABLE: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

/** We only hold the money for bookings that came through us. */
const ONLINE: BookingSource[] = [BookingSource.APP, BookingSource.WEB];

const OPEN_DISPUTE: IDisputeStatus[] = ['open', 'under_review', 'escalated'];
type IDisputeStatus = 'open' | 'under_review' | 'resolved' | 'escalated';

export interface SettlementTotals {
  grossPaise: number;
  commissionPaise: number;
  refundsPaise: number;
  adjustmentsPaise: number;
  netPayablePaise: number;
}

/**
 * Bookings whose match is still being argued about.
 *
 * The chain is dispute -> match -> challenge -> booking, because a dispute is
 * raised against a RESULT, not against the hour of turf it was played on.
 */
async function findDisputedBookingIds(bookings: IBooking[]): Promise<Set<string>> {
  if (bookings.length === 0) return new Set();

  const bookingIds = bookings.map((booking) => booking._id);
  const challenges = await ChallengeModel.find({ bookingId: { $in: bookingIds } })
    .select('_id bookingId')
    .lean();
  if (challenges.length === 0) return new Set();

  const matches = await MatchModel.find({ challengeId: { $in: challenges.map((c) => c._id) } })
    .select('_id challengeId')
    .lean();
  if (matches.length === 0) return new Set();

  const disputes = await DisputeModel.find({
    matchId: { $in: matches.map((m) => m._id) },
    status: { $in: OPEN_DISPUTE },
  })
    .select('matchId')
    .lean();
  if (disputes.length === 0) return new Set();

  const disputedMatchIds = new Set(disputes.map((d) => String(d.matchId)));
  const challengeByBooking = new Map(challenges.map((c) => [String(c._id), String(c.bookingId)]));

  const held = new Set<string>();
  for (const match of matches) {
    if (!disputedMatchIds.has(String(match._id))) continue;
    const bookingId = challengeByBooking.get(String(match.challengeId));
    if (bookingId) held.add(bookingId);
  }
  return held;
}

export function totalsFor(bookings: IBooking[], commissionPercent: number): SettlementTotals {
  const grossPaise = bookings.reduce((sum, booking) => sum + booking.totalPaise, 0);
  const refundsPaise = bookings.reduce((sum, booking) => sum + booking.refundPaise, 0);

  /** Cash the venue took at the gate. Negative: it never passed through us. */
  const collectedAtVenuePaise = bookings.reduce((sum, booking) => sum + booking.balanceDuePaise, 0);

  /** Rounded down — never over-charge commission on a rounding boundary. */
  const commissionPaise = Math.floor((grossPaise * commissionPercent) / 100);
  const adjustmentsPaise = -collectedAtVenuePaise;

  return {
    grossPaise,
    commissionPaise,
    refundsPaise,
    adjustmentsPaise,
    netPayablePaise: grossPaise - commissionPaise - refundsPaise + adjustmentsPaise,
  };
}

/**
 * Builds (or refreshes) one arena's settlement for a period.
 *
 * Idempotent by {arenaId, periodStart, periodEnd} — the model has a unique
 * index on it — and refuses to touch a settlement that has already been paid,
 * because re-deriving a payment that left the bank is not a correction, it is a
 * discrepancy.
 */
export async function buildSettlement(input: {
  arena: IArena;
  periodStart: Date;
  periodEnd: Date;
}) {
  const { arena, periodStart, periodEnd } = input;

  const existing = await SettlementModel.findOne({
    arenaId: arena._id,
    periodStart,
    periodEnd,
  });
  if (existing && existing.status !== 'draft') return existing;

  const bookings = await BookingModel.find({
    arenaId: arena._id,
    startAt: { $gte: periodStart, $lt: periodEnd },
    status: { $in: PAYABLE },
    source: { $in: ONLINE },
  }).lean<IBooking[]>();

  const heldIds = await findDisputedBookingIds(bookings);
  const payable = bookings.filter((booking) => !heldIds.has(String(booking._id)));
  const totals = totalsFor(payable, arena.commissionPercent);

  /**
   * A week with no online bookings owes nothing, and a ₹0 row in the owner's
   * payout history is worse than no row — it reads as a missed payment. If a
   * draft exists from an earlier sweep and has since emptied out, drop it.
   */
  if (bookings.length === 0) {
    if (existing) await existing.deleteOne();
    return null;
  }

  const fields = {
    arenaId: arena._id,
    periodStart,
    periodEnd,
    bookingIds: payable.map((booking) => booking._id),
    heldBookingIds: bookings
      .filter((booking) => heldIds.has(String(booking._id)))
      .map((booking) => booking._id),
    ...totals,
  };

  if (existing) {
    Object.assign(existing, fields);
    await existing.save();
    return existing;
  }

  return SettlementModel.create({ publicId: publicId('stl'), ...fields, status: 'draft' });
}

/** Runs every active arena for one period. Used by the weekly job. */
export async function generateSettlements(input: { periodStart: Date; periodEnd: Date }) {
  const arenas = await ArenaModel.find({ isActive: true });
  const built = [];
  for (const arena of arenas) {
    const settlement = await buildSettlement({ arena, ...input });
    /** null = nothing owed for that arena that week. */
    if (settlement) built.push(settlement);
  }
  return built;
}

/** Monday 00:00 IST of the week `instant` falls in. */
export function istWeekStart(instant: Date): Date {
  const startOfDay = istStartOfDay(instant);
  /** istDayOfWeek is 0=Sun; shift so Monday is day 0 of the payout week. */
  const daysSinceMonday = (istDayOfWeek(instant) + 6) % 7;
  return new Date(startOfDay.getTime() - daysSinceMonday * DAY_MS);
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Bookings can still be cancelled and refunded after the slot date, so a
    period is not final the moment it ends (partner pricing page: T+3). */
const SETTLEMENT_DELAY_MS = 3 * DAY_MS;

/** How far back a fresh deployment catches up. Idempotent, so re-running is safe. */
const BACKFILL_WEEKS = 8;

/**
 * Builds every completed period that is past T+3 and not yet paid.
 *
 * Safe to run on any cadence: buildSettlement is keyed on
 * {arena, periodStart, periodEnd} and refuses to rewrite anything that has
 * left draft, so repeated sweeps re-derive drafts and leave paid rows alone.
 */
export async function runSettlementSweep(now: Date = new Date()): Promise<number> {
  const currentWeekStart = istWeekStart(now);
  let built = 0;

  for (let weeksBack = 1; weeksBack <= BACKFILL_WEEKS; weeksBack += 1) {
    const periodStart = new Date(currentWeekStart.getTime() - weeksBack * WEEK_MS);
    const periodEnd = new Date(periodStart.getTime() + WEEK_MS);

    if (now.getTime() < periodEnd.getTime() + SETTLEMENT_DELAY_MS) continue;

    const settlements = await generateSettlements({ periodStart, periodEnd });
    built += settlements.length;
  }

  return built;
}

export async function listOwnerSettlements(user: IUser) {
  const arenaIds = await accessibleArenaIds(user);

  return SettlementModel.find({ arenaId: { $in: arenaIds } })
    .sort({ periodStart: -1 })
    .limit(52)
    .lean();
}

/** One payout, with the bookings that make it up — the whole point of §7. */
export async function getOwnerSettlement(user: IUser, settlementPublicId: string) {
  const settlement = await SettlementModel.findOne({ publicId: settlementPublicId }).lean();
  if (!settlement) throw new NotFoundError('Settlement');

  await assertCanAccessArena(user, settlement.arenaId as Types.ObjectId);

  const [bookings, heldBookings] = await Promise.all([
    BookingModel.find({ _id: { $in: settlement.bookingIds } })
      .select('publicId startAt endAt sport totalPaise refundPaise balanceDuePaise source status')
      .sort({ startAt: 1 })
      .lean(),
    BookingModel.find({ _id: { $in: settlement.heldBookingIds } })
      .select('publicId startAt endAt sport totalPaise status')
      .sort({ startAt: 1 })
      .lean(),
  ]);

  return { ...settlement, bookings, heldBookings };
}
