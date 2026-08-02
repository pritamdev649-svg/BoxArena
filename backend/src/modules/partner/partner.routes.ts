import { Router } from 'express';
import { z } from 'zod';
import { BookingStatus, SportType, UserRole } from '../../models/index.js';
import { authenticate, currentUser, requireRole } from '../../shared/middlewares/auth.js';
import { validate, validatedQuery } from '../../shared/middlewares/validate.js';
import { created, ok } from '../../shared/utils/response.js';
import {
  createPricingRulesSchema,
  pricingPreviewSchema,
} from '../arenas/pricing.validators.js';
import * as management from './arena-management.service.js';
import * as settlements from '../settlements/settlement.service.js';
import * as service from './partner.service.js';

export const partnerRoutes = Router();

const operatingHoursSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u),
    closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u),
    isClosed: z.boolean(),
  })
  .strict();

const arenaSettingsSchema = z
  .object({
    operatingHours: z.array(operatingHoursSchema).length(7).optional(),
    amenities: z.array(z.string().max(40)).max(20).optional(),
    cancellationPolicy: z
      .object({
        freeCancellationHours: z.number().int().min(0).max(168),
        partialRefundPercent: z.number().int().min(0).max(100),
      })
      .strict()
      .optional(),
    bookingMode: z.enum(['prepaid_only', 'pay_at_venue_allowed']).optional(),
    depositPercent: z.number().int().min(0).max(100).optional(),
    description: z.string().max(2000).optional(),
    contactPhone: z.string().max(20).optional(),
    /** Venue photos. The service checks the host — see assertOwnUploads. */
    images: z.array(z.string().url()).max(12).optional(),
  })
  .strict();

const courtSchema = z
  .object({
    name: z.string().min(1).max(50),
    sport: z.nativeEnum(SportType),
    surface: z.string().max(40).optional(),
    isIndoor: z.boolean().optional(),
    capacity: z.number().int().min(1).max(50).optional(),
    basePricePerHourPaise: z.number().int().min(0),
  })
  .strict();

const courtPatchSchema = courtSchema.partial().extend({ isActive: z.boolean().optional() }).strict();

const applySchema = z
  .object({
    ownerName: z.string().min(2).max(60),
    phoneNumber: z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid Indian mobile number'),
    venueName: z.string().min(2).max(100),
    areaName: z.string().min(2).max(100),
    sports: z.array(z.string()).min(1),
    courtCount: z.coerce.number().int().min(1),
    source: z.enum(['web', 'app', 'field_sales', 'referral']).optional(),
  })
  .strict();

const verifyPhoneSchema = z
  .object({
    otpCode: z.string().length(6),
    deviceId: z.string().max(128).optional(),
  })
  .strict();

// Public routes for onboarding application lead
partnerRoutes.post('/apply', validate({ body: applySchema }), async (req, res, next) => {
  try {
    const result = await service.partnerApply(req.body, req.ip);
    created(res, result);
  } catch (err) {
    next(err);
  }
});

partnerRoutes.post('/apply/:publicId/verify-phone', validate({ body: verifyPhoneSchema }), async (req, res, next) => {
  try {
    const result = await service.partnerVerifyPhone({
      applicationPublicId: String(req.params.publicId),
      otpCode: req.body.otpCode,
      ...(req.body.deviceId !== undefined ? { deviceId: req.body.deviceId } : {}),
      ...(req.header('User-Agent') !== undefined ? { userAgent: String(req.header('User-Agent')) } : {}),
      ...(req.ip !== undefined ? { ip: req.ip } : {}),
    });
    ok(res, result);
  } catch (err) {
    next(err);
  }
});

partnerRoutes.get('/application', authenticate, requireRole(UserRole.ARENA_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    ok(res, await service.getPartnerApplication(currentUser(req)._id));
  } catch (err) {
    next(err);
  }
});

partnerRoutes.patch('/application/step/:n', authenticate, requireRole(UserRole.ARENA_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const step = Number(req.params.n);
    const updated = await service.updatePartnerApplicationStep(currentUser(req)._id, step, req.body);
    ok(res, updated);
  } catch (err) {
    next(err);
  }
});

partnerRoutes.post('/application/submit', authenticate, requireRole(UserRole.ARENA_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    ok(res, await service.submitPartnerApplication(currentUser(req)._id));
  } catch (err) {
    next(err);
  }
});

/** Owners and their desk staff. Finer scoping happens in the service layer. */
partnerRoutes.use(
  authenticate,
  requireRole(UserRole.ARENA_OWNER, UserRole.ARENA_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN),
);

const bookingsQuery = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).optional(),
    status: z.nativeEnum(BookingStatus).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

const offlineSchema = z
  .object({
    slotIds: z.array(z.string()).min(1).max(6),
    customerName: z.string().min(2).max(60),
    customerPhone: z.string().max(20).optional(),
  })
  .strict();

const checkInSchema = z.object({ code: z.string().length(6) }).strict();

const blockSchema = z
  .object({
    courtId: z.string(),
    from: z.coerce.date(),
    to: z.coerce.date(),
    reason: z.string().min(3).max(200),
  })
  .strict();

