import crypto from 'node:crypto';
import type { Types } from 'mongoose';
import {
  PaymentOrderModel,
  PaymentOrderStatus,
  PaymentProvider,
  TransactionType,
  WalletBucket,
  type IUser,
} from '../../models/index.js';
import { withTransaction } from '../../shared/config/db.js';
import { env } from '../../shared/config/env.js';
import { logger } from '../../shared/config/logger.js';
import { BadRequestError, NotFoundError } from '../../shared/errors/app-error.js';
import { publicId } from '../../shared/utils/ids.js';
import { applyLedgerEntry } from '../wallet/wallet.service.js';

/**
 * Wallet top-ups via Razorpay (edge_cases.md §3).
 *
 * Two things carry the whole design:
 *  1. Webhook signatures are verified against the RAW body. Parsing to JSON
 *     and re-stringifying changes the bytes and breaks the HMAC (§31).
 *  2. Every credit path is idempotent. Razorpay retries on non-2xx and can
 *     deliver duplicates; the client callback and the webhook both credit, so
 *     they must converge on ONE transaction (§30, §32).
 */

const MIN_TOPUP_PAISE = 10_000; // ₹100

export async function createTopupOrder(input: {
  user: IUser;
  amountPaise: number;
}): Promise<{ orderId: string; amountPaise: number; keyId: string; isMock: boolean }> {
  if (!Number.isInteger(input.amountPaise) || input.amountPaise < MIN_TOPUP_PAISE) {
    throw new BadRequestError(`Minimum top-up is ₹${String(MIN_TOPUP_PAISE / 100)}`);
  }

  /** Responsible gaming: a user-set ceiling is enforced server-side (§43). */
  if (input.user.monthlyDepositLimitPaise) {
    const spent = await depositedThisMonth(input.user._id as Types.ObjectId);
    if (spent + input.amountPaise > input.user.monthlyDepositLimitPaise) {
      throw new BadRequestError(
        'This would exceed the monthly deposit limit you set for yourself',
      );
    }
  }

  const useMock = env.ENABLE_MOCK_PAYMENTS || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET;
  const providerOrderId = useMock
    ? `order_mock_${publicId('m')}`
    : await createRazorpayOrder(input.amountPaise);

  await PaymentOrderModel.create({
    userId: input.user._id,
    provider: useMock ? PaymentProvider.MOCK : PaymentProvider.RAZORPAY,
    providerOrderId,
    amountPaise: input.amountPaise,
    status: PaymentOrderStatus.CREATED,
    purpose: 'wallet_topup',
  });

  return {
    orderId: providerOrderId,
    amountPaise: input.amountPaise,
    keyId: env.RAZORPAY_KEY_ID ?? 'mock',
    isMock: useMock,
  };
}

async function createRazorpayOrder(amountPaise: number): Promise<string> {
  const { default: Razorpay } = await import('razorpay');
  const client = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID ?? '',
    key_secret: env.RAZORPAY_KEY_SECRET ?? '',
  });

  const order = await client.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: publicId('rcpt'),
  });

  return order.id;
}

async function depositedThisMonth(userId: Types.ObjectId): Promise<number> {
  const { TransactionModel } = await import('../../models/index.js');
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const rows = await TransactionModel.aggregate<{ total: number }>([
    {
      $match: {
        userId,
        type: TransactionType.DEPOSIT,
        createdAt: { $gte: monthStart },
      },
    },
    { $group: { _id: null, total: { $sum: '$amountPaise' } } },
  ]);

  return rows[0]?.total ?? 0;
}

/**
 * Credits a paid order exactly once.
 *
 * Guarded on `status !== PAID` inside the transaction, and the ledger's unique
 * idempotencyKey is the second line of defence — so a replayed webhook, a
 * duplicate delivery, and the client callback all converge on one credit.
 */
