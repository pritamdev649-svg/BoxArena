import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { MoneyText } from '@/shared/ui/money-text';
import { SEED_ARENAS } from '@/mocks/seed/arenas';
import { t } from '@/shared/i18n';

/**
 * Fills the hero's second column with REAL product rather than a stock photo.
 *
 * The right half was empty, and the honest options were a floodlit turf photo
 * (which we don't have licensed) or actual inventory. Live availability is the
 * stronger choice anyway: it proves the product works above the fold, and it
 * is exactly what a player opening the site at 6pm wants to know.
 *
 * Wired to seed data now; swaps to GET /arenas/nearby at task F2.2.
 */

const SPORT_ACCENT: Record<string, string> = {
  cricket: 'text-cricket',
  football: 'text-football',
  badminton: 'text-badminton',
};

export function TonightPanel({ className }: { className?: string }) {
  /** Cheapest three, so the panel leads with an accessible price. */
  const arenas = SEED_ARENAS.filter((a) => a.isVerified)
    .map((arena) => {
      const cheapest = arena.courts.reduce((min, court) =>
        court.basePricePerHourPaise < min.basePricePerHourPaise ? court : min,
      );
      return { arena, cheapest };
    })
    .sort((a, b) => a.cheapest.basePricePerHourPaise - b.cheapest.basePricePerHourPaise)
    .slice(0, 3);

  return (
    <div className={cn('border-line-subtle bg-surface border', className)}>
      <div className="border-line-subtle flex items-baseline justify-between border-b px-4 py-3">
        <h2 className="label-caps text-ink-secondary">{t('home.tonightHeading')}</h2>
        <span className="tabular text-ink-muted text-xs">
          {t('common.venueCount', { count: SEED_ARENAS.length })}
        </span>
      </div>

      <ul className="divide-line-subtle divide-y">
        {arenas.map(({ arena, cheapest }) => (
          <li key={arena.publicId}>
            <Link
              href={`/arenas/${arena.slug}`}
              className="hover:bg-elevated flex items-center gap-3 px-4 py-3 transition-colors duration-150"
            >
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate text-sm font-medium">{arena.name}</p>
                <p className="text-ink-muted truncate text-xs">
                  {arena.areaName}
                  <span aria-hidden> · </span>
                  <span className={SPORT_ACCENT[cheapest.sport]}>{cheapest.sport}</span>
                </p>
              </div>

              <div className="shrink-0 text-right">
                <MoneyText paise={cheapest.basePricePerHourPaise} className="text-sm font-medium" />
                <p className="text-ink-muted text-xs">{t('common.perHour')}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/arenas"
        className="text-ink-secondary hover:text-ink border-line-subtle flex items-center gap-1.5 border-t px-4 py-3 text-sm transition-colors duration-150"
      >
        {t('common.seeAll')} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
