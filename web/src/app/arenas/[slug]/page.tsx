import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MapPin, ShieldCheck, Star } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { MoneyText } from '@/shared/ui/money-text';
import { SportCourt, type SportKey } from '@/shared/ui/court-graphics';
import { apiFetchSafe } from '@/shared/lib/api';
import { SlotGrid, type GridSlot } from '@/features/arenas';
import { toLocalDateString } from '@/shared/lib/datetime';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export const dynamic = 'force-dynamic';

interface ArenaDetail {
  publicId: string;
  name: string;
  slug: string;
  isVerified: boolean;
  amenities: string[];
  sportsSupported: SportKey[];
  rating: { average: number; count: number };
  address: { line1: string; areaName: string; city: string };
  courts: { _id: string; name: string; sport: SportKey; basePricePerHourPaise: number }[];
}

interface CourtSlots {
  courtId: string;
  slots: GridSlot[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const arena = await apiFetchSafe<ArenaDetail>(API_ENDPOINTS.arenaDetail(slug));
  if (!arena) return { title: 'Arena' };

  return {
    title: `${arena.name}, ${arena.address.areaName}`,
    description: `Book ${arena.sportsSupported.join(', ')} at ${arena.name} in ${arena.address.areaName}, Lucknow.`,
  };
}

/** Task F2.3 + F2.4. Arena detail with the live slot grid. */
export default async function ArenaDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const arena = await apiFetchSafe<ArenaDetail>(API_ENDPOINTS.arenaDetail(slug));
  if (!arena) notFound();

  const today = toLocalDateString(new Date());
  const grouped =
    (await apiFetchSafe<CourtSlots[]>(API_ENDPOINTS.arenaSlots(arena.publicId, today))) ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <ArenaHeader arena={arena} />
      <Amenities amenities={arena.amenities} />

      <section className="mt-10">
        <h2 className="font-display text-display-md uppercase">Today&rsquo;s availability</h2>
        <p className="text-ink-muted mt-1 text-sm">
          Pick back-to-back hours on one court. Prices are per hour.
        </p>

        {grouped.length === 0 ? (
          <p className="text-ink-muted border-line-subtle mt-6 border-t py-10 text-center text-sm">
            No slots published for today. Try another date.
          </p>
        ) : (
          grouped.map((group) => {
            const court = arena.courts.find((c) => c._id === group.courtId);
            return (
              <SlotGrid
                key={group.courtId}
                courtName={court ? `${court.name} · ${court.sport}` : 'Court'}
                slots={group.slots}
              />
            );
          })
        )}
      </section>
    </main>
  );
}

function ArenaHeader({ arena }: { arena: ArenaDetail }) {
  const cheapest = arena.courts.reduce(
    (min, court) => Math.min(min, court.basePricePerHourPaise),
    Number.MAX_SAFE_INTEGER,
  );

  return (
    <header className="flex flex-wrap items-start gap-6">
      <div className="bg-inset flex w-24 shrink-0 items-center justify-center p-3">
        <SportCourt sport={arena.sportsSupported[0] ?? 'badminton'} strokeWidth={1.4} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-display-md uppercase">{arena.name}</h1>
          {arena.isVerified ? (
            <ShieldCheck className="text-win size-5" aria-label="Verified venue" />
          ) : null}
        </div>

        <p className="text-ink-secondary mt-2 flex items-center gap-1.5 text-sm">
          <MapPin className="size-4" />
          {arena.address.line1}, {arena.address.areaName}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {arena.rating.count > 0 ? (
            <span className="text-ink-secondary flex items-center gap-1 text-sm">
              <Star className="text-gold size-3.5 fill-current" />
              <span className="tabular">{arena.rating.average.toFixed(1)}</span>
              <span className="text-ink-muted tabular text-xs">({arena.rating.count})</span>
            </span>
          ) : (
            <Badge tone="neutral">New venue</Badge>
          )}
          {arena.sportsSupported.map((sport) => (
            <Badge key={sport} tone="info">
              {sport}
            </Badge>
          ))}
        </div>
      </div>

      <div className="text-right">
        <p className="label-caps text-ink-muted">From</p>
        <MoneyText paise={cheapest} className="font-display text-2xl" />
        <p className="text-ink-muted text-xs">per hour</p>
      </div>
    </header>
  );
}

function Amenities({ amenities }: { amenities: string[] }) {
  if (amenities.length === 0) return null;

  return (
    <section className="border-line-subtle mt-8 border-t pt-6">
      <h2 className="label-caps text-ink-muted mb-3">Amenities</h2>
      <ul className="flex flex-wrap gap-2">
        {amenities.map((amenity) => (
          <li
            key={amenity}
            className="border-line-subtle text-ink-secondary rounded-chip border px-2.5 py-1 text-xs"
          >
            {amenity}
          </li>
        ))}
      </ul>
    </section>
  );
}
