import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, MapPin, ShieldCheck, Star, Swords } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { MoneyText } from '@/shared/ui/money-text';
import { SportCourt, type SportKey } from '@/shared/ui/court-graphics';
import { apiFetchSafe } from '@/shared/lib/api';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { t } from '@/shared/i18n';

/**
 * "Top venues in Lucknow" — real arenas, ranked by real reviews.
 *
 * Served by GET /arenas/top, which orders by review volume then average, so
 * the strip cannot be topped by a brand-new venue with one five-star review
 * from its owner's cousin. If the API is down or the city has no verified
 * venues yet, the section renders nothing at all rather than fabricating a
 * line-up — an empty landing page section is recoverable, a fake one is not.
 */

const SPORT_ACCENT: Record<string, string> = {
  cricket: 'text-cricket',
  football: 'text-football',
  badminton: 'text-badminton',
};

interface TopArena {
  publicId: string;
  slug: string;
  name: string;
  isVerified: boolean;
  images?: string[];
  address?: { areaName?: string };
  sportsSupported?: string[];
  rating?: { average: number; count: number };
  courts?: { name: string; sport: string; basePricePerHourPaise: number }[];
  stats?: { matchesPlayed: number; playersHosted: number };
}

export async function TopArenas({ limit = 4 }: { limit?: number }) {
  const arenas = (await apiFetchSafe<TopArena[]>(API_ENDPOINTS.arenaTop(limit))) ?? [];
  const listed = arenas.filter((arena) => (arena.courts?.length ?? 0) > 0);

  if (listed.length === 0) return null;

  return (
    <section className="border-line-subtle border-b px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-display-md uppercase">{t('home.topArenasTitle')}</h2>
            <p className="text-ink-secondary mt-2 max-w-lg text-sm">
              {t('home.topArenasBody')}
            </p>
          </div>
          <Link
            href="/arenas"
            className="text-ink-secondary hover:text-ink flex items-center gap-1.5 text-sm transition-colors duration-150"
          >
            {t('common.seeAll')} <ArrowRight className="size-4" />
          </Link>
        </div>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {listed.map((arena) => (
            <TopArenaCard key={arena.publicId} arena={arena} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function TopArenaCard({ arena }: { arena: TopArena }) {
  const courts = arena.courts ?? [];
  const cheapest = courts.reduce(
    (min, court) => Math.min(min, court.basePricePerHourPaise),
    Number.MAX_SAFE_INTEGER,
  );

  return (
    <li>
      <Link
        href={`/arenas/${arena.slug}`}
        className="border-line-subtle bg-surface hover:border-line-strong group flex h-full flex-col border transition-colors duration-150"
      >
        <CardMedia
          cover={arena.images?.[0]}
          name={arena.name}
          sport={(courts[0]?.sport ?? 'badminton') as SportKey}
        />

        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="flex items-start gap-1.5">
            <h3 className="text-ink group-hover:text-volt-ink truncate text-sm font-medium transition-colors duration-150">
              {arena.name}
            </h3>
            {arena.isVerified ? (
              <ShieldCheck
                className="text-win mt-0.5 size-3.5 shrink-0"
                aria-label={t('common.verified')}
              />
            ) : null}
          </div>

          <p className="text-ink-muted mt-1 flex items-center gap-1 truncate text-xs">
            <MapPin className="size-3 shrink-0" />
            {arena.address?.areaName}
          </p>

          <CardMeta
            rating={arena.rating ?? { average: 0, count: 0 }}
            matches={arena.stats?.matchesPlayed ?? 0}
          />

          <p className="mt-auto pt-3">
            <MoneyText paise={cheapest} className="text-sm font-semibold" />
            <span className="text-ink-muted ml-1 text-xs">{t('common.perHour')}</span>
          </p>
        </div>
      </Link>
    </li>
  );
}

function CardMedia({
  cover,
  name,
  sport,
}: {
  cover: string | undefined;
  name: string;
  sport: SportKey;
}) {
  return (
    <div className="bg-inset relative aspect-[4/3] w-full overflow-hidden">
      {cover ? (
        <Image
          src={cover}
          alt={name}
          fill
          sizes="(min-width: 1024px) 280px, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        /* No owner photo yet — the court diagram, never stock imagery. */
        <div className="flex h-full items-center justify-center p-6">
          <SportCourt
            sport={sport}
            strokeWidth={1.2}
            className={cn('opacity-50', SPORT_ACCENT[sport])}
          />
        </div>
      )}
    </div>
  );
}

function CardMeta({
  rating,
  matches,
}: {
  rating: { average: number; count: number };
  matches: number;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {rating.count > 0 ? (
        <span className="text-ink-secondary flex items-center gap-1">
          <Star className="text-gold size-3 fill-current" />
          <span className="tabular">{rating.average.toFixed(1)}</span>
          <span className="text-ink-muted tabular">({rating.count})</span>
        </span>
      ) : (
        <span className="text-ink-muted">{t('common.newVenue')}</span>
      )}

      {matches > 0 ? (
        <span className="text-ink-muted flex items-center gap-1">
          <Swords className="size-3" />
          <span className="tabular">{t('arena.matchCount', { count: matches })}</span>
        </span>
      ) : null}
    </div>
  );
}
