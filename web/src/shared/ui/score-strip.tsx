import { cn } from '@/shared/lib/cn';

/**
 * The thing people screenshot and send to WhatsApp (design_system.md §5).
 *
 * No card, no shadow — a hairline rule and type hierarchy do the work. The
 * winner gets a hard volt left edge, borrowed from a TV lower-third. Must
 * stay legible at thumbnail size and inside a 1200x630 OG image.
 */

export interface ScoreStripSide {
  name: string;
  /** Badminton: per-game points. Cricket/football: a single figure. */
  score: string;
  isWinner: boolean;
}

export function ScoreStrip({
  home,
  away,
  meta,
  className,
}: {
  home: ScoreStripSide;
  away: ScoreStripSide;
  /** "Today · 6:00 PM · The Turf Arena" */
  meta?: string;
  className?: string;
}) {
  return (
    <div className={cn('bg-surface border-line-subtle border', className)}>
      {meta ? (
        <p className="label-caps text-ink-muted border-line-subtle border-b px-4 py-2">{meta}</p>
      ) : null}

      <div className="divide-line-subtle divide-y">
        <ScoreRow side={home} />
        <ScoreRow side={away} />
      </div>
    </div>
  );
}

function ScoreRow({ side }: { side: ScoreStripSide }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Volt edge marks the winner — paired with the WON chip, never colour alone. */}
      <span
        aria-hidden
        className={cn('h-8 w-1 shrink-0 rounded-full', side.isWinner ? 'bg-volt' : 'bg-transparent')}
      />

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-sm',
          side.isWinner ? 'text-ink font-semibold' : 'text-ink-secondary',
        )}
      >
        {side.name}
      </span>

      {side.isWinner ? (
        <span className="label-caps text-volt-ink shrink-0">Won</span>
      ) : null}

      <span
        className={cn(
          'tabular font-display shrink-0 text-2xl',
          side.isWinner ? 'text-ink' : 'text-ink-secondary',
        )}
      >
        {side.score}
      </span>
    </div>
  );
}
