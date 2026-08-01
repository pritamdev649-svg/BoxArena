import type { Types } from 'mongoose';
import { ArenaModel, CourtModel, SlotModel, SlotStatus, SportType, ChallengeModel, ChallengeStatus, BookingModel, ReviewModel, BookingStatus, MatchModel, MatchStatus, type IUser } from '../../models/index.js';
import { env } from '../../shared/config/env.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/errors/app-error.js';

/** Arena discovery, including the geo search the Maps key exists for. */

export interface NearbyQuery {
  lat: number;
  lng: number;
  radiusKm?: number;
  sport?: SportType;
  limit?: number;
}


export function assertWithinIndia(lng: number, lat: number): void {
  if (lng < 68 || lng > 98 || lat < 6 || lat > 38) {
    throw new BadRequestError(
      'Coordinates fall outside India. GeoJSON order is [longitude, latitude] — check they are not swapped.',
    );
  }
}

/** Powers /arenas/nearby via the 2dsphere index. */
export async function findNearby(query: NearbyQuery) {
  assertWithinIndia(query.lng, query.lat);

  const radiusKm = Math.min(query.radiusKm ?? 10, env.GEO_MAX_RADIUS_KM);

  return ArenaModel.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [query.lng, query.lat] },
        distanceField: 'distanceMeters',
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: {
          isActive: true,
          ...(query.sport ? { sportsSupported: query.sport } : {}),
        },
      },
    },
    { $limit: Math.min(query.limit ?? 20, 50) },
    {
      $project: {
        publicId: 1, name: 1, slug: 1, images: 1, amenities: 1,
        sportsSupported: 1, rating: 1, distanceMeters: 1,
        'address.areaName': 1, 'address.formattedAddress': 1,
        location: 1, isVerified: 1,
      },
    },
  ]);
}

export async function listArenas(filter: { areaName?: string; sport?: SportType; limit?: number }) {
  const arenas = await ArenaModel.find({
    isActive: true,
    ...(filter.areaName ? { 'address.areaName': filter.areaName } : {}),
    ...(filter.sport ? { sportsSupported: filter.sport } : {}),
  })
    .select('publicId name slug images amenities sportsSupported rating address isVerified')
    .limit(Math.min(filter.limit ?? 20, 50))
    .lean();

  const arenaIds = arenas.map((a) => a._id);
  const courts = await CourtModel.find({ arenaId: { $in: arenaIds }, isActive: true }).lean();

  const courtsByArena = new Map<string, typeof courts>();
  for (const court of courts) {
    const key = String(court.arenaId);
    const bucket = courtsByArena.get(key);
    if (bucket) bucket.push(court);
    else courtsByArena.set(key, [court]);
  }

  return arenas.map((arena) => ({
    ...arena,
    courts: courtsByArena.get(String(arena._id)) ?? [],
  }));
}

/**
 * Venue activity, counted from what actually happened here.
 *
 * Every number is derived on read rather than kept as a counter on the arena —
 * a denormalised counter that drifts is worse than no counter, because the
 * venue page then argues with the bookings list. These are cheap indexed
 * counts, and the page is the only caller.
 */
export interface ArenaStats {
  /** Only settled results. A scheduled match has not been played yet. */
  matchesPlayed: number;
  /** Distinct people who actually turned up, not booking rows. */
  playersHosted: number;
  hoursBooked: number;
  openChallenges: number;
  courtCount: number;
}

/** A match that reached a result. Voided and disputed ones did not happen. */
const SETTLED_MATCH: MatchStatus[] = [
  MatchStatus.VERIFIED,
  MatchStatus.ADMIN_RESOLVED,
  MatchStatus.WALKOVER,
];

/** Money changed hands and the court was held. Cancellations are excluded. */
const HONOURED_BOOKING: BookingStatus[] = [BookingStatus.CONFIRMED, BookingStatus.COMPLETED];

