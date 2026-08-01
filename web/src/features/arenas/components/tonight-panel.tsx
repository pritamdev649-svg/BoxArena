import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { MoneyText } from '@/shared/ui/money-text';
import { apiFetchSafe } from '@/shared/lib/api';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { t } from '@/shared/i18n';

/**
 * Fills the hero's second column with REAL product rather than a stock photo.
 *
 * The right half was empty, and the honest options were a floodlit turf photo
 * (which we don't have licensed) or actual inventory. Live availability is the
 * stronger choice anyway: it proves the product works above the fold, and it
 * is exactly what a player opening the site at 6pm wants to know.
 *
 * Reads GET /arenas. When the API is unreachable the panel disappears rather
 * than falling back to fixtures — a hero advertising three venues that do not
 * exist is worse than a hero with one column.
 */

const SPORT_ACCENT: Record<string, string> = {
  cricket: 'text-cricket',
  football: 'text-football',
  badminton: 'text-badminton',
};

interface PanelArena {
  publicId: string;
  slug: string;
  name: string;
  isVerified: boolean;
  address?: { areaName?: string };
  courts?: { name: string; sport: string; basePricePerHourPaise: number }[];
}

/** Cheapest three, so the panel leads with an accessible price. */
function cheapestThree(arenas: PanelArena[]) {
  return arenas
    .filter((arena) => arena.isVerified && (arena.courts?.length ?? 0) > 0)
    .map((arena) => ({
      arena,
      cheapest: (arena.courts ?? []).reduce((min, court) =>
        court.basePricePerHourPaise < min.basePricePerHourPaise ? court : min,
      ),
    }))
    .sort((a, b) => a.cheapest.basePricePerHourPaise - b.cheapest.basePricePerHourPaise)
    .slice(0, 3);
}

export async function TonightPanel({ className }: { className?: string }) {
  const arenas = (await apiFetchSafe<PanelArena[]>(API_ENDPOINTS.arenas)) ?? [];
  const listed = cheapestThree(arenas);

  if (listed.length === 0) return null;

  return (
    <div className={cn('border-line-subtle bg-surface border', className)}>
      <div className="border-line-subtle flex items-baseline justify-between border-b px-4 py-3">
        <h2 className="label-caps text-ink-secondary">{t('home.tonightHeading')}</h2>
        <span className="tabular text-ink-muted text-xs">
          {t('common.venueCount', { count: arenas.length })}
        </span>
      </div>

      <ul className="divide-line-subtle divide-y">
        {listed.map(({ arena, cheapest }) => (
          <PanelRow key={arena.publicId} arena={arena} cheapest={cheapest} />
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

function PanelRow({
  arena,
  cheapest,
}: {
  arena: PanelArena;
  cheapest: { sport: string; basePricePerHourPaise: number };
}) {
  return (
    <li>
      <Link
        href={`/arenas/${arena.slug}`}
        className="hover:bg-elevated flex items-center gap-3 px-4 py-3 transition-colors duration-150"
      >
        <div className="min-w-0 flex-1">
          <p className="text-ink truncate text-sm font-medium">{arena.name}</p>
          <p className="text-ink-muted truncate text-xs">
            {arena.address?.areaName}
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
  );
}
