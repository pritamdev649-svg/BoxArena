import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Types } from 'mongoose';
import { clearDatabase, startTestDatabase, stopTestDatabase } from '../../test/setup.js';
import {
  TransactionModel,
  TransactionType,
  UserModel,
  WalletBucket,
  type IUser,
} from '../../models/index.js';
import { withTransaction } from '../../shared/config/db.js';
import { publicId, referralCode } from '../../shared/utils/ids.js';
import { applyLedgerEntry, debitWallet, reconcileUser } from './wallet.service.js';

/**
 * INVARIANT I1: sum(ledger) == cached wallet balance, always.
 *
 * This is the single most important guarantee in the product. If it can drift,
 * the platform cannot be trusted with money.
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

async function makeUser(
  buckets: Partial<{ depositPaise: number; winningsPaise: number; bonusPaise: number }> = {},
): Promise<IUser> {
  return UserModel.create({
    publicId: publicId('usr'),
    phoneNumber: `+9198${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`,
    fullName: 'Ledger Test',
    referralCode: referralCode(),
    wallet: {
      depositPaise: buckets.depositPaise ?? 0,
      winningsPaise: buckets.winningsPaise ?? 0,
      bonusPaise: buckets.bonusPaise ?? 0,
      lockedPaise: 0,
    },
  });
}

/** Seeds a bucket THROUGH the ledger so the invariant holds from the start. */
async function credit(user: IUser, bucket: WalletBucket, amountPaise: number): Promise<void> {
  await withTransaction(async (session) => {
    await applyLedgerEntry(
      {
        userId: user._id as Types.ObjectId,
        bucket,
        amountPaise,
        type: TransactionType.DEPOSIT,
        description: 'seed',
        idempotencyKey: `seed:${publicId('k')}`,
      },
      session,
    );
  });
}

describe('invariant I1 — ledger sum equals wallet balance', () => {
  it('holds after 200 randomised credits and debits', async () => {
    const user = await makeUser();
    await credit(user, WalletBucket.DEPOSIT, 5_000_000);

    for (let i = 0; i < 200; i += 1) {
      const fresh = await UserModel.findById(user._id);
      if (!fresh) throw new Error('user vanished');

      const isCredit = i % 3 === 0;
      const amount = 100 + Math.floor(Math.random() * 5_000);

      await withTransaction(async (session) => {
        if (isCredit) {
          await applyLedgerEntry(
            {
              userId: fresh._id as Types.ObjectId,
              bucket: WalletBucket.WINNINGS,
              amountPaise: amount,
              type: TransactionType.PRIZE_PAYOUT,
              description: `credit ${String(i)}`,
              idempotencyKey: `op:${String(i)}`,
            },
            session,
          );
        } else {
          await debitWallet(
            {
              user: fresh,
              amountPaise: amount,
              type: TransactionType.BOOKING_FEE,
              description: `debit ${String(i)}`,
              idempotencyKey: `op:${String(i)}`,
            },
            session,
          );
        }
      });
    }

    const report = await reconcileUser(user._id as Types.ObjectId);
    expect(report.isConsistent).toBe(true);
    expect(report.drift).toEqual({ deposit: 0, winnings: 0, bonus: 0 });
  });

  it('stamps balanceAfterPaise so the ledger can be replayed', async () => {
    const user = await makeUser();
    await credit(user, WalletBucket.DEPOSIT, 100_000);
    await credit(user, WalletBucket.DEPOSIT, 50_000);

    const rows = await TransactionModel.find({ userId: user._id }).sort({ createdAt: 1 });
    expect(rows.map((r) => r.balanceAfterPaise)).toEqual([100_000, 150_000]);
  });
});

