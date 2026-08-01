import { ArenaModel, CourtModel, SlotModel, SlotStatus, SportType, ChallengeModel, ChallengeStatus, BookingModel, ReviewModel, BookingStatus, type IUser } from '../../models/index.js';
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

export async function getArenaBySlug(slug: string) {
  const arena = await ArenaModel.findOne({ slug, isActive: true }).lean();
  if (!arena) throw new NotFoundError('Arena');

  const courts = await CourtModel.find({ arenaId: arena._id, isActive: true }).lean();
  return { ...arena, courts };
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

  return review;
}
