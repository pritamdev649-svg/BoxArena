import { Router } from 'express';
import { z } from 'zod';
import { ApplicationStatus, UserRole } from '../../models/index.js';
import { authenticate, currentUser, requireRole } from '../../shared/middlewares/auth.js';
import { validate, validatedQuery } from '../../shared/middlewares/validate.js';
import { ok } from '../../shared/utils/response.js';
import * as service from './admin.service.js';

export const adminRoutes = Router();

adminRoutes.use(authenticate, requireRole(UserRole.ADMIN, UserRole.SUPER_ADMIN));

const listQuery = z.object({ status: z.nativeEnum(ApplicationStatus).optional() }).strict();

const verifySchema = z
  .object({
    checklist: z.record(z.string(), z.boolean()),
    notes: z.string().max(2000).optional(),
  })
  .strict();

const approveSchema = z
  .object({ commissionPercent: z.number().int().min(0).max(100).optional() })
  .strict();

const rejectSchema = z.object({ reason: z.string().min(5).max(500) }).strict();

const suspendSchema = z.object({ reason: z.string().min(5).max(500) }).strict();

adminRoutes.get('/overview', async (_req, res, next) => {
  try {
    ok(res, await service.getAdminOverview());
  } catch (err) {
    next(err);
  }
});

adminRoutes.get('/applications', validate({ query: listQuery }), async (req, res, next) => {
  try {
    const { status } = validatedQuery<{ status?: ApplicationStatus }>(req);
    ok(res, await service.listApplications(status));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get('/applications/:publicId', async (req, res, next) => {
  try {
    ok(res, await service.getApplication(String(req.params.publicId)));
  } catch (err) {
    next(err);
  }
});

adminRoutes.patch('/applications/:publicId/verification', validate({ body: verifySchema }), async (req, res, next) => {
  try {
    ok(res, await service.updateVerification({
      actor: currentUser(req),
      applicationPublicId: String(req.params.publicId),
      checklist: req.body.checklist,
      ...(req.body.notes === undefined ? {} : { notes: req.body.notes }),
    }));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post('/applications/:publicId/approve', validate({ body: approveSchema }), async (req, res, next) => {
  try {
    const result = await service.approveApplication({
      actor: currentUser(req),
      applicationPublicId: String(req.params.publicId),
      ...(req.body.commissionPercent === undefined
        ? {}
        : { commissionPercent: req.body.commissionPercent }),
    });
    /** Slots are materialised AFTER commit — a long insert must not hold the
        transaction open (edge_cases.md §91 reasoning applies to writes too). */
    const slots = await service.materialiseArenaSlots(result.arena._id as never);
    ok(res, { arena: result.arena, courtCount: result.courtCount, slotsCreated: slots });
  } catch (err) {
    next(err);
  }
});

adminRoutes.post('/applications/:publicId/reject', validate({ body: rejectSchema }), async (req, res, next) => {
  try {
    ok(res, await service.rejectApplication({
      actor: currentUser(req),
      applicationPublicId: String(req.params.publicId),
      reason: req.body.reason,
    }));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get('/disputes', async (req, res, next) => {
  try {
    ok(res, await service.listDisputes(req.query.status ? String(req.query.status) : undefined));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post('/users/:publicId/suspend', validate({ body: suspendSchema }), async (req, res, next) => {
  try {
    ok(res, await service.suspendUser({
      actor: currentUser(req),
      userPublicId: String(req.params.publicId),
      reason: req.body.reason,
    }));
  } catch (err) {
    next(err);
  }
});

const resolveDisputeSchema = z
  .object({
    winnerTeamId: z.string().optional(),
    isVoided: z.boolean(),
    finalScore: z.object({
      creator: z.number().int().min(0),
      opponent: z.number().int().min(0),
    }).optional(),
    adminNote: z.string().min(5).max(1000),
  })
  .strict();

const adjustWalletSchema = z
  .object({
    amountPaise: z.number().int().refine((val) => val !== 0, 'Adjustment amount cannot be zero'),
    reason: z.string().min(5).max(1000),
  })
  .strict();

const rejectWithdrawalSchema = z.object({ reason: z.string().min(5).max(1000) }).strict();

const updateConfigSchema = z.object({ value: z.any() }).strict();

adminRoutes.get('/disputes/:id', async (req, res, next) => {
  try {
    ok(res, await service.getDispute(String(req.params.id)));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post('/disputes/:id/assign', async (req, res, next) => {
  try {
    ok(res, await service.assignDispute({
      actor: currentUser(req),
      disputeId: String(req.params.id),
    }));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post('/disputes/:id/resolve', validate({ body: resolveDisputeSchema }), async (req, res, next) => {
  try {
    ok(res, await service.resolveDispute(
      currentUser(req),
      String(req.params.id),
      req.body
    ));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get('/users', async (req, res, next) => {
  try {
    const search = req.query.q ? String(req.query.q) : undefined;
    ok(res, await service.listUsers(search));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post('/users/:publicId/wallet-adjust', validate({ body: adjustWalletSchema }), async (req, res, next) => {
  try {
    ok(res, await service.adjustWallet(
      currentUser(req),
      String(req.params.publicId),
      req.body.amountPaise,
      req.body.reason
    ));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get('/withdrawals', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    ok(res, await service.listWithdrawals(status));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post('/withdrawals/:id/approve', async (req, res, next) => {
  try {
    ok(res, await service.approveWithdrawal(currentUser(req), String(req.params.id)));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post('/withdrawals/:id/reject', validate({ body: rejectWithdrawalSchema }), async (req, res, next) => {
  try {
    ok(res, await service.rejectWithdrawal(
      currentUser(req),
      String(req.params.id),
      req.body.reason
    ));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get('/settlements', async (req, res, next) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    ok(res, await service.listSettlements(status));
  } catch (err) {
    next(err);
  }
});

adminRoutes.post('/settlements/:id/approve', async (req, res, next) => {
  try {
    ok(res, await service.approveSettlement(currentUser(req), String(req.params.id)));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get('/reconciliation', async (_req, res, next) => {
  try {
    ok(res, await service.getReconciliationReport());
  } catch (err) {
    next(err);
  }
});

adminRoutes.get('/config', async (_req, res, next) => {
  try {
    ok(res, await service.getConfig());
  } catch (err) {
    next(err);
  }
});

adminRoutes.patch('/config/:key', validate({ body: updateConfigSchema }), async (req, res, next) => {
  try {
    ok(res, await service.updateConfig(
      currentUser(req),
      String(req.params.key),
      req.body.value
    ));
  } catch (err) {
    next(err);
  }
});

adminRoutes.get('/audit-logs', async (_req, res, next) => {
  try {
    ok(res, await service.getAuditLogs());
  } catch (err) {
    next(err);
  }
});
