import { Router } from 'express';
import { z } from 'zod';
import { MatchFormat, SportType } from '../../models/index.js';
import { validate, validatedQuery } from '../../shared/middlewares/validate.js';
import { ok } from '../../shared/utils/response.js';
import * as service from './leaderboard.service.js';
import { getPublicProfile } from '../users/user.service.js';
import { bookableSports, challengeSports, liveScorableSports } from '../../shared/config/sports.js';

/**
 * Public by design (api_contract.md §10).
 *
 * The city table and recent results are the SEO surface — putting them behind
 * auth would hide the one thing that makes the product discoverable.
 */
export const leaderboardRoutes = Router();

const listQuery = z
  .object({
    sport: z.nativeEnum(SportType).optional(),
    format: z.nativeEnum(MatchFormat).optional(),
    areaName: z.string().max(60).optional(),
    period: z.enum(['all', 'month']).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

leaderboardRoutes.get('/', validate({ query: listQuery }), async (req, res, next) => {
  try {
    ok(res, await service.getLeaderboard(validatedQuery(req)));
  } catch (err) {
    next(err);
  }
});

export const publicRoutes = Router();

const recentQuery = z
  .object({ limit: z.coerce.number().int().min(1).max(50).optional() })
  .strict();

publicRoutes.get('/matches/recent', validate({ query: recentQuery }), async (req, res, next) => {
  try {
    const query = validatedQuery<{ limit?: number }>(req);
    ok(res, await service.getRecentPublicMatches(query.limit));
  } catch (err) {
    next(err);
  }
});

/**
 * A player's public record.
 *
 * `/users/:publicId` exists but sits behind `authenticate`, and the city table
 * is public — a ladder whose every row 401s for a logged-out visitor is a dead
 * end and invisible to search. Same service, no auth, and it returns only what
 * is safe to publish: no phone number, no wallet, no KYC.
 */
publicRoutes.get('/players/:publicId', async (req, res, next) => {
  try {
    ok(res, await getPublicProfile(String(req.params.publicId)));
  } catch (err) {
    next(err);
  }
});

publicRoutes.get('/arenas/:slug', async (req, res, next) => {
  try {
    ok(res, await service.getPublicArena(String(req.params.slug)));
  } catch (err) {
    next(err);
  }
});

/**
 * What the product currently offers.
 *
 * Public and unauthenticated so every surface — web pickers, the Flutter app,
 * the marketing site — reads scope from one place instead of hardcoding a
 * sport list that drifts the moment scope changes.
 */
publicRoutes.get('/config', (_req, res, next) => {
  try {
    ok(res, {
      /** What a venue may list and a player may book. */
      bookableSports: bookableSports(),
      /** What a competitive challenge may be posted in. */
      challengeSports: challengeSports(),
      /** What an official may score rally-by-rally. */
      liveScorableSports: liveScorableSports(),
    });
  } catch (err) {
    next(err);
  }
});
