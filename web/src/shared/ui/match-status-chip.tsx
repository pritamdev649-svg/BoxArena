import { cn } from '@/shared/lib/cn';

/**
 * One glanceable token for where a match stands (design_system.md §5).
 *
 * Outcome is NEVER encoded by colour alone — every chip carries a label.
 * ~8% of Indian men have some red-green deficiency, and this app is largely
 * men reading red-green win/loss states (§2, rule 3).
 */
export type MatchStatus =
  | 'scheduled'
  | 'awaiting_scores'
  | 'needs_your_confirmation'
  | 'verified'
  | 'disputed'
  | 'voided';

const STATUS_CONFIG: Record<MatchStatus, { label: string; className: string }> = {
  scheduled: {
    label: 'Scheduled',
    className: 'border-line text-ink-secondary',
  },
  awaiting_scores: {
    label: 'Awaiting scores',
    className: 'border-info/40 text-info',
  },
  /** The one state that must be unmissable — money is waiting on it. */
  needs_your_confirmation: {
    label: 'Needs your confirmation',
    className: 'border-volt bg-volt/15 text-volt-ink font-semibold',
  },
  verified: {
    label: 'Verified',
    className: 'border-win/40 text-win',
  },
  disputed: {
    label: 'Disputed',
    className: 'border-dispute/50 bg-dispute/10 text-dispute',
  },
  voided: {
    label: 'Voided',
    className: 'border-line-subtle text-ink-muted line-through',
  },
};

export function MatchStatusChip({
  status,
  className,
}: {
  status: MatchStatus;
  className?: string;
}) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'label-caps inline-flex items-center rounded-chip border px-2 py-1',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
