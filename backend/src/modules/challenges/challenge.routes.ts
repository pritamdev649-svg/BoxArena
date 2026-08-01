import { Router } from 'express';
import { z } from 'zod';
import { ChallengeModel, ChallengeStatus, SportType, ArenaModel } from '../../models/index.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { validate, validatedQuery } from '../../shared/middlewares/validate.js';
import { created, ok } from '../../shared/utils/response.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import * as service from './challenge.service.js';

export const challengeRoutes = Router();
challengeRoutes.use(authenticate);

const createSchema = z
  .object({
    bookingId: z.string(),
    teamId: z.string(),
    entryFeePaise: z.number().int().min(0).default(0),
    notes: z.string().max(500).optional(),
  })
  .strict();

const acceptSchema = z.object({ teamId: z.string() }).strict();

const feedQuery = z
  .object({
    sport: z.nativeEnum(SportType).optional(),
    maxEntryFeePaise: z.coerce.number().int().min(0).optional(),
    arenaPublicId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

challengeRoutes.post('/', validate({ body: createSchema }), async (req, res, next) => {
  try {
    created(res, await service.createChallenge({
      user: currentUser(req),
      bookingId: req.body.bookingId,
      teamId: req.body.teamId,
      entryFeePaise: req.body.entryFeePaise,
      ...(req.body.notes === undefined ? {} : { notes: req.body.notes }),
    }));
  } catch (err) {
    next(err);
  }
});

/** Open-challenge feed: soonest first, which is what players actually want. */
challengeRoutes.get('/', validate({ query: feedQuery }), async (req, res, next) => {
  try {
    const q = validatedQuery<z.infer<typeof feedQuery>>(req);
    
    let arenaFilter = {};
    if (q.arenaPublicId) {
      const arena = await ArenaModel.findOne({ publicId: q.arenaPublicId, isActive: true }).lean();
      if (!arena) throw new NotFoundError('Arena');
      arenaFilter = { arenaId: arena._id };
    }

    const challenges = await ChallengeModel.find({
      status: ChallengeStatus.OPEN,
      matchExpiresAt: { $gt: new Date() },
      ...arenaFilter,
      ...(q.sport ? { sport: q.sport } : {}),
      ...(q.maxEntryFeePaise === undefined
        ? {}
        : { entryFeePaise: { $lte: q.maxEntryFeePaise } }),
    })
      .populate('creatorTeamId', 'name eloRating stats')
      .populate('creatorUserId', 'fullName')
      .populate('arenaId', 'name address')
      .sort({ startAt: 1 })
      .limit(q.limit ?? 20)
      .lean();
    ok(res, challenges);
  } catch (err) {
    next(err);
  }
});

challengeRoutes.post('/:publicId/accept', validate({ body: acceptSchema }), async (req, res, next) => {
  try {
    ok(res, await service.acceptChallenge({
      user: currentUser(req),
      challengePublicId: String(req.params.publicId),
      teamId: req.body.teamId,
    }));
  } catch (err) {
    next(err);
  }
});
