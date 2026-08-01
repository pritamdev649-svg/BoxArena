import Link from 'next/link';
import { MapPin, ShieldCheck, Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { MoneyText } from '@/shared/ui/money-text';
import { SportCourt } from '@/shared/ui/court-graphics';
import type { ArenaSummary } from '../types';
import { t } from '@/shared/i18n';

const SPORT_ACCENT = {
  cricket: 'text-cricket',
  football: 'text-football',
  badminton: 'text-badminton',
} as const;

/**
 * Arena list row.
 *
 * No photograph, because we have none licensed — and a grey placeholder box
 * would look more unfinished than an honest court diagram does. The court
 * graphic also does real work: it tells you at a glance what sport this is.
 */
export function ArenaCard({ arena }: { arena: ArenaSummary }) {
  const cheapest = arena.courts.reduce((min, court) =>
    court.basePricePerHourPaise < min.basePricePerHourPaise ? court : min,
  );

  return (
    <Link
      href={`/arenas/${arena.slug}`}
      className="border-line-subtle bg-surface hover:border-line-strong group flex gap-5 border p-5 transition-colors duration-150"
    >
      <div className="bg-inset flex w-20 shrink-0 items-center justify-center overflow-hidden p-2.5">
        <SportCourt
          sport={cheapest.sport}
          strokeWidth={1.4}
          className={cn('opacity-70', SPORT_ACCENT[cheapest.sport])}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3 className="text-ink group-hover:text-volt-ink truncate font-medium transition-colors duration-150">
            {arena.name}
          </h3>
          {arena.isVerified ? (
            <ShieldCheck className="text-win mt-0.5 size-4 shrink-0" aria-label={t('common.verified')} />
          ) : null}
        </div>

        <p className="text-ink-muted mt-1 flex items-center gap-1 text-xs">
          <MapPin className="size-3" />
          {arena.areaName}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {arena.sports.map((sport) => (
            <span
              key={sport}
              className={cn(
                'label-caps border-line-subtle rounded-chip border px-1.5 py-0.5',
                SPORT_ACCENT[sport],
              )}
            >
              {sport}
            </span>
          ))}
        </div>
      </div>

      <MetaColumn arena={arena} pricePaise={cheapest.basePricePerHourPaise} />
    </Link>
  );
}

function MetaColumn({ arena, pricePaise }: { arena: ArenaSummary; pricePaise: number }) {
  return (
    <div className="shrink-0 text-right">
      {/* Zero-review venues must not render an empty star row (§8.4). */}
      {arena.rating.count > 0 ? (
        <p className="text-ink-secondary flex items-center justify-end gap-1 text-sm">
          <Star className="text-gold size-3.5 fill-current" />
          <span className="tabular">{arena.rating.average.toFixed(1)}</span>
          <span className="text-ink-muted tabular text-xs">({arena.rating.count})</span>
        </p>
      ) : (
        <p className="text-ink-muted text-xs">{t('common.newVenue')}</p>
      )}

      <p className="mt-2">
        <MoneyText paise={pricePaise} className="text-sm font-semibold" />
      </p>
      <p className="text-ink-muted text-xs">{t('common.perHour')}</p>
      <p className="text-ink-muted tabular mt-2 text-xs">
        {t('common.courtCount', { count: arena.courts.length })}
      </p>
    </div>
  );
}
