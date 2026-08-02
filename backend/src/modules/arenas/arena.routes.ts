import { Router } from 'express';
import { z } from 'zod';
import { SportType } from '../../models/index.js';
import { validate, validatedQuery } from '../../shared/middlewares/validate.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { ok } from '../../shared/utils/response.js';
import * as service from './arena.service.js';

export const arenaRoutes = Router();

const listQuery = z
  .object({
    areaName: z.string().optional(),
    sport: z.nativeEnum(SportType).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

const nearbyQuery = z
  .object({
    lat: z.coerce.number(),
    lng: z.coerce.number(),
    radiusKm: z.coerce.number().min(1).max(50).optional(),
    sport: z.nativeEnum(SportType).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

const slotsQuery = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
    sport: z.nativeEnum(SportType).optional(),
  })
  .strict();

arenaRoutes.get('/', validate({ query: listQuery }), async (req, res, next) => {
  try {
    ok(res, await service.listArenas(validatedQuery(req)));
  } catch (err) {
    next(err);
  }
});

arenaRoutes.get('/nearby', validate({ query: nearbyQuery }), async (req, res, next) => {
  try {
    ok(res, await service.findNearby(validatedQuery(req)));
  } catch (err) {
    next(err);
  }
});

const topQuery = z
  .object({
    sport: z.nativeEnum(SportType).optional(),
    limit: z.coerce.number().int().min(1).max(12).optional(),
  })
  .strict();

/** MUST stay above `/:slug`, or "top" is read as a venue slug. */
arenaRoutes.get('/top', validate({ query: topQuery }), async (req, res, next) => {
  try {
    const query = validatedQuery<{ sport?: SportType; limit?: number }>(req);
    ok(res, await service.listTopArenas({ sport: query.sport, limit: query.limit }));
  } catch (err) {
    next(err);
  }
});

arenaRoutes.get('/:slug', async (req, res, next) => {
  try {
    ok(res, await service.getArenaBySlug(String(req.params.slug)));
  } catch (err) {
    next(err);
  }
});

arenaRoutes.get('/:publicId/slots', validate({ query: slotsQuery }), async (req, res, next) => {
  try {
    const query = validatedQuery<{ date: string; sport?: SportType }>(req);
    ok(res, await service.getSlotsForDay({
      arenaPublicId: String(req.params.publicId),
      localDate: query.date,
      sport: query.sport,
    }));
  } catch (err) {
    next(err);
  }
});

const challengesQuery = z
  .object({
    sport: z.nativeEnum(SportType).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

arenaRoutes.get('/:publicId/challenges', validate({ query: challengesQuery }), async (req, res, next) => {
  try {
    const query = validatedQuery<{ sport?: SportType; limit?: number }>(req);
    ok(res, await service.getChallengesForArena({
      arenaPublicId: String(req.params.publicId),
      sport: query.sport,
      limit: query.limit,
    }));
  } catch (err) {
    next(err);
  }
});

const reviewsQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    after: z.string().optional(),
  })
  .strict();

const createReviewSchema = z
  .object({
    bookingPublicId: z.string(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
  })
  .strict();

/** Counted live from bookings and matches — see `getArenaStats`. */
arenaRoutes.get('/:publicId/stats', async (req, res, next) => {
  try {
    ok(res, await service.getArenaStatsByPublicId(String(req.params.publicId)));
  } catch (err) {
    next(err);
  }
});

/**
 * Settled matches played here.
 *
 * Exists so a venue page can show a real match history instead of a
 * plausible-looking one — the mobile app was generating its own.
 */
arenaRoutes.get('/:publicId/matches', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 10), 50);
    ok(res, await service.getArenaMatchHistory(String(req.params.publicId), limit));
  } catch (err) {
    next(err);
  }
});

arenaRoutes.get('/:publicId/reviews', validate({ query: reviewsQuery }), async (req, res, next) => {
  try {
    const q = validatedQuery<{ limit?: number; after?: string }>(req);
    ok(res, await service.getArenaReviews({
      arenaPublicId: String(req.params.publicId),
      ...(q.limit === undefined ? {} : { limit: q.limit }),
      ...(q.after === undefined ? {} : { after: q.after }),
    }));
  } catch (err) {
    next(err);
  }
});

/** Answers "can I review this venue, and against which booking?" */
arenaRoutes.get('/:publicId/reviews/eligibility', authenticate, async (req, res, next) => {
  try {
    ok(res, await service.getReviewEligibility({
      user: currentUser(req),
      arenaPublicId: String(req.params.publicId),
    }));
  } catch (err) {
    next(err);
  }
});

arenaRoutes.post('/:publicId/reviews', authenticate, validate({ body: createReviewSchema }), async (req, res, next) => {
  try {
    ok(res, await service.createArenaReview({
      user: currentUser(req),
      arenaPublicId: String(req.params.publicId),
      bookingPublicId: req.body.bookingPublicId,
      rating: req.body.rating,
      comment: req.body.comment,
    }));
  } catch (err) {
    next(err);
  }
});