describe('debit ordering — edge_cases.md §28', () => {
  it('drains bonus first, then deposit, then winnings', async () => {
    const user = await makeUser();
    await credit(user, WalletBucket.BONUS, 10_000);
    await credit(user, WalletBucket.DEPOSIT, 30_000);
    await credit(user, WalletBucket.WINNINGS, 50_000);

    const fresh = await UserModel.findById(user._id);
    if (!fresh) throw new Error('user vanished');

    await withTransaction(async (session) => {
      await debitWallet(
        {
          user: fresh,
          amountPaise: 35_000,
          type: TransactionType.BOOKING_FEE,
          description: 'split debit',
          idempotencyKey: 'split-1',
        },
        session,
      );
    });

    const after = await UserModel.findById(user._id);
    expect(after?.wallet.bonusPaise).toBe(0);
    expect(after?.wallet.depositPaise).toBe(5_000);
    /** Winnings are untouched — they stay withdrawable for the user. */
    expect(after?.wallet.winningsPaise).toBe(50_000);

    /** One charge spanning two buckets writes TWO ledger rows, not one. */
    const debits = await TransactionModel.find({ userId: user._id, amountPaise: { $lt: 0 } });
    expect(debits).toHaveLength(2);
    expect(debits.map((d) => d.bucket).sort()).toEqual(['bonus', 'deposit']);
  });
});

describe('concurrency and negative balances — §38, §39', () => {
  it('never lets a balance go negative under parallel debits', async () => {
    const user = await makeUser();
    await credit(user, WalletBucket.DEPOSIT, 10_000);

    /** Ten parallel attempts to spend 3,000 from a 10,000 balance. */
    const attempts = Array.from({ length: 10 }, (_, i) =>
      withTransaction(async (session) =>
        applyLedgerEntry(
          {
            userId: user._id as Types.ObjectId,
            bucket: WalletBucket.DEPOSIT,
            amountPaise: -3_000,
            type: TransactionType.BOOKING_FEE,
            description: `parallel ${String(i)}`,
            idempotencyKey: `par:${String(i)}`,
          },
          session,
        ),
      ),
    );

    const results = await Promise.allSettled(attempts);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;

    /** 10,000 / 3,000 = 3 whole debits, and not one more. */
    expect(succeeded).toBe(3);

    const after = await UserModel.findById(user._id);
    expect(after?.wallet.depositPaise).toBe(1_000);
    expect(after?.wallet.depositPaise).toBeGreaterThanOrEqual(0);

    const report = await reconcileUser(user._id as Types.ObjectId);
    expect(report.isConsistent).toBe(true);
  });

  it('reports the exact shortfall so the UI can prefill a top-up', async () => {
    const user = await makeUser();
    await credit(user, WalletBucket.DEPOSIT, 5_000);
    const fresh = await UserModel.findById(user._id);
    if (!fresh) throw new Error('user vanished');

    await expect(
      withTransaction(async (session) =>
        debitWallet(
          {
            user: fresh,
            amountPaise: 8_000,
            type: TransactionType.BOOKING_FEE,
            description: 'too much',
            idempotencyKey: 'short-1',
          },
          session,
        ),
      ),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
      details: { shortfallPaise: 3_000 },
    });
  });
});

describe('ledger immutability', () => {
  it('refuses to update a Transaction row', async () => {
    const user = await makeUser();
    await credit(user, WalletBucket.DEPOSIT, 1_000);

    await expect(
      TransactionModel.updateOne({ userId: user._id }, { $set: { amountPaise: 999_999 } }),
    ).rejects.toThrow(/append-only/u);
  });

  it('rejects a duplicate idempotency key, blocking double-credit', async () => {
    const user = await makeUser();
    await TransactionModel.syncIndexes();
    await credit(user, WalletBucket.DEPOSIT, 1_000);

    const duplicate = withTransaction(async (session) =>
      applyLedgerEntry(
        {
          userId: user._id as Types.ObjectId,
          bucket: WalletBucket.DEPOSIT,
          amountPaise: 1_000,
          type: TransactionType.DEPOSIT,
          description: 'replayed webhook',
          idempotencyKey: 'fixed-key',
        },
        session,
      ),
    );
    await duplicate;

    await expect(
      withTransaction(async (session) =>
        applyLedgerEntry(
          {
            userId: user._id as Types.ObjectId,
            bucket: WalletBucket.DEPOSIT,
            amountPaise: 1_000,
            type: TransactionType.DEPOSIT,
            description: 'replayed webhook',
            idempotencyKey: 'fixed-key',
          },
          session,
        ),
      ),
    ).rejects.toThrow();
  });
});
