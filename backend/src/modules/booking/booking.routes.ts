import { Router } from 'express';
import { z } from 'zod';
import { BookingModel } from '../../models/index.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { validate } from '../../shared/middlewares/validate.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error.js';
import { created, ok } from '../../shared/utils/response.js';
import * as service from './booking.service.js';

export const bookingRoutes = Router();
bookingRoutes.use(authenticate);

const holdSchema = z
  .object({
    slotIds: z.array(z.string()).min(1).max(6),
    expectedTotalPaise: z.number().int().min(0),
  })
  .strict();

const confirmSchema = z
  .object({
    slotIds: z.array(z.string()).min(1).max(6),
    isPayAtVenue: z.boolean().optional(),
  })
  .strict();

const cancelSchema = z.object({ reason: z.string().min(3).max(500) }).strict();

bookingRoutes.post('/hold', validate({ body: holdSchema }), async (req, res, next) => {
  try {
    const result = await service.holdSlots({
      user: currentUser(req),
      slotIds: req.body.slotIds,
      expectedTotalPaise: req.body.expectedTotalPaise,
    });
    ok(res, {
      holdExpiresAt: result.holdExpiresAt,
      totalPaise: result.totalPaise,
      slotIds: result.slots.map((s) => String(s._id)),
    });
  } catch (err) {
    next(err);
  }
});

bookingRoutes.post('/', validate({ body: confirmSchema }), async (req, res, next) => {
  try {
    /** Idempotency key is mandatory on every financial mutation. */
    const key = req.header('Idempotency-Key');
    if (!key) throw new BadRequestError('Idempotency-Key header is required');

    const booking = await service.confirmBooking({
      user: currentUser(req),
      slotIds: req.body.slotIds,
      idempotencyKey: key,
      ...(req.body.isPayAtVenue === undefined ? {} : { isPayAtVenue: req.body.isPayAtVenue }),
    });
    created(res, booking);
  } catch (err) {
    next(err);
  }
});

bookingRoutes.get('/', async (req, res, next) => {
  try {
    const bookings = await BookingModel.find({ bookerId: currentUser(req)._id })
      .sort({ startAt: -1 })
      .limit(50)
      .lean();
    ok(res, bookings);
  } catch (err) {
    next(err);
  }
});

bookingRoutes.get('/:publicId', async (req, res, next) => {
  try {
    const booking = await BookingModel.findOne({ publicId: String(req.params.publicId) });
    if (!booking) throw new NotFoundError('Booking');
    /** Ownership check — every :id route needs one (edge_cases.md §96). */
    if (String(booking.bookerId) !== String(currentUser(req)._id)) {
      throw new ForbiddenError('This is not your booking');
    }
    ok(res, booking);
  } catch (err) {
    next(err);
  }
});

bookingRoutes.post('/:publicId/cancel', validate({ body: cancelSchema }), async (req, res, next) => {
  try {
    const booking = await BookingModel.findOne({ publicId: String(req.params.publicId) });
    if (!booking) throw new NotFoundError('Booking');
    if (String(booking.bookerId) !== String(currentUser(req)._id)) {
      throw new ForbiddenError('This is not your booking');
    }
    ok(res, await service.cancelBooking({
      bookingId: String(booking._id),
      cancelledBy: currentUser(req),
      reason: req.body.reason,
    }));
  } catch (err) {
    next(err);
  }
});
