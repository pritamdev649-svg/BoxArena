import { Router } from 'express';
import { z } from 'zod';
import { ChallengeModel, ChallengeStatus, SportType, ArenaModel } from '../../models/index.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { validate, validatedQuery } from '../../shared/middlewares/validate.js';
import { created, ok } from '../../shared/utils/response.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import * as service from './challenge.service.js';
import { calculateMatchMoney } from './money.service.js';

export const challengeRoutes = Router();
challengeRoutes.use(authenticate);

/**
 * Posting a challenge.
 *
 * `bookingId` and `teamId` are REQUIRED, and both accept a publicId.
 *
 * They used to be optional, with the server inventing whatever was missing:
 * it created a ₹0 pay-at-venue booking against an arbitrary arena, made a
 * court if that arena had none, pointed the booking at a slot id that
 * referenced nothing, and — for a doubles team — added the first unrelated
 * user it found in the database as a teammate. Every one of those is a real
 * row that a venue owner, an ops reviewer, or the conscripted "teammate"
 * would later have to make sense of. A challenge is a claim on a court that
 * somebody paid for; if there is no such court, there is no challenge.
 */
const createSchema = z
  .object({
    bookingId: z.string().min(1),
    teamId: z.string().min(1),
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
    const { bookingId, teamId, entryFeePaise, notes } = req.body;

    created(res, await service.createChallenge({
      user: currentUser(req),
      bookingId,
      teamId,
      entryFeePaise: entryFeePaise || 0,
      ...(notes === undefined ? {} : { notes }),
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
      .populate('creatorTeamId', 'name publicId eloRating stats')
      /** publicId so a client can open the captain's real profile. */
      .populate('creatorUserId', 'fullName publicId avatarUrl')
      .populate('arenaId', 'name address')
      .sort({ startAt: 1 })
      .limit(q.limit ?? 20)
      .lean();
    ok(res, challenges);
  } catch (err) {
    next(err);
  }
});

/** Full detail with the server-computed money breakdown (money spec MM3). */
challengeRoutes.get('/:publicId', async (req, res, next) => {
  try {
    ok(res, await service.getChallengeDetail({
      challengePublicId: String(req.params.publicId),
    }));
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

// ---------------------------------------------------------------------------
// Match economics (money spec MM1–MM3)
//
// One endpoint serves BOTH the creator picking a price and the opponent
// deciding whether to accept. Two implementations of this maths would
// eventually disagree, and the number a player was shown before staking money
// is the one thing that must never be wrong.
// ---------------------------------------------------------------------------

const quoteSchema = z
  .object({
    venueFeePaise: z.number().int().min(0),
    officialFeePaise: z.number().int().min(0).default(0),
    entryFeePaise: z.number().int().min(0),
    teamCount: z.number().int().min(1).max(64).default(2),
  })
  .strict();

challengeRoutes.post('/quote', validate({ body: quoteSchema }), (req, res, next) => {
  try {
    ok(res, calculateMatchMoney(req.body));
  } catch (err) {
    next(err);
  }
});
