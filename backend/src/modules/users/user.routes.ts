import { Router } from 'express';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { validate } from '../../shared/middlewares/validate.js';
import { ok } from '../../shared/utils/response.js';
import * as service from './user.service.js';
import {
  patchMeSchema,
  fcmTokenSchema,
  kycSchema,
  bankAccountSchema,
} from './user.validators.js';

export const userRoutes = Router();

/**
 * NOTE: `GET /:publicId` is declared at the BOTTOM of this file, not here.
 *
 * Express matches in declaration order, so a parametric route above the `/me`
 * routes swallows them — `GET /users/me` resolves as `publicId: "me"` and
 * returns NOT_FOUND for a perfectly valid session. Keep every literal path
 * above the parametric one.
 */

// Authenticated routes
userRoutes.use(authenticate);

userRoutes.get('/me', async (req, res, next) => {
  try {
    const user = await service.getUserProfile(currentUser(req)._id);
    ok(res, {
      publicId: user.publicId,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      primarySport: user.primarySport,
      skillLevel: user.skillLevel,
      homeAreaName: user.homeAreaName,
      wallet: {
        depositPaise: user.wallet.depositPaise,
        winningsPaise: user.wallet.winningsPaise,
        bonusPaise: user.wallet.bonusPaise,
        lockedPaise: user.wallet.lockedPaise,
      },
      kycStatus: user.kyc.status,
    });
  } catch (err) {
    next(err);
  }
});

userRoutes.patch('/me', validate({ body: patchMeSchema }), async (req, res, next) => {
  try {
    await service.updateProfile(currentUser(req)._id, req.body);
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
});

userRoutes.post('/me/fcm-token', validate({ body: fcmTokenSchema }), async (req, res, next) => {
  try {
    await service.upsertFcmToken(
      currentUser(req)._id,
      req.body.token,
      req.body.platform
    );
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
});

userRoutes.delete('/me/fcm-token', async (req, res, next) => {
  try {
    const token = req.query.token || req.body.token;
    if (typeof token !== 'string' || !token) {
      ok(res, { success: false, message: 'Token query parameter or body field required' });
      return;
    }
    await service.removeFcmToken(currentUser(req)._id, token);
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
});

userRoutes.get('/me/stats', async (req, res, next) => {
  try {
    const stats = await service.getPlayerStats(currentUser(req)._id);
    ok(res, stats);
  } catch (err) {
    next(err);
  }
});

userRoutes.post('/me/kyc', validate({ body: kycSchema }), async (req, res, next) => {
  try {
    const updated = await service.submitKyc(
      currentUser(req)._id,
      req.body.pan,
      req.body.documentUrl
    );
    ok(res, { success: true, kycStatus: updated.kyc.status });
  } catch (err) {
    next(err);
  }
});

userRoutes.post('/me/bank-account', validate({ body: bankAccountSchema }), async (req, res, next) => {
  try {
    await service.linkBankAccount(currentUser(req)._id, req.body);
    ok(res, { success: true });
  } catch (err) {
    next(err);
  }
});

userRoutes.delete('/me', async (req, res, next) => {
  try {
    const result = await service.deleteUser(currentUser(req)._id);
    ok(res, result);
  } catch (err) {
    next(err);
  }
});

/**
 * Public profile. MUST stay last — a parametric path declared above the `/me`
 * routes captures them (see the note at the top of this file).
 */
userRoutes.get('/:publicId', async (req, res, next) => {
  try {
    const profile = await service.getPublicProfile(String(req.params.publicId));
    ok(res, profile);
  } catch (err) {
    next(err);
  }
});
