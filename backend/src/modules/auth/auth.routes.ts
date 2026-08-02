import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../shared/config/env.js';
import { validate } from '../../shared/middlewares/validate.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { ok } from '../../shared/utils/response.js';
import { issueSocketToken } from './auth.service.js';
import * as controller from './auth.controller.js';
import { refreshSchema, requestOtpSchema, verifyOtpSchema } from './auth.validators.js';

export const authRoutes = Router();

/**
 * Rate-limited by IP. Production also needs a per-phone limiter backed by
 * Redis — one attacker with a SIM farm defeats IP-only limits (edge_cases.md §1).
 */
const otpLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.RATE_LIMIT_OTP_PER_15_MIN,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_AUTH_PER_MINUTE,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

authRoutes.post('/otp/request', otpLimiter, validate({ body: requestOtpSchema }), controller.requestOtp);
authRoutes.post('/otp/verify', authLimiter, validate({ body: verifyOtpSchema }), controller.verifyOtp);
authRoutes.post('/refresh', authLimiter, validate({ body: refreshSchema }), controller.refresh);
authRoutes.post('/logout', controller.logout);
authRoutes.post('/logout-all', authenticate, controller.logoutAll);
authRoutes.get('/sessions', authenticate, controller.sessions);
authRoutes.get('/me', authenticate, controller.me);

/**
 * Mints a one-minute, socket-only token for the browser.
 *
 * Needed because the page's session lives in an httpOnly cookie that client JS
 * cannot read, and the WebSocket handshake takes its credential from the URL.
 */
authRoutes.post('/socket-token', authenticate, (req, res, next) => {
  try {
    ok(res, issueSocketToken(currentUser(req)));
  } catch (err) {
    next(err);
  }
});
