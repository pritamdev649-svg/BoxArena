import { Router } from 'express';
import { z } from 'zod';
import { OfficialType, OfficialVerificationStatus, SportType, UserRole } from '../../models/index.js';
import { authenticate, currentUser, requireRole } from '../../shared/middlewares/auth.js';
import { validate, validatedQuery } from '../../shared/middlewares/validate.js';
import { created, ok } from '../../shared/utils/response.js';
import * as service from './official.service.js';

export const officialRoutes = Router();

const browseQuery = z
  .object({
    sport: z.nativeEnum(SportType).optional(),
    arenaPublicId: z.string().optional(),
    payoutCapableOnly: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();

/**
 * Public browse — a captain choosing an official has not necessarily signed
 * in yet, and the list is not sensitive. Everything below this line is.
 */
officialRoutes.get('/', validate({ query: browseQuery }), async (req, res, next) => {
  try {
    ok(res, await service.browseOfficials(validatedQuery(req)));
  } catch (err) {
    next(err);
  }
});

officialRoutes.use(authenticate);

const registerSchema = z
  .object({
    type: z.nativeEnum(OfficialType),
    displayName: z.string().min(2).max(60),
    sports: z.array(z.nativeEnum(SportType)).min(1),
    pricePerMatchPaise: z.number().int().min(0),
    experienceYears: z.number().int().min(0).max(60).optional(),
    bio: z.string().max(500).optional(),
    arenaPublicId: z.string().optional(),
  })
  .strict();

const updateSchema = z
  .object({
    displayName: z.string().min(2).max(60).optional(),
    sports: z.array(z.nativeEnum(SportType)).min(1).optional(),
    pricePerMatchPaise: z.number().int().min(0).optional(),
    experienceYears: z.number().int().min(0).max(60).optional(),
    bio: z.string().max(500).optional(),
    idDocumentUrl: z.string().url().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

officialRoutes.post('/', validate({ body: registerSchema }), async (req, res, next) => {
  try {
    const user = currentUser(req);
    await service.assertActiveUser(user);
    created(res, await service.registerOfficial({ user, ...req.body }));
  } catch (err) {
    next(err);
  }
});

/** MUST stay above `/:publicId`, or "me" is read as an official's id. */
officialRoutes.get('/me', async (req, res, next) => {
  try {
    ok(res, await service.listMyOfficialProfiles(currentUser(req)));
  } catch (err) {
    next(err);
  }
});

/** The official's own fixture list — what they are booked to officiate. */
officialRoutes.get('/me/matches', async (req, res, next) => {
  try {
    ok(res, await service.listAssignedMatches(currentUser(req)));
  } catch (err) {
    next(err);
  }
});

const adminOnly = requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN);

officialRoutes.get('/pending-verification', adminOnly, async (_req, res, next) => {
  try {
    ok(res, await service.listPendingVerification());
  } catch (err) {
    next(err);
  }
});

const verifySchema = z
  .object({ status: z.nativeEnum(OfficialVerificationStatus) })
  .strict();

/**
 * The moment a person gains the power to release someone else's prize money.
 * Ops only, and stamped with who decided it.
 */
officialRoutes.post(
  '/:publicId/verification',
  adminOnly,
  validate({ body: verifySchema }),
  async (req, res, next) => {
    try {
      ok(res, await service.setVerificationStatus({
        admin: currentUser(req),
        officialPublicId: String(req.params.publicId),
        status: req.body.status,
      }));
    } catch (err) {
      next(err);
    }
  },
);

officialRoutes.patch('/:publicId', validate({ body: updateSchema }), async (req, res, next) => {
  try {
    ok(res, await service.updateOwnOfficial({
      user: currentUser(req),
      officialPublicId: String(req.params.publicId),
      patch: req.body,
    }));
  } catch (err) {
    next(err);
  }
});

officialRoutes.get('/:publicId', async (req, res, next) => {
  try {
    ok(res, await service.getOfficial(String(req.params.publicId)));
  } catch (err) {
    next(err);
  }
});