export async function getArenaStats(arenaId: Types.ObjectId): Promise<ArenaStats> {
  const [matchesPlayed, players, hoursBooked, openChallenges, courtCount] = await Promise.all([
    MatchModel.countDocuments({ arenaId, status: { $in: SETTLED_MATCH } }),
    BookingModel.distinct('bookerId', { arenaId, status: { $in: HONOURED_BOOKING } }),
    BookingModel.countDocuments({ arenaId, status: { $in: HONOURED_BOOKING } }),
    ChallengeModel.countDocuments({
      arenaId,
      status: ChallengeStatus.OPEN,
      matchExpiresAt: { $gt: new Date() },
    }),
    CourtModel.countDocuments({ arenaId, isActive: true }),
  ]);

  return {
    matchesPlayed,
    playersHosted: players.length,
    hoursBooked,
    openChallenges,
    courtCount,
  };
}

export async function getArenaBySlug(slug: string) {
  const arena = await ArenaModel.findOne({ slug, isActive: true }).lean();
  if (!arena) throw new NotFoundError('Arena');

  const arenaId = arena._id as Types.ObjectId;
  const [courts, stats, recentReviews] = await Promise.all([
    CourtModel.find({ arenaId, isActive: true }).lean(),
    getArenaStats(arenaId),
    /** A preview, so the page renders reviews without a second round trip. */
    ReviewModel.find({ arenaId, isHidden: false })
      .sort({ _id: -1 })
      .limit(3)
      .populate('userId', 'fullName avatarUrl')
      .lean(),
  ]);

  return { ...arena, courts, stats, recentReviews };
}

/**
 * The landing page's "top venues" strip.
 *
 * Ordered by rating, but a 5.0 from one review is not better than a 4.6 from
 * ninety — so unreviewed and barely-reviewed venues sort below rated ones
 * instead of topping the list on a single friendly review.
 */
export async function listTopArenas(input: { limit?: number | undefined; sport?: SportType | undefined }) {
  const limit = Math.min(input.limit ?? 4, 12);

  const arenas = await ArenaModel.find({
    isActive: true,
    isVerified: true,
    ...(input.sport ? { sportsSupported: input.sport } : {}),
  })
    .select('publicId name slug images amenities sportsSupported rating address isVerified')
    .sort({ 'rating.count': -1, 'rating.average': -1 })
    .limit(limit)
    .lean();

  return Promise.all(
    arenas.map(async (arena) => {
      const arenaId = arena._id as Types.ObjectId;
      const [courts, stats] = await Promise.all([
        CourtModel.find({ arenaId, isActive: true })
          .select('name sport basePricePerHourPaise')
          .lean(),
        getArenaStats(arenaId),
      ]);
      return { ...arena, courts, stats };
    }),
  );
}


export async function getSlotsForDay(input: {
  arenaPublicId: string;
  localDate: string;
  sport?: SportType | undefined;
}) {
  const arena = await ArenaModel.findOne({ publicId: input.arenaPublicId }).lean();
  if (!arena) throw new NotFoundError('Arena');

  const slots = await SlotModel.find({
    arenaId: arena._id,
    localDate: input.localDate,
    ...(input.sport ? { sport: input.sport } : {}),
  })
    .select('courtId sport startAt endAt status pricePaise')
    .sort({ startAt: 1 })
    .lean();

  const byCourt = new Map<string, typeof slots>();
  for (const slot of slots) {
    const key = String(slot.courtId);
    const bucket = byCourt.get(key);
    if (bucket) bucket.push(slot);
    else byCourt.set(key, [slot]);
  }

  return Array.from(byCourt.entries()).map(([courtId, courtSlots]) => ({
    courtId,
    slots: courtSlots.map((s) => ({
      id: String(s._id),
      startAt: s.startAt,
      endAt: s.endAt,
      status: s.status === SlotStatus.HELD ? SlotStatus.BOOKED : s.status,
      pricePaise: s.pricePaise,
    })),
  }));
}

/**
 * Returns all active/open challenges hosted at the specified arena.
 */
