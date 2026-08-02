import { Router } from 'express';
import { z } from 'zod';
import { MatchEventType, MatchModel, PointOutcome } from '../../models/index.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { validate } from '../../shared/middlewares/validate.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { ok } from '../../shared/utils/response.js';
import * as service from './match.service.js';
import * as live from './live-scoring.service.js';
import * as officials from '../officials/official.service.js';
import * as fees from '../officials/official-fee.service.js';

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

// ---------------------------------------------------------------------------
// Live scoring — the official's scoreboard (games_rule/badminton.md)
//
// The client never sends a score. It sends "point to creator" and the server
// decides what that means, which is what makes an invalid state like a 21-20
// set win unrepresentable rather than merely rejected.
// ---------------------------------------------------------------------------

const sideSchema = z.enum(['creator', 'opponent']);

const pointSchema = z
  .object({
    side: sideSchema,
    /** Client-generated per tap. Makes a retry on bad signal a no-op. */
    idempotencyKey: z.string().min(8).max(64),
    /** Optional — a bare tap still records a valid rally. */
    outcome: z.nativeEnum(PointOutcome).optional(),
    attributedToUserId: z.string().optional(),
  })
  .strict();

const undoSchema = z.object({ idempotencyKey: z.string().min(8).max(64) }).strict();

const eventSchema = z
  .object({
    eventType: z.nativeEnum(MatchEventType),
    side: sideSchema.optional(),
    note: z.string().max(200).optional(),
  })
  .strict();

matchRoutes.post('/:publicId/live/start', async (req, res, next) => {
  try {
    const result = await live.startLiveMatch({
      user: currentUser(req),
      matchPublicId: String(req.params.publicId),
    });
    ok(res, { state: result.state });
  } catch (err) {
    next(err);
  }
});

matchRoutes.post('/:publicId/live/point', validate({ body: pointSchema }), async (req, res, next) => {
  try {
    ok(res, await live.recordPoint({
      user: currentUser(req),
      matchPublicId: String(req.params.publicId),
      side: req.body.side,
      idempotencyKey: req.body.idempotencyKey,
      outcome: req.body.outcome,
      attributedToUserId: req.body.attributedToUserId,
    }));
  } catch (err) {
    next(err);
  }
});

matchRoutes.post('/:publicId/live/undo', validate({ body: undoSchema }), async (req, res, next) => {
  try {
    ok(res, await live.undoLastPoint({
      user: currentUser(req),
      matchPublicId: String(req.params.publicId),
      idempotencyKey: req.body.idempotencyKey,
    }));
  } catch (err) {
    next(err);
  }
});

matchRoutes.post('/:publicId/live/event', validate({ body: eventSchema }), async (req, res, next) => {
  try {
    await live.recordEvent({
      user: currentUser(req),
      matchPublicId: String(req.params.publicId),
      eventType: req.body.eventType,
      side: req.body.side,
      note: req.body.note,
    });
    ok(res, { recorded: true });
  } catch (err) {
    next(err);
  }
});

/** The official signs off the final result (§6). */
matchRoutes.post('/:publicId/live/confirm', async (req, res, next) => {
  try {
    ok(res, await live.confirmOfficialResult({
      user: currentUser(req),
      matchPublicId: String(req.params.publicId),
    }));
  } catch (err) {
    next(err);
  }
});

matchRoutes.get('/:publicId/live', async (req, res, next) => {
  try {
    ok(res, await live.getLiveState(String(req.params.publicId)));
  } catch (err) {
    next(err);
  }
});

/** Derived statistics for the match-overview screens. */
matchRoutes.get('/:publicId/live/stats', async (req, res, next) => {
  try {
    ok(res, await live.getMatchStats(String(req.params.publicId)));
  } catch (err) {
    next(err);
  }
});

/** Rally-by-rally record — the replayable evidence behind a disputed score. */
matchRoutes.get('/:publicId/live/points', async (req, res, next) => {
  try {
    ok(res, await live.getPointLog(String(req.params.publicId)));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Choosing the official (featuredoc/11 §OF3)
//
// Mutual consent: one captain proposes, the other confirms. A unilateral pick
// would let one side choose who validates the result they are paid on.
// ---------------------------------------------------------------------------

const proposeOfficialSchema = z.object({ officialPublicId: z.string().min(1) }).strict();

matchRoutes.post(
  '/:publicId/official',
  validate({ body: proposeOfficialSchema }),
  async (req, res, next) => {
    try {
      ok(res, await officials.proposeOfficial({
        user: currentUser(req),
        matchPublicId: String(req.params.publicId),
        officialPublicId: req.body.officialPublicId,
      }));
    } catch (err) {
      next(err);
    }
  },
);

matchRoutes.post('/:publicId/official/confirm', async (req, res, next) => {
  try {
    ok(res, await officials.confirmOfficial({
      user: currentUser(req),
      matchPublicId: String(req.params.publicId),
    }));
  } catch (err) {
    next(err);
  }
});

/**
 * Captain agreement with a result the official proposed.
 *
 * Only reachable when the official could NOT trigger payout — otherwise the
 * match settled the moment they signed off (games_rule/badminton.md §6).
 */
const confirmResultSchema = z.object({ agree: z.boolean() }).strict();

matchRoutes.post(
  '/:publicId/result/confirm',
  validate({ body: confirmResultSchema }),
  async (req, res, next) => {
    try {
      ok(res, await service.confirmProposedResult({
        user: currentUser(req),
        matchPublicId: String(req.params.publicId),
        agree: req.body.agree,
      }));
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// The official's fee (featuredoc/11 §OF4)
//
// A cost of playing, never part of the prize pool. Charged upfront to both
// captains once they have agreed on the official, released when the match
// settles, refunded if it is voided.
// ---------------------------------------------------------------------------

matchRoutes.get('/:publicId/official-fee', async (req, res, next) => {
  try {
    ok(res, await fees.quoteOfficialFee({
      user: currentUser(req),
      matchPublicId: String(req.params.publicId),
    }));
  } catch (err) {
    next(err);
  }
});

matchRoutes.post('/:publicId/official-fee/collect', async (req, res, next) => {
  try {
    const match = await MatchModel.findOne({ publicId: String(req.params.publicId) });
    if (!match) throw new NotFoundError('Match');
    await fees.assertCaptain(match, currentUser(req));

    ok(res, await fees.collectOfficialFee({ matchPublicId: String(req.params.publicId) }));
  } catch (err) {
    next(err);
  }
});

/** Captains report an official who never arrived (§OF6). */
matchRoutes.post('/:publicId/official/no-show', async (req, res, next) => {
  try {
    ok(res, await fees.reportOfficialNoShow({
      user: currentUser(req),
      matchPublicId: String(req.params.publicId),
    }));
  } catch (err) {
    next(err);
  }
});
