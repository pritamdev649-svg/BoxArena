import { Router } from 'express';
import { TransactionModel } from '../../models/index.js';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { ok, paginated } from '../../shared/utils/response.js';
import { spendablePaise } from '../../shared/utils/money.js';

export const walletRoutes = Router();
walletRoutes.use(authenticate);

walletRoutes.get('/', (req, res, next) => {
  try {
    const { wallet } = currentUser(req);
    ok(res, {
      depositPaise: wallet.depositPaise,
      winningsPaise: wallet.winningsPaise,
      /** Bonus is playable but NEVER withdrawable — say so explicitly. */
      bonusPaise: wallet.bonusPaise,
      bonusIsWithdrawable: false,
      lockedPaise: wallet.lockedPaise,
      spendablePaise: spendablePaise(wallet),
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
