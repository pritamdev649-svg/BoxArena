import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './shared/config/env.js';
import { connectDatabase } from './shared/config/db.js';
import { logger } from './shared/config/logger.js';
import { errorHandler, notFoundHandler } from './shared/middlewares/error-handler.js';
import { requestLogger } from './shared/middlewares/request-logger.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { arenaRoutes } from './modules/arenas/arena.routes.js';
import { bookingRoutes } from './modules/booking/booking.routes.js';
import { walletRoutes } from './modules/wallet/wallet.routes.js';
import { challengeRoutes } from './modules/challenges/challenge.routes.js';
import { matchRoutes } from './modules/matches/match.routes.js';
import { partnerRoutes } from './modules/partner/partner.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { uploadRoutes } from './modules/uploads/upload.routes.js';
import { teamRoutes } from './modules/teams/team.routes.js';
import { notificationRoutes } from './modules/notifications/notification.routes.js';
import { paymentRoutes, webhookRoutes } from './modules/payments/payment.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { geoRoutes } from './modules/geo/geo.routes.js';
import { officialRoutes } from './modules/officials/official.routes.js';

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(async (req, res, next) => {
    if (req.path === '/health') {
      return next();
    }
    if (mongoose.connection.readyState !== 1) {
      try {
        await connectDatabase();
      } catch (err) {
        logger.error({ err }, 'Database connection failed in middleware');
        return res.status(500).json({ success: false, error: 'Database connection failed' });
      }
    }
    next();
  });

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ALLOWED_ORIGINS,
      credentials: true,
    }),
  );

  app.use('/api/v1/webhooks/razorpay', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.RATE_LIMIT_GLOBAL_PER_MINUTE,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      },
    }),
  );


  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.get('/health/ready', (_req, res) => {
    const dbReady = mongoose.connection.readyState === 1;
    res.status(dbReady ? 200 : 503).json({
      status: dbReady ? 'ready' : 'not_ready',
      database: dbReady ? 'connected' : 'disconnected',
    });
  });

  const v1 = express.Router();
  v1.use('/auth', authRoutes);
  v1.use('/arenas', arenaRoutes);
  v1.use('/bookings', bookingRoutes);
  v1.use('/wallet', walletRoutes);
  v1.use('/challenges', challengeRoutes);
  v1.use('/matches', matchRoutes);
  v1.use('/owner', partnerRoutes);
  v1.use('/admin', adminRoutes);
  v1.use('/uploads', uploadRoutes);
  v1.use('/teams', teamRoutes);
  v1.use('/notifications', notificationRoutes);
  v1.use('/users', userRoutes);
  v1.use('/geo', geoRoutes);
  v1.use('/officials', officialRoutes);
  v1.use('/wallet', paymentRoutes);
  v1.use('/webhooks', webhookRoutes);
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
