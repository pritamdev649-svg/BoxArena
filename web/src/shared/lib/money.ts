/**
 * Money handling. Read this before touching any rupee value.
 *
 * ALL money is integer PAISE. ₹250.50 => 25050.
 * Floats are banned: IEEE-754 cannot represent 0.1, and a wallet that drifts
 * by ₹0.01 per transaction is a legal liability in a real-money product.
 *
 * Divide by 100 ONLY at the render boundary — which is what this file is.
 *
 * See mongodb_schemas.ts header and code_standards.md §3.
 */

/** Branded so a bare number can't be passed where paise is expected. */
export type Paise = number & { readonly __brand: 'Paise' };

export function paise(value: number): Paise {
  if (!Number.isInteger(value)) {
    throw new Error(`Money must be integer paise, received ${value}`);
  }
  return value as Paise;
}

/** ₹250.50 -> 25050. Use only when accepting user input. */
export function rupeesToPaise(rupees: number): Paise {
  return paise(Math.round(rupees * 100));
}

/**
 * Indian digit grouping: 1,23,456 — not 123,456.
 * `en-IN` gets this right; `en-US` does not.
 */
const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_WHOLE_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 25050 -> "₹250.50". Always renders inside a .tabular element. */
export function formatPaise(value: number): string {
  return INR_FORMATTER.format(value / 100);
}

/**
 * 25000 -> "₹250", 25050 -> "₹250.50".
 * Drops the decimals when they're zero — most turf prices are whole rupees
 * and "₹450.00" everywhere is visual noise.
 */
export function formatPaiseCompact(value: number): string {
  return value % 100 === 0 ? INR_WHOLE_FORMATTER.format(value / 100) : formatPaise(value);
}

/** Splits into parts so the UI can style the symbol separately. */
export function splitPaise(value: number): { symbol: string; amount: string } {
  const formatted = formatPaiseCompact(value);
  return { symbol: '₹', amount: formatted.replace(/^₹\s?/u, '') };
}

/**
 * Platform commission. ALWAYS floors — the remainder goes to the winner.
 * Rounding must never create paise from nothing (invariant I5).
 */
export function commissionPaise(totalPaise: number, percent: number): Paise {
  return paise(Math.floor((totalPaise * percent) / 100));
}

/** prizePool = 2 * entryFee - commission. Locked at accept time, not payout. */
export function prizePoolPaise(entryFeePaise: number, commissionPercent: number): Paise {
  const pot = entryFeePaise * 2;
  return paise(pot - commissionPaise(pot, commissionPercent));
}

/**
 * Debit order is always bonus -> deposit -> winnings (edge case 28).
 * Maximises what stays withdrawable for the user, and is the industry norm.
 * A single charge may span buckets — each becomes its own ledger row.
 */
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

export function splitDebit(wallet: WalletBuckets, amountPaise: number): DebitSplit {
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

/** Locked funds are already out of the buckets — they are not spendable. */
export function spendablePaise(wallet: WalletBuckets): number {
  return wallet.depositPaise + wallet.winningsPaise + wallet.bonusPaise;
}
