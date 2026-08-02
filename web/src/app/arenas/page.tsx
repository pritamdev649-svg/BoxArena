import type { Metadata } from 'next';
import { PageHero } from '@/shared/ui/page-hero';
import { ArenaCard, isSport } from '@/features/arenas';
import { LUCKNOW_AREAS, type Sport } from '@/mocks/seed/arenas';
import { apiFetchSafe } from '@/shared/lib/api';
import { t } from '@/shared/i18n';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export const metadata: Metadata = {
  title: t('arenas.metaTitle'),
  description: t('arenas.metaDescription'),
};

/** What `GET /arenas` actually returns (api_contract.md §3). */
interface ApiCourt {
  _id?: string;
  id?: string;
  name: string;
  sport: string;
  surface?: string;
  isIndoor?: boolean;
  basePricePerHourPaise: number;
}

interface ApiArena {
  publicId: string;
  slug: string;
  name: string;
  isVerified: boolean;
  address?: { areaName?: string; line1?: string };
  sportsSupported?: string[];
  rating?: { average: number; count: number };
  courts?: ApiCourt[];
  amenities?: string[];
}

export default async function ArenasPage() {
  const rawArenas = (await apiFetchSafe<ApiArena[]>(API_ENDPOINTS.arenas)) ?? [];
  const arenas = rawArenas
    .filter((a) => a.courts && a.courts.length > 0)
    .map((a) => ({
      publicId: a.publicId,
      slug: a.slug,
      name: a.name,
      isVerified: a.isVerified,
      areaName: a.address?.areaName ?? '',
      sports: (a.sportsSupported ?? []).filter(isSport),
      rating: a.rating ?? { average: 0, count: 0 },
      courts: (a.courts ?? []).filter((c) => isSport(c.sport)).map((c) => ({
        id: c._id ? String(c._id) : (c.id ?? ''),
        name: c.name,
        sport: c.sport as Sport,
        surface: c.surface ?? '',
        isIndoor: c.isIndoor ?? false,
        basePricePerHourPaise: c.basePricePerHourPaise,
      })),
      addressLine: a.address?.line1 ?? '',
      coordinates: [0, 0] as [number, number],
      amenities: a.amenities ?? [],
      openTime: '06:00',
      closeTime: '23:00',
      bookingMode: 'prepaid_only' as const,
      freeCancellationHours: 12,
    }));

  return (
    <main>
      <PageHero
        eyebrow={t('arenas.eyebrow')}
        title={t('arenas.title')}
        description={t('arenas.description')}
      />

      <section className="mx-auto max-w-5xl px-6 py-10">
        <FilterBar />

        <p className="text-ink-muted tabular mb-4 text-sm">
          {t('common.venueCount', { count: arenas.length })}
        </p>

        <div className="space-y-3">
          {arenas.map((arena) => (
            <ArenaCard key={arena.publicId} arena={arena} />
          ))}
        </div>
      </section>
    </main>
  );
}

function FilterBar() {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {(['allSports', 'badminton', 'cricket', 'football'] as const).map((key, index) => (
        <button
          key={key}
          type="button"
          className={
            index === 0
              ? 'bg-volt text-ink-inverse rounded-chip px-3 py-1.5 text-sm font-medium'
              : 'border-line text-ink-secondary hover:border-line-strong hover:text-ink rounded-chip border px-3 py-1.5 text-sm transition-colors duration-150'
          }
        >
          {t(`arenas.${key}`)}
        </button>
      ))}

      <span className="border-line-subtle mx-1 hidden border-l sm:block" />

      {LUCKNOW_AREAS.slice(0, 4).map((area) => (
        <button
          key={area}
          type="button"
          className="border-line text-ink-secondary hover:border-line-strong hover:text-ink rounded-chip border px-3 py-1.5 text-sm transition-colors duration-150"
        >
          {area}
        </button>
      ))}
    </div>
  );
}