partnerRoutes.get('/dashboard', async (req, res, next) => {
  try {
    ok(res, await service.getOwnerDashboard(currentUser(req)));
  } catch (err) {
    next(err);
  }
});

partnerRoutes.get('/arenas', async (req, res, next) => {
  try {
    ok(res, await service.listOwnerArenas(currentUser(req)));
  } catch (err) {
    next(err);
  }
});

partnerRoutes.get('/bookings', validate({ query: bookingsQuery }), async (req, res, next) => {
  try {
    ok(res, await service.listOwnerBookings(currentUser(req), validatedQuery(req)));
  } catch (err) {
    next(err);
  }
});

partnerRoutes.post('/bookings/offline', validate({ body: offlineSchema }), async (req, res, next) => {
  try {
    created(res, await service.recordOfflineBooking({
      user: currentUser(req),
      slotIds: req.body.slotIds,
      customerName: req.body.customerName,
      ...(req.body.customerPhone === undefined ? {} : { customerPhone: req.body.customerPhone }),
    }));
  } catch (err) {
    next(err);
  }
});

partnerRoutes.post('/bookings/:publicId/check-in', validate({ body: checkInSchema }), async (req, res, next) => {
  try {
    ok(res, await service.checkInBooking(currentUser(req), String(req.params.publicId), req.body.code));
  } catch (err) {
    next(err);
  }
});

partnerRoutes.post('/bookings/:publicId/no-show', async (req, res, next) => {
  try {
    ok(res, await service.markNoShow(currentUser(req), String(req.params.publicId)));
  } catch (err) {
    next(err);
  }
});

partnerRoutes.post('/slots/block', validate({ body: blockSchema }), async (req, res, next) => {
  try {
    ok(res, await service.blockSlots({
      user: currentUser(req),
      courtId: req.body.courtId,
      from: req.body.from,
      to: req.body.to,
      reason: req.body.reason,
    }));
  } catch (err) {
    next(err);
  }
});

/**
 * Settlements are money, so staff are excluded the same way they are from the
 * staff roster and pricing (§117).
 */
partnerRoutes.get('/settlements', requireRole(UserRole.ARENA_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    ok(res, await settlements.listOwnerSettlements(currentUser(req)));
  } catch (err) {
    next(err);
  }
});

partnerRoutes.get('/settlements/:publicId', requireRole(UserRole.ARENA_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    ok(res, await settlements.getOwnerSettlement(currentUser(req), String(req.params.publicId)));
  } catch (err) {
    next(err);
  }
});

/** Owner only — staff must never see the staff roster or money (§117). */
partnerRoutes.get('/staff', requireRole(UserRole.ARENA_OWNER, UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    ok(res, await service.listStaff(currentUser(req)));
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Venue management (arena_onboarding.md §7) — owner only.
//
// Every route here can collide with live bookings, so the service layer
// rejects and lists conflicts rather than silently changing a slot someone
// already paid for (§10.4).
// ---------------------------------------------------------------------------

const ownerOnly = requireRole(UserRole.ARENA_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN);

partnerRoutes.patch(
  '/arenas/:publicId',
  ownerOnly,
  validate({ body: arenaSettingsSchema }),
  async (req, res, next) => {
    try {
      ok(
        res,
        await management.updateArenaSettings({
          user: currentUser(req),
          arenaPublicId: String(req.params.publicId),
          patch: req.body,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

partnerRoutes.post(
  '/arenas/:publicId/courts',
  ownerOnly,
  validate({ body: courtSchema }),
  async (req, res, next) => {
    try {
      created(
        res,
        await management.addCourt({
          user: currentUser(req),
          arenaPublicId: String(req.params.publicId),
          court: req.body,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

partnerRoutes.patch(
  '/courts/:id',
  ownerOnly,
  validate({ body: courtPatchSchema }),
  async (req, res, next) => {
    try {
      ok(
        res,
        await management.updateCourt({
          user: currentUser(req),
          courtId: String(req.params.id),
          patch: req.body,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

partnerRoutes.post(
  '/pricing-rules',
  ownerOnly,
  validate({ body: createPricingRulesSchema }),
  async (req, res, next) => {
    try {
      created(
        res,
        await management.setPricingRules({
          user: currentUser(req),
          arenaPublicId: req.body.arenaPublicId,
          rules: req.body.rules,
          replaceExisting: req.body.replaceExisting,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

partnerRoutes.get(
  '/pricing-rules',
  ownerOnly,
  validate({ query: pricingPreviewSchema }),
  async (req, res, next) => {
    try {
      const query = validatedQuery<z.infer<typeof pricingPreviewSchema>>(req);
      ok(
        res,
        await management.listPricingRules({
          user: currentUser(req),
          arenaPublicId: query.arenaPublicId,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

/** The live weekly grid, shown BEFORE the owner commits to a band. */
partnerRoutes.get(
  '/pricing-preview',
  ownerOnly,
  validate({ query: pricingPreviewSchema }),
  async (req, res, next) => {
    try {
      const query = validatedQuery<z.infer<typeof pricingPreviewSchema>>(req);
      ok(
        res,
        await management.pricingPreview({
          user: currentUser(req),
          arenaPublicId: query.arenaPublicId,
          ...(query.courtId ? { courtId: query.courtId } : {}),
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

