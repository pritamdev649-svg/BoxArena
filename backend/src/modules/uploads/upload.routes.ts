import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { validate } from '../../shared/middlewares/validate.js';
import { ok } from '../../shared/utils/response.js';
import { createUploadSignature } from './upload.service.js';

export const uploadRoutes = Router();
uploadRoutes.use(authenticate);

const signSchema = z
  .object({
    kind: z.enum(['avatar', 'arena', 'team_logo', 'evidence', 'kyc']),
  })
  .strict();

/**
 * Returns a short-lived signature. The client uploads DIRECTLY to Cloudinary
 * with it — we never proxy file bytes through this server.
 */
uploadRoutes.post('/sign', validate({ body: signSchema }), (req, res, next) => {
  try {
    ok(res, createUploadSignature({ user: currentUser(req), kind: req.body.kind }));
  } catch (err) {
    next(err);
  }
});
