import { cn } from '@/shared/lib/cn';

/**
 * Small status token. Outcome is never conveyed by colour alone — every badge
 * carries a label (design_system.md §2, rule 3).
 */
export type BadgeTone = 'neutral' | 'win' | 'loss' | 'warning' | 'info' | 'accent';

const TONE: Record<BadgeTone, string> = {
  neutral: 'border-line text-ink-secondary',
  win: 'border-win/40 text-win',
  loss: 'border-loss/40 text-loss',
  warning: 'border-dispute/50 bg-dispute/10 text-dispute',
  info: 'border-info/40 text-info',
  accent: 'border-volt bg-volt/15 text-volt-ink font-semibold',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'label-caps rounded-chip inline-flex items-center border px-2 py-1',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
