import { MapPin, Swords } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Badge } from '@/shared/ui/badge';
import { t } from '@/shared/i18n';

/**
 * A player's record, per sport and format.
 *
 * Badminton keeps separate ratings for singles and doubles (prd.md §5), so
 * this is a list of records rather than one number — collapsing them would
 * mean a strong singles player looked strong at doubles they have never
 * played.
 */
export interface SportStats {
  sport: string;
  format: string;
  eloRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface PlayerProfileData {
  publicId: string;
  fullName: string;
  avatarUrl?: string;
  primarySport?: string;
  skillLevel?: string;
  homeAreaName?: string;
  stats: SportStats[];
}

export function PlayerProfile({ player }: { player: PlayerProfileData }) {
  const played = player.stats.filter((row) => row.matchesPlayed > 0);

  return (
    <div>
      <PlayerHeader player={player} />

      <section className="mt-10">
        <h2 className="label-caps text-ink-muted mb-3">{t('player.recordHeading')}</h2>

        {played.length === 0 ? (
          <p className="text-ink-muted border-line-subtle border-t py-8 text-sm">
            {t('player.noMatches')}
          </p>
        ) : (
          <ul className="divide-line-subtle border-line-subtle divide-y border-y">
            {played.map((row) => (
              <StatRow key={`${row.sport}-${row.format}`} row={row} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlayerHeader({ player }: { player: PlayerProfileData }) {
  const initials = player.fullName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="flex flex-wrap items-start gap-5">
      {/* Monogram, not a stock avatar — we do not invent a face for anyone. */}
      <span className="bg-inset text-ink font-display flex size-16 shrink-0 items-center justify-center rounded-full text-lg">
        {initials}
      </span>

      <div className="min-w-0 flex-1">
        <h1 className="font-display text-display-md uppercase">{player.fullName}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {player.homeAreaName ? (
            <span className="text-ink-secondary flex items-center gap-1.5 text-sm">
              <MapPin className="size-3.5" />
              {player.homeAreaName}
            </span>
          ) : null}
          {player.primarySport ? <Badge tone="info">{player.primarySport}</Badge> : null}
          {player.skillLevel ? <Badge tone="neutral">{player.skillLevel}</Badge> : null}
        </div>
      </div>
    </header>
  );
}

function StatRow({ row }: { row: SportStats }) {
  const winRate = row.matchesPlayed > 0 ? Math.round((row.wins / row.matchesPlayed) * 100) : 0;

  return (
    <li className="flex flex-wrap items-center gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-ink text-sm font-medium">
          {row.sport} · {row.format}
        </p>
        <p className="text-ink-muted mt-1 flex items-center gap-1 text-xs">
          <Swords className="size-3" />
          {t('player.record', { count: row.matchesPlayed })}
        </p>
      </div>

      <Tally wins={row.wins} losses={row.losses} draws={row.draws} sport={row.sport} />

      <div className="text-right">
        <p className="font-display tabular text-lg">{row.eloRating}</p>
        <p className="text-ink-muted text-xs">{t('player.rating')}</p>
      </div>

      <div className="w-14 text-right">
        <p className="tabular text-ink-secondary text-sm">{winRate}%</p>
        <p className="text-ink-muted text-xs">{t('player.winRate')}</p>
      </div>
    </li>
  );
}

/** Draws are hidden for badminton, where they cannot occur. */
function Tally({
  wins,
  losses,
  draws,
  sport,
}: {
  wins: number;
  losses: number;
  draws: number;
  sport: string;
}) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <Cell label={t('player.won')} value={wins} tone="text-win" />
      <Cell label={t('player.lost')} value={losses} tone="text-loss" />
      {sport === 'badminton' ? null : (
        <Cell label={t('player.drawn')} value={draws} tone="text-ink-muted" />
      )}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="text-center">
      <span className={cn('tabular block text-sm font-semibold', tone)}>{value}</span>
      <span className="text-ink-muted block">{label}</span>
    </span>
  );
}
