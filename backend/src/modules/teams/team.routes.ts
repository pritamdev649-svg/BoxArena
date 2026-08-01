import { Router } from 'express';
import { z } from 'zod';
import { MatchFormat, SportType } from '../../models/index.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { validate } from '../../shared/middlewares/validate.js';
import { created, ok } from '../../shared/utils/response.js';
import * as service from './team.service.js';

export const teamRoutes = Router();
teamRoutes.use(authenticate);

const createSchema = z
  .object({
    name: z.string().min(3).max(40),
    sport: z.nativeEnum(SportType),
    format: z.nativeEnum(MatchFormat),
    logoUrl: z.string().url().optional(),
  })
  .strict();

const inviteSchema = z
  .object({
    maxUses: z.number().int().min(1).max(20).optional(),
    expiresInHours: z.number().int().min(1).max(168).optional(),
  })
  .strict();

teamRoutes.post('/', validate({ body: createSchema }), async (req, res, next) => {
  try {
    created(res, await service.createTeam({ user: currentUser(req), ...req.body }));
  } catch (err) {
    next(err);
  }
});

teamRoutes.get('/mine', async (req, res, next) => {
  try {
    ok(res, await service.listMyTeams(currentUser(req)));
  } catch (err) {
    next(err);
  }
});

teamRoutes.get('/:publicId', async (req, res, next) => {
  try {
    ok(res, await service.getTeam(String(req.params.publicId)));
  } catch (err) {
    next(err);
  }
});

teamRoutes.post('/:publicId/invites', validate({ body: inviteSchema }), async (req, res, next) => {
  try {
    created(res, await service.createInvite({
      user: currentUser(req),
      teamPublicId: String(req.params.publicId),
      ...req.body,
    }));
  } catch (err) {
    next(err);
  }
});

/** Requires auth, so a leaked WhatsApp link cannot add a stranger silently. */
teamRoutes.post('/invites/:token/accept', async (req, res, next) => {
  try {
    ok(res, await service.acceptInvite({
      user: currentUser(req),
      token: String(req.params.token),
    }));
  } catch (err) {
    next(err);
  }
});

teamRoutes.delete('/:publicId/members/:memberPublicId', async (req, res, next) => {
  try {
    ok(res, await service.removeMember({
      user: currentUser(req),
      teamPublicId: String(req.params.publicId),
      memberPublicId: String(req.params.memberPublicId),
    }));
  } catch (err) {
    next(err);
  }
});

teamRoutes.post('/:publicId/leave', async (req, res, next) => {
  try {
    await service.leaveTeam({ user: currentUser(req), teamPublicId: String(req.params.publicId) });
    ok(res, { left: true });
  } catch (err) {
    next(err);
  }
});