export async function creditPaidOrder(input: {
  providerOrderId: string;
  providerPaymentId?: string;
}): Promise<{ credited: boolean; amountPaise: number }> {
  return withTransaction(async (session) => {
    const order = await PaymentOrderModel.findOne({
      providerOrderId: input.providerOrderId,
    }).session(session);

    if (!order) throw new NotFoundError('Payment order');

    /** Already credited — return success so retries stay idempotent. */
    if (order.status === PaymentOrderStatus.PAID) {
      return { credited: false, amountPaise: order.amountPaise };
    }

    await applyLedgerEntry(
      {
        userId: order.userId,
        bucket: WalletBucket.DEPOSIT,
        amountPaise: order.amountPaise,
        type: TransactionType.DEPOSIT,
        description: 'Wallet top-up',
        /** Keyed on the ORDER, so every delivery path collides here. */
        idempotencyKey: `topup:${order.providerOrderId}`,
        referenceType: 'PaymentOrder',
        referenceId: order._id as Types.ObjectId,
      },
      session,
    );

    order.status = PaymentOrderStatus.PAID;
    if (input.providerPaymentId) order.providerPaymentId = input.providerPaymentId;
    await order.save({ session });

    return { credited: true, amountPaise: order.amountPaise };
  });
}

/**
 * Verifies the client-side callback signature.
 * HMAC over `order_id|payment_id` with the key secret — Razorpay's documented
 * scheme for confirming a checkout result came from them.
 */
export function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (env.ENABLE_MOCK_PAYMENTS) return true;
  if (!env.RAZORPAY_KEY_SECRET) return false;

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');

  return timingSafeEqual(expected, input.signature);
}

/**
 * Verifies a webhook against the RAW request body.
 *
 * This MUST receive the exact bytes Razorpay sent. Express's JSON parser
 * reformats them, which is why the webhook route mounts express.raw() (§31).
 */
export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  if (!env.RAZORPAY_WEBHOOK_SECRET) return false;

  const expected = crypto
    .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

export interface RazorpayWebhookEvent {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    order?: { entity?: { id?: string } };
  };
}

/**
 * Processes a verified webhook. Deduped on the delivery id so a redelivery is
 * a no-op even before the ledger guard fires.
 */
export async function handleWebhook(input: {
  event: RazorpayWebhookEvent;
  deliveryId: string;
}): Promise<{ handled: boolean }> {
  const orderId =
    input.event.payload?.payment?.entity?.order_id ?? input.event.payload?.order?.entity?.id;

  if (!orderId) return { handled: false };

  const order = await PaymentOrderModel.findOne({ providerOrderId: orderId });
  if (!order) {
    logger.warn({ orderId, event: input.event.event }, 'Webhook for unknown order');
    return { handled: false };
  }

  const seen = order.webhookEvents.some((entry) => entry.eventId === input.deliveryId);
  if (seen) return { handled: true };

  order.webhookEvents.push({
    eventId: input.deliveryId,
    event: input.event.event,
    payload: input.event.payload,
    receivedAt: new Date(),
  });
  await order.save();

  if (input.event.event === 'payment.captured' || input.event.event === 'order.paid') {
    const paymentId = input.event.payload?.payment?.entity?.id;
    await creditPaidOrder({
      providerOrderId: orderId,
      ...(paymentId === undefined ? {} : { providerPaymentId: paymentId }),
    });
  }

  if (input.event.event === 'payment.failed') {
    order.status = PaymentOrderStatus.FAILED;
    await order.save();
  }

  return { handled: true };
}

/**
 * Reconciliation sweep: money must never be stuck because our server was down
 * when the webhook fired (§33).
 */
export async function reconcileStuckOrders(olderThanMinutes = 10): Promise<number> {
  if (env.ENABLE_MOCK_PAYMENTS) return 0;

  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const stuck = await PaymentOrderModel.find({
    status: { $in: [PaymentOrderStatus.CREATED, PaymentOrderStatus.ATTEMPTED] },
    createdAt: { $lt: cutoff },
    provider: PaymentProvider.RAZORPAY,
  }).limit(50);

  let reconciled = 0;

  for (const order of stuck) {
    try {
      const { default: Razorpay } = await import('razorpay');
      const client = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID ?? '',
        key_secret: env.RAZORPAY_KEY_SECRET ?? '',
      });

      const remote = await client.orders.fetch(order.providerOrderId);
      if (remote.status === 'paid') {
        await creditPaidOrder({ providerOrderId: order.providerOrderId });
        reconciled += 1;
      }
    } catch (err) {
      logger.error({ err, orderId: order.providerOrderId }, 'Reconciliation failed');
    }
  }

  return reconciled;
}
