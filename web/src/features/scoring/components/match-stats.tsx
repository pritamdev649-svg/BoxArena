import { t } from '@/shared/i18n';

/**
 * Match statistics, derived server-side from the point log.
 *
 * Every figure here is recomputed from the rallies that actually count, so a
 * correction moves the statistics the same instant it moves the score. A
 * cached stat that survived an undo would sit on screen arguing with the
 * scoreboard beside it.
 */
export interface SideStats {
  pointsWon: number;
  pointsWonOnServe: number;
  longestStreak: number;
  winners: number;
  unforcedErrors: number;
  serviceFaults: number;
}

export interface MatchStatsData {
  totalPointsPlayed: number;
  corrections: number;
  creator: SideStats;
  opponent: SideStats;
}

const ROWS = [
  { key: 'pointsWon', labelKey: 'scoring.statPoints' },
  { key: 'pointsWonOnServe', labelKey: 'scoring.statOnServe' },
  { key: 'longestStreak', labelKey: 'scoring.statStreak' },
  { key: 'winners', labelKey: 'scoring.statWinners' },
  { key: 'unforcedErrors', labelKey: 'scoring.statErrors' },
  { key: 'serviceFaults', labelKey: 'scoring.statFaults' },
] as const;

export function MatchStats({
  stats,
  creatorName,
  opponentName,
}: {
  stats: MatchStatsData;
  creatorName: string;
  opponentName: string;
}) {
  if (stats.totalPointsPlayed === 0) {
    return <p className="text-ink-muted text-sm">{t('scoring.statsEmpty')}</p>;
  }

  return (
    <section>
      <h2 className="label-caps text-ink-muted mb-3">{t('scoring.stats')}</h2>

      <div className="border-line-subtle overflow-x-auto border">
        <table className="w-full min-w-[26rem] border-collapse text-sm">
          <thead>
            <tr className="border-line-subtle border-b">
              <th className="text-ink-secondary p-2 text-right text-xs">{creatorName}</th>
              <th className="label-caps text-ink-muted p-2 text-center" />
              <th className="text-ink-secondary p-2 text-left text-xs">{opponentName}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.key} className="border-line-subtle border-b last:border-b-0">
                <td className="tabular text-ink p-2 text-right font-medium">
                  {stats.creator[row.key]}
                </td>
                <td className="text-ink-muted p-2 text-center text-xs whitespace-nowrap">
                  {t(row.labelKey)}
                </td>
                <td className="tabular text-ink p-2 text-left font-medium">
                  {stats.opponent[row.key]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Footnote total={stats.totalPointsPlayed} corrections={stats.corrections} />
    </section>
  );
}

/** Corrections are shown, not hidden — the audit trail is the selling point. */
function Footnote({ total, corrections }: { total: number; corrections: number }) {
  return (
    <p className="text-ink-muted mt-2 text-xs">
      {t('scoring.statTotal')}: <span className="tabular">{total}</span>
      {corrections > 0 ? (
        <>
          {' · '}
          {t('scoring.statCorrections')}: <span className="tabular">{corrections}</span>
        </>
      ) : null}
    </p>
  );
}
