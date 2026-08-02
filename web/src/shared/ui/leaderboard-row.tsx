import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';

/**
 * No cards. A league table needs a heading, tabular numerals, aligned
 * columns, and a hairline rule — that's it (design_system.md §8.3).
 * Any broadcast scoreboard proves the point.
 */

export type FormResult = 'W' | 'L' | 'D';

export function LeaderboardRow({
  rank,
  name,
  areaName,
  eloRating,
  eloDelta,
  form,
  className,
}: {
  /** Null for a player with no completed matches — listed, but not ranked. */
  rank: number | null;
  name: string;
  areaName: string;
  eloRating: number;
  /** Change since last match. Omit for an all-time board. */
  eloDelta?: number;
  /** Most recent first, max 5. */
  form?: FormResult[];
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 py-3', className)}>
      <RankCell rank={rank} />

      <div className="min-w-0 flex-1">
        <p className="text-ink truncate text-sm font-medium">{name}</p>
        <p className="text-ink-muted truncate text-xs">{areaName}</p>
      </div>

      {form && form.length > 0 ? <FormPills results={form} /> : null}

      <div className="w-16 shrink-0 text-right">
        <span className="tabular text-ink text-sm font-semibold">{eloRating}</span>
        {eloDelta !== undefined && eloDelta !== 0 ? (
          <span
            className={cn('tabular ml-1 text-xs', eloDelta > 0 ? 'text-win' : 'text-loss')}
            aria-label={`${eloDelta > 0 ? 'up' : 'down'} ${Math.abs(eloDelta)} points`}
          >
            {eloDelta > 0 ? '+' : '−'}
            {Math.abs(eloDelta)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The W W L W D strip every football fan already reads fluently. Letters, not
 * just colour — outcome must never depend on hue alone (§2, rule 3).
 */
function FormPills({ results }: { results: FormResult[] }) {
  const tone: Record<FormResult, string> = {
    W: 'bg-win/15 text-win',
    L: 'bg-loss/15 text-loss',
    D: 'bg-line text-ink-secondary',
  };

  return (
    <div className="hidden shrink-0 gap-1 sm:flex" aria-label={t('leaderboard.recentForm')}>
      {results.slice(0, 5).map((result, index) => (
        <span
          key={`${result}-${String(index)}`}
          className={cn(
            'flex size-5 items-center justify-center rounded-[3px] text-[10px] font-bold',
            tone[result],
          )}
        >
          {result}
        </span>
      ))}
    </div>
  );
}

/** Gold for the podium — the one place rank earns colour. */
function RankCell({ rank }: { rank: number | null }) {
  return (
    <span
      className={cn(
        'tabular w-7 shrink-0 text-right text-sm font-semibold',
        rank !== null && rank <= 3 ? 'text-gold' : 'text-ink-muted',
      )}
      /** An unranked player gets an em dash, never a borrowed position. */
      title={rank === null ? t('leaderboard.unranked') : undefined}
    >
      {rank ?? '—'}
    </span>
  );
}
