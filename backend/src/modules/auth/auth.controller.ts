import type { NextFunction, Request, Response } from 'express';
import * as authService from './auth.service.js';
import { ok, created } from '../../shared/utils/response.js';
import { currentUser } from '../../shared/middlewares/auth.js';
import { UnauthorizedError } from '../../shared/errors/app-error.js';

/** Controllers parse, call ONE service method, and shape the response. */

export async function requestOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.requestOtp({
      phoneNumber: req.body.phoneNumber,
      ...(req.ip === undefined ? {} : { ip: req.ip }),
    });
    /** Always 200 — never reveal whether the number is registered. */
    ok(res, { sent: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.verifyOtp({
      phoneNumber: req.body.phoneNumber,
      code: req.body.code,
      ...(req.body.deviceId === undefined ? {} : { deviceId: req.body.deviceId }),
      ...(req.headers['user-agent'] === undefined
        ? {}
        : { userAgent: req.headers['user-agent'] }),
      ...(req.ip === undefined ? {} : { ip: req.ip }),
    });

    created(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      isNewUser: result.isNewUser,
      user: publicUser(result.user),
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const pair = await authService.refreshTokens({
      refreshToken: req.body.refreshToken,
      ...(req.ip === undefined ? {} : { ip: req.ip }),
    });
    ok(res, pair);
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.body?.refreshToken;
    if (!token) throw new UnauthorizedError('refreshToken is required');
    await authService.logout(token);
    ok(res, { loggedOut: true });
  } catch (err) {
    next(err);
  }
}

export async function logoutAll(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.logoutAllSessions(String(currentUser(req)._id));
    ok(res, { loggedOut: true });
  } catch (err) {
    next(err);
  }
}

export async function sessions(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await authService.listSessions(String(currentUser(req)._id)));
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, publicUser(currentUser(req)));
  } catch (err) {
    next(err);
  }
}

/** Never leak phone numbers, tokens, or KYC documents to the client. */
function publicUser(user: import('../../models/index.js').IUser) {
  return {
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
  };
}
