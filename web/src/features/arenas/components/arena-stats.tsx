import { Swords, Users, Clock, Flame, LayoutGrid } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { t } from '@/shared/i18n';

/**
 * What has actually happened at this venue.
 *
 * Every figure is counted from real bookings and settled matches (see
 * getArenaStats) — nothing here is a target, an estimate, or a rounded-up
 * marketing number. That is the whole point: a player deciding between two
 * turfs wants to know which one people actually play at.
 *
 * A venue with no history renders nothing rather than a row of zeroes. "0
 * matches played" is a true statement that reads as a broken page, and a brand
 * new venue is not a worse venue — it is an unproven one.
 */
export interface ArenaStatsData {
  matchesPlayed: number;
  playersHosted: number;
  hoursBooked: number;
  openChallenges: number;
  courtCount: number;
}

export function ArenaStats({ stats }: { stats: ArenaStatsData }) {
  const tiles = [
    { icon: Swords, value: stats.matchesPlayed, label: t('arena.statMatches') },
    { icon: Users, value: stats.playersHosted, label: t('arena.statPlayers') },
    { icon: Clock, value: stats.hoursBooked, label: t('arena.statHours') },
    { icon: LayoutGrid, value: stats.courtCount, label: t('arena.statCourts') },
    /** Only when there is something to join — an empty queue is not a stat. */
    ...(stats.openChallenges > 0
      ? [{ icon: Flame, value: stats.openChallenges, label: t('arena.statChallenges') }]
      : []),
  ].filter((tile) => tile.value > 0);

  if (tiles.length === 0) return null;

  return (
    <section className="border-line-subtle mt-8 border-t pt-6">
      <h2 className="label-caps text-ink-muted mb-4">{t('arena.statsHeading')}</h2>
      <dl className="divide-line-subtle border-line-subtle grid grid-cols-2 divide-x border sm:grid-cols-4 lg:grid-cols-5">
        {tiles.map((tile) => (
          <StatTile key={tile.label} {...tile} />
        ))}
      </dl>
    </section>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
}) {
  return (
    <div className="border-line-subtle flex flex-col gap-1 border-b p-4 last:border-b-0 sm:border-b-0">
      <Icon className="text-ink-muted size-4" aria-hidden />
      <dd className="font-display tabular text-xl">{value.toLocaleString('en-IN')}</dd>
      <dt className="text-ink-muted text-xs">{label}</dt>
    </div>
  );
}
