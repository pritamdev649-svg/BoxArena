import { Router } from 'express';
import { z } from 'zod';
import { MatchModel } from '../../models/index.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { validate } from '../../shared/middlewares/validate.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/utils/response.js';
import * as service from './match.service.js';

export const matchRoutes = Router();
matchRoutes.use(authenticate);

const badmintonGame = z.object({
  gameNumber: z.number().int().min(1).max(3),
  creatorPoints: z.number().int().min(0).max(30),
  opponentPoints: z.number().int().min(0).max(30),
});

const innings = z.object({
  runs: z.number().int().min(0),
  wickets: z.number().int().min(0).max(10),
  overs: z.number().min(0),
});

/**
 * The score payload is a discriminated shape, not a bag of optionals — the
 * validator rejects anything that doesn't match the match's sport anyway.
 */
const scoreSchema = z
  .object({
    score: z
      .object({
        badminton: z.object({ games: z.array(badmintonGame).min(2).max(3) }).optional(),
        football: z
          .object({
            creatorGoals: z.number().int().min(0),
            opponentGoals: z.number().int().min(0),
          })
          .optional(),
        cricket: z.object({ creator: innings, opponent: innings }).optional(),
      })
      .strict(),
  })
  .strict();

matchRoutes.get('/mine', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const matches = await MatchModel.find({ 'lineup.userIds': user._id })
      .sort({ scheduledAt: -1 })
      .limit(50)
      .lean();
    ok(res, matches);
  } catch (err) {
    next(err);
  }
});

matchRoutes.get('/:publicId', async (req, res, next) => {
  try {
    const match = await MatchModel.findOne({ publicId: String(req.params.publicId) }).lean();
    if (!match) throw new NotFoundError('Match');
    ok(res, match);
  } catch (err) {
    next(err);
  }
});

matchRoutes.post('/:publicId/score', validate({ body: scoreSchema }), async (req, res, next) => {
  try {
    const result = await service.submitScore({
      matchPublicId: String(req.params.publicId),
      user: currentUser(req),
      score: req.body.score,
    });
    ok(res, { outcome: result.outcome, status: result.match.status });
  } catch (err) {
    next(err);
  }
});
