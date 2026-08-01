import { cn } from '@/shared/lib/cn';

/**
 * Headline metric. Owners think in revenue, so GTV leads every partner view
 * (competitive_analysis.md §6).
 *
 * No card border by default — a row of tiles separated by whitespace reads as
 * a dashboard; four bordered boxes read as four unrelated things (§8.3).
 */
export function StatTile({
  label,
  value,
  sublabel,
  tone = 'default',
  className,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'default' | 'accent' | 'warning';
  className?: string;
}) {
  const valueTone = {
    default: 'text-ink',
    accent: 'text-gold',
    warning: 'text-dispute',
  }[tone];

  return (
    <div className={className}>
      <p className="label-caps text-ink-muted">{label}</p>
      <p className={cn('font-display tabular mt-2 text-3xl', valueTone)}>{value}</p>
      {sublabel ? <p className="text-ink-muted mt-1 text-xs">{sublabel}</p> : null}
    </div>
  );
}