export async function getChallengesForArena(input: {
  arenaPublicId: string;
  sport?: SportType | undefined;
  limit?: number | undefined;
}) {
  const arena = await ArenaModel.findOne({ publicId: input.arenaPublicId, isActive: true }).lean();
  if (!arena) throw new NotFoundError('Arena');

  return ChallengeModel.find({
    arenaId: arena._id,
    status: ChallengeStatus.OPEN,
    matchExpiresAt: { $gt: new Date() },
    ...(input.sport ? { sport: input.sport } : {}),
  })
    .sort({ startAt: 1 })
    .limit(Math.min(input.limit ?? 20, 50))
    .lean();
}

export async function getArenaReviews(input: {
  arenaPublicId: string;
  limit?: number | undefined;
  after?: string | undefined;
}) {
  const arena = await ArenaModel.findOne({ publicId: input.arenaPublicId, isActive: true }).lean();
  if (!arena) throw new NotFoundError('Arena');

  const limit = Math.min(input.limit ?? 20, 50);
  const after = input.after;

  const reviews = await ReviewModel.find({
    arenaId: arena._id,
    isHidden: false,
    ...(after ? { _id: { $lt: after } } : {}),
  })
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('userId', 'fullName avatarUrl')
    .lean();

  const hasMore = reviews.length > limit;
  const page = hasMore ? reviews.slice(0, limit) : reviews;
  const last = page[page.length - 1];

  return {
    reviews: page,
    nextCursor: hasMore && last ? String(last._id) : null,
  };
}

export async function createArenaReview(input: {
  user: IUser;
  arenaPublicId: string;
  bookingPublicId: string;
  rating: number;
  comment?: string;
}) {
  const arena = await ArenaModel.findOne({ publicId: input.arenaPublicId, isActive: true });
  if (!arena) throw new NotFoundError('Arena');

  const booking = await BookingModel.findOne({ publicId: input.bookingPublicId });
  if (!booking) throw new NotFoundError('Booking');

  if (String(booking.bookerId) !== String(input.user._id)) {
    throw new ForbiddenError('This is not your booking');
  }

  /** The booking must be AT this venue — otherwise one completed booking
      anywhere would buy you a review on every arena in the city. */
  if (String(booking.arenaId) !== String(arena._id)) {
    throw new BadRequestError('That booking is not for this venue');
  }

  if (booking.status !== BookingStatus.COMPLETED) {
    const isPastConfirmed = booking.status === BookingStatus.CONFIRMED && new Date(booking.startAt).getTime() < Date.now();
    if (!isPastConfirmed) {
      throw new BadRequestError('You can only review an arena after completing your booking');
    }
  }

  const existing = await ReviewModel.findOne({
    bookingId: booking._id,
    userId: input.user._id,
  });
  if (existing) {
    throw new BadRequestError('You have already reviewed this booking');
  }

  const review = await ReviewModel.create({
    arenaId: arena._id,
    userId: input.user._id,
    bookingId: booking._id,
    rating: input.rating,
    ...(input.comment !== undefined ? { comment: input.comment } : {}),
  });

  const rating = await recomputeArenaRating(arena._id as Types.ObjectId);
  return { review, rating };
}

/**
 * Recomputes `arena.rating` from the reviews themselves.
 *
 * Incrementing a running average is tempting and wrong: hiding a review (ops
 * does this for abuse) or deleting one would leave the stored average
 * permanently out of step with the list of reviews shown right beneath it. A
 * venue has tens of reviews, not millions, so we just average them.
 */
export async function recomputeArenaRating(
  arenaId: Types.ObjectId,
): Promise<{ average: number; count: number }> {
  const [summary] = await ReviewModel.aggregate<{ average: number; count: number }>([
    { $match: { arenaId, isHidden: false } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const rating = {
    /** One decimal — the UI renders `4.6`, so storing 4.5999… invites drift. */
    average: summary ? Math.round(summary.average * 10) / 10 : 0,
    count: summary?.count ?? 0,
  };

  await ArenaModel.updateOne({ _id: arenaId }, { $set: { rating } });
  return rating;
}
