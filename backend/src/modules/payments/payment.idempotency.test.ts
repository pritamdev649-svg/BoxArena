import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Types } from 'mongoose';
import { clearDatabase, startTestDatabase, stopTestDatabase } from '../../test/setup.js';
import {
  PaymentOrderModel,
  PaymentOrderStatus,
  PaymentProvider,
  TransactionModel,
  UserModel,
  type IUser,
} from '../../models/index.js';
import { publicId, referralCode } from '../../shared/utils/ids.js';
import { creditPaidOrder, handleWebhook } from './payment.service.js';

/**
 * Razorpay retries webhooks and can deliver duplicates, and the client
 * callback credits down the same path. Double-crediting a wallet is the
 * single most damaging bug this system could have (edge_cases.md §30, §32).
 */

beforeAll(async () => {
  await startTestDatabase();
});
afterAll(async () => {
  await stopTestDatabase();
});
beforeEach(async () => {
  await clearDatabase();
});

async function makeUserAndOrder(amountPaise = 50_000): Promise<{ user: IUser; orderId: string }> {
  const user = await UserModel.create({
    publicId: publicId('usr'),
    phoneNumber: `+9198${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`,
    fullName: 'Payment Test',
    referralCode: referralCode(),
  });

  const orderId = `order_${publicId('t')}`;
  await PaymentOrderModel.create({
    userId: user._id,
    provider: PaymentProvider.MOCK,
    providerOrderId: orderId,
    amountPaise,
    status: PaymentOrderStatus.CREATED,
    purpose: 'wallet_topup',
  });

  return { user, orderId };
}

describe('top-up crediting is idempotent', () => {
  it('credits the wallet exactly once for a paid order', async () => {
    const { user, orderId } = await makeUserAndOrder();

    const first = await creditPaidOrder({ providerOrderId: orderId });
    expect(first.credited).toBe(true);

    const after = await UserModel.findById(user._id);
    expect(after?.wallet.depositPaise).toBe(50_000);
  });

  it('does NOT double-credit when called twice', async () => {
    const { user, orderId } = await makeUserAndOrder();

    await creditPaidOrder({ providerOrderId: orderId });
    const second = await creditPaidOrder({ providerOrderId: orderId });

    expect(second.credited).toBe(false);

    const after = await UserModel.findById(user._id);
    expect(after?.wallet.depositPaise).toBe(50_000);
    expect(await TransactionModel.countDocuments({ userId: user._id })).toBe(1);
  });

  it('credits once when the SAME webhook is delivered three times', async () => {
    const { user, orderId } = await makeUserAndOrder(75_000);

    const event = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: orderId } } },
    };

    await handleWebhook({ event, deliveryId: 'evt_same' });
    await handleWebhook({ event, deliveryId: 'evt_same' });
    await handleWebhook({ event, deliveryId: 'evt_same' });

    const after = await UserModel.findById(user._id);
    expect(after?.wallet.depositPaise).toBe(75_000);
    expect(await TransactionModel.countDocuments({ userId: user._id })).toBe(1);
  });

  it('credits once even when DIFFERENT delivery ids describe the same payment', async () => {
    const { user, orderId } = await makeUserAndOrder(20_000);

    const event = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_2', order_id: orderId } } },
    };

    /** Distinct ids bypass the dedupe list, so the ledger guard must hold. */
    await handleWebhook({ event, deliveryId: 'evt_a' });
    await handleWebhook({ event, deliveryId: 'evt_b' });

    const after = await UserModel.findById(user._id);
    expect(after?.wallet.depositPaise).toBe(20_000);
    expect(await TransactionModel.countDocuments({ userId: user._id })).toBe(1);
  });

  it('survives the webhook and the client callback racing', async () => {
    const { user, orderId } = await makeUserAndOrder(30_000);

    const results = await Promise.allSettled([
      creditPaidOrder({ providerOrderId: orderId }),
      handleWebhook({
        event: {
          event: 'order.paid',
          payload: { order: { entity: { id: orderId } } },
        },
        deliveryId: 'evt_race',
      }),
    ]);

    /** At least one path must succeed, and the balance must be exact. */
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);

    const after = await UserModel.findById(user._id);
    expect(after?.wallet.depositPaise).toBe(30_000);
    expect(await TransactionModel.countDocuments({ userId: user._id })).toBe(1);
  });

  it('records the ledger row against the payment order', async () => {
    const { user, orderId } = await makeUserAndOrder();
    await creditPaidOrder({ providerOrderId: orderId });

    const row = await TransactionModel.findOne({ userId: user._id as Types.ObjectId });
    expect(row?.referenceType).toBe('PaymentOrder');
    expect(row?.idempotencyKey).toBe(`topup:${orderId}`);
  });
});
