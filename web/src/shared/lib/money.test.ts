import { describe, expect, it } from 'vitest';
import {
  commissionPaise,
  formatPaise,
  formatPaiseCompact,
  paise,
  prizePoolPaise,
  rupeesToPaise,
  splitDebit,
  spendablePaise,
} from './money';

describe('formatPaise', () => {
  it('formats zero', () => {
    expect(formatPaise(0)).toBe('₹0.00');
  });

  it('formats sub-rupee amounts', () => {
    expect(formatPaise(50)).toBe('₹0.50');
  });

  it('uses Indian digit grouping, not Western', () => {
    // 1,23,456.50 — NOT 123,456.50
    expect(formatPaise(12345650)).toBe('₹1,23,456.50');
  });

  it('groups lakhs and crores correctly', () => {
    expect(formatPaise(10000000)).toBe('₹1,00,000.00'); // 1 lakh
    expect(formatPaise(1000000000)).toBe('₹1,00,00,000.00'); // 1 crore
  });

  it('formats negative amounts', () => {
    expect(formatPaise(-45000)).toBe('-₹450.00');
  });
});

describe('formatPaiseCompact', () => {
  it('drops decimals when they are zero', () => {
    expect(formatPaiseCompact(45000)).toBe('₹450');
  });

  it('keeps decimals when present', () => {
    expect(formatPaiseCompact(45050)).toBe('₹450.50');
  });
});

describe('paise', () => {
  it('rejects non-integers — floats are how wallets drift', () => {
    expect(() => paise(250.5)).toThrow(/integer paise/u);
  });

  it('accepts integers', () => {
    expect(paise(25050)).toBe(25050);
  });
});

describe('rupeesToPaise', () => {
  it('converts without float drift', () => {
    expect(rupeesToPaise(250.5)).toBe(25050);
    expect(rupeesToPaise(0.1)).toBe(10);
    // 0.1 + 0.2 !== 0.3 in float, but paise arithmetic is exact
    expect(rupeesToPaise(0.1) + rupeesToPaise(0.2)).toBe(rupeesToPaise(0.3));
  });
});

describe('commissionPaise', () => {
  it('computes exact percentages', () => {
    expect(commissionPaise(15000, 10)).toBe(1500);
  });

  it('floors so rounding never invents paise (invariant I5)', () => {
    // 7% of 33300 = 2331.0 exactly; 7% of 33333 = 2333.31 -> floor 2333
    expect(commissionPaise(33333, 7)).toBe(2333);
  });
});

describe('prizePoolPaise', () => {
  it('is 2x entry fee minus commission', () => {
    expect(prizePoolPaise(50000, 10)).toBe(90000);
  });

  it('gives the rounding remainder to the winner', () => {
    const entry = 16667;
    const pool = prizePoolPaise(entry, 7);
    expect(pool + commissionPaise(entry * 2, 7)).toBe(entry * 2);
  });
});

describe('splitDebit — edge case 28', () => {
  const wallet = { depositPaise: 30000, winningsPaise: 50000, bonusPaise: 10000 };

  it('drains bonus first, then deposit, then winnings', () => {
    expect(splitDebit(wallet, 35000)).toEqual({
      bonusPaise: 10000,
      depositPaise: 25000,
      winningsPaise: 0,
      shortfallPaise: 0,
    });
  });

  it('only touches winnings once bonus and deposit are exhausted', () => {
    const split = splitDebit(wallet, 60000);
    expect(split.bonusPaise).toBe(10000);
    expect(split.depositPaise).toBe(30000);
    expect(split.winningsPaise).toBe(20000);
  });

  it('reports the exact shortfall so the UI can prefill a top-up', () => {
    expect(splitDebit(wallet, 100000).shortfallPaise).toBe(10000);
  });

  it('never debits more than the amount requested', () => {
    const split = splitDebit(wallet, 5000);
    const total = split.bonusPaise + split.depositPaise + split.winningsPaise;
    expect(total).toBe(5000);
  });
});

describe('spendablePaise', () => {
  it('sums all three buckets', () => {
    expect(spendablePaise({ depositPaise: 100, winningsPaise: 200, bonusPaise: 300 })).toBe(600);
  });
});
