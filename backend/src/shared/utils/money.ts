/**
 * ALL money is integer paise. Floats are banned — see mongodb_schemas.ts
 * header. This module is the only place money arithmetic happens.
 */

export function assertPaise(value: number, label = 'amount'): number {
  if (!Number.isInteger(value)) throw new Error(`${label} must be integer paise, got ${value}`);
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

/**
 * Commission ALWAYS floors — the remainder goes to the winner. Rounding must
 * never create paise from nothing (invariant I5).
 */
export function commissionPaise(totalPaise: number, percent: number): number {
  return Math.floor((assertPaise(totalPaise) * percent) / 100);
}

/** prizePool = 2 * entryFee - commission. Locked at accept time, not payout. */
export function prizePoolPaise(entryFeePaise: number, commissionPercent: number): number {
  const pot = assertPaise(entryFeePaise) * 2;
  return pot - commissionPaise(pot, commissionPercent);
}

export interface WalletBuckets {
  depositPaise: number;
  winningsPaise: number;
  bonusPaise: number;
}

export interface DebitSplit {
  bonusPaise: number;
  depositPaise: number;
  winningsPaise: number;
  shortfallPaise: number;
}

/**
 * Debit order is always bonus -> deposit -> winnings (edge case 28).
 * Maximises what stays withdrawable for the user. A single charge may span
 * buckets — each becomes its own ledger row.
 */
export function splitDebit(wallet: WalletBuckets, amountPaise: number): DebitSplit {
  assertPaise(amountPaise);
  let remaining = amountPaise;

  const fromBonus = Math.min(wallet.bonusPaise, remaining);
  remaining -= fromBonus;
  const fromDeposit = Math.min(wallet.depositPaise, remaining);
  remaining -= fromDeposit;
  const fromWinnings = Math.min(wallet.winningsPaise, remaining);
  remaining -= fromWinnings;

  return {
    bonusPaise: fromBonus,
    depositPaise: fromDeposit,
    winningsPaise: fromWinnings,
    shortfallPaise: remaining,
  };
}

export function spendablePaise(wallet: WalletBuckets): number {
  return wallet.depositPaise + wallet.winningsPaise + wallet.bonusPaise;
}

export function formatPaise(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(value / 100);
}
