import { cn } from '@/shared/lib/cn';
import { formatPaiseCompact } from '@/shared/lib/money';

/**
 * The ONLY place rupees get rendered. Components never do money arithmetic
 * (code_standards.md §5, rule 8).
 *
 * Always tabular — a price column whose digits shift width as values change
 * looks broken and reads as amateur (§3).
 */
export function MoneyText({
  paise: value,
  tone = 'default',
  className,
}: {
  paise: number;
  /** `prize` is gold. Users learn gold = real money, so protect it (§2, rule 2). */
  tone?: 'default' | 'muted' | 'prize' | 'credit' | 'debit';
  className?: string;
}) {
  const toneClass = {
    default: 'text-ink',
    muted: 'text-ink-secondary',
    prize: 'text-gold',
    credit: 'text-win',
    debit: 'text-loss',
  }[tone];

  return <span className={cn('tabular', toneClass, className)}>{formatPaiseCompact(value)}</span>;
}

/**
 * Prize money badge. Gold, never volt — a gold pill next to a rupee amount
 * is how a user recognises real stakes at a glance (§5).
 */
export function PrizeBadge({ paise: value, className }: { paise: number; className?: string }) {
  return (
    <span
      className={cn(
        'border-gold/40 bg-gold/10 text-gold inline-flex items-center gap-1.5',
        'rounded-chip border px-2 py-1',
        className,
      )}
    >
      <span className="label-caps">Prize</span>
      <span className="tabular text-sm font-semibold">{formatPaiseCompact(value)}</span>
    </span>
  );
}
