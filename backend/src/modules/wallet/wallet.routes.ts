import { Router } from 'express';
import { TransactionModel } from '../../models/index.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { z } from 'zod';
import { created, ok, paginated } from '../../shared/utils/response.js';
import { validate } from '../../shared/middlewares/validate.js';
import { BadRequestError } from '../../shared/errors/app-error.js';
import * as withdrawal from './withdrawal.service.js';
import { spendablePaise } from '../../shared/utils/money.js';

export const walletRoutes = Router();
walletRoutes.use(authenticate);

walletRoutes.get('/', (req, res, next) => {
  try {
    const user = currentUser(req);
    const { wallet } = user;
    ok(res, {
      depositPaise: wallet.depositPaise,
      winningsPaise: wallet.winningsPaise,
      /** Bonus is playable but NEVER withdrawable — say so explicitly. */
      bonusPaise: wallet.bonusPaise,
      bonusIsWithdrawable: false,
      lockedPaise: wallet.lockedPaise,
      spendablePaise: spendablePaise(wallet),
      /**
       * Everything the withdrawal form needs to render honestly in one trip.
       * A form that asks for an amount and only then reveals "verify your
       * identity first" wastes the player's time; the UI can now say so up
       * front, and the service still enforces all of it server-side.
       */
      withdrawal: {
        enabled: withdrawal.withdrawalsEnabled(),
        kycStatus: user.kyc.status,
        hasPayoutDestination: Boolean(user.bankAccount?.ifsc ?? user.bankAccount?.vpa),
        minWithdrawalPaise: withdrawal.MIN_WITHDRAWAL_PAISE,
        tdsPercent: withdrawal.TDS_PERCENT,
        withdrawablePaise: wallet.winningsPaise,
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Cursor-paginated: an unbounded ledger will eventually OOM the server (§97). */
walletRoutes.get('/transactions', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const after = req.query.after ? String(req.query.after) : null;

    const rows = await TransactionModel.find({
      userId: currentUser(req)._id,
      ...(after ? { _id: { $lt: after } } : {}),
    })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    paginated(res, page, hasMore && last ? String(last._id) : null);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Withdrawals (B6)
//
// Winnings only, KYC first, debited on request so a player cannot spend the
// same rupees twice while ops works the queue.
// ---------------------------------------------------------------------------

const withdrawSchema = z
  .object({
    amountPaise: z.number().int().min(10_000),
    prefer: z.enum(['bank', 'upi']).optional(),
  })
  .strict();

walletRoutes.post('/withdraw', validate({ body: withdrawSchema }), async (req, res, next) => {
  try {
    if (!withdrawal.withdrawalsEnabled()) {
      throw new BadRequestError('Withdrawals are not open yet');
    }
    created(res, await withdrawal.requestWithdrawal({
      user: currentUser(req),
      amountPaise: req.body.amountPaise,
      ...(req.body.prefer === undefined ? {} : { prefer: req.body.prefer }),
    }));
  } catch (err) {
    next(err);
  }
});

walletRoutes.get('/withdrawals', async (req, res, next) => {
  try {
    ok(res, await withdrawal.listMyWithdrawals(currentUser(req)));
  } catch (err) {
    next(err);
  }
});
