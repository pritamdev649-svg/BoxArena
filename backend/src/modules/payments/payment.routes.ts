import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { validate } from '../../shared/middlewares/validate.js';
import { logger } from '../../shared/config/logger.js';
import { BadRequestError } from '../../shared/errors/app-error.js';
import { created, ok } from '../../shared/utils/response.js';
import * as service from './payment.service.js';

export const paymentRoutes = Router();

const orderSchema = z.object({ amountPaise: z.number().int().min(10_000) }).strict();

const verifySchema = z
  .object({
    orderId: z.string(),
    paymentId: z.string(),
    signature: z.string(),
  })
  .strict();

paymentRoutes.post(
  '/topup/order',
  authenticate,
  validate({ body: orderSchema }),
  async (req, res, next) => {
    try {
      created(res, await service.createTopupOrder({
        user: currentUser(req),
        amountPaise: req.body.amountPaise,
      }));
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Client callback. Converges with the webhook on the same ledger row, so
 * whichever arrives first credits and the other is a no-op (edge_cases.md §32).
 */
paymentRoutes.post(
  '/topup/verify',
  authenticate,
  validate({ body: verifySchema }),
  async (req, res, next) => {
    try {
      const valid = service.verifyCheckoutSignature({
        orderId: req.body.orderId,
        paymentId: req.body.paymentId,
        signature: req.body.signature,
      });
      if (!valid) throw new BadRequestError('Payment signature could not be verified');

      const result = await service.creditPaidOrder({
        providerOrderId: req.body.orderId,
        providerPaymentId: req.body.paymentId,
      });
      ok(res, result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Razorpay webhook. NOT authenticated — the signature is the authentication.
 *
 * `req.body` here is a Buffer, because app.ts mounts express.raw() on this
 * path. Verifying against re-serialised JSON would always fail (§31).
 */
export const webhookRoutes = Router();

webhookRoutes.post('/razorpay', async (req: Request, res, next) => {
  try {
    const signature = req.header('x-razorpay-signature');
    const deliveryId = req.header('x-razorpay-event-id') ?? `no-id-${Date.now().toString(36)}`;
    const raw = req.body as Buffer;

    if (!signature || !Buffer.isBuffer(raw)) {
      throw new BadRequestError('Malformed webhook');
    }

    if (!service.verifyWebhookSignature(raw, signature)) {
      logger.warn({ deliveryId }, 'Razorpay webhook signature rejected');
      /** 400, not 401 — Razorpay retries on 5xx, and a forged call should not
          cause us to be hammered. */
      throw new BadRequestError('Invalid signature');
    }

    const event = JSON.parse(raw.toString('utf8')) as service.RazorpayWebhookEvent;
    await service.handleWebhook({ event, deliveryId });

    /** Return 200 fast; heavy work is already idempotent. */
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});
