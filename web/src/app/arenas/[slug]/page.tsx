import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin, ShieldCheck, Star } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { MoneyText } from '@/shared/ui/money-text';
import type { SportKey } from '@/shared/ui/court-graphics';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import {
  SlotGrid,
  ArenaGallery,
  ArenaStats,
  ArenaReviews,
  type GridSlot,
  type ArenaStatsData,
  type ArenaReview,
} from '@/features/arenas';
import { toLocalDateString, formatDayLabel } from '@/shared/lib/datetime';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export const dynamic = 'force-dynamic';

interface ArenaDetail {
  publicId: string;
  name: string;
  slug: string;
  isVerified: boolean;
  description?: string;
  images: string[];
  amenities: string[];
  sportsSupported: SportKey[];
  rating: { average: number; count: number };
  address: { line1: string; areaName: string; city: string };
  courts: { _id: string; name: string; sport: SportKey; basePricePerHourPaise: number }[];
  stats: ArenaStatsData;
  recentReviews: ArenaReview[];
}

interface CourtSlots {
  courtId: string;
  slots: GridSlot[];
}

interface ReviewEligibility {
  canReview: boolean;
  bookingPublicId: string | null;
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

/**
 * Fired together — the slot grid, the review list and the "can I rate this?"
 * check do not depend on each other, and serialising them would add two round
 * trips to a page a player opens while standing outside the venue.
 */
async function loadPageData(arena: ArenaDetail, today: string) {
  const token = await getPlayerToken();

  const [grouped, reviewPage, eligibility] = await Promise.all([
    apiFetchSafe<CourtSlots[]>(API_ENDPOINTS.arenaSlots(arena.publicId, today)),
    apiFetchSafe<{ reviews: ArenaReview[] }>(API_ENDPOINTS.arenaReviews(arena.publicId)),
    /** Signed-out visitors get no eligibility call at all — nothing to ask. */
    token
      ? apiFetchSafe<ReviewEligibility>(API_ENDPOINTS.arenaReviewEligibility(arena.publicId), {
          token,
        })
      : Promise.resolve(null),
  ]);

  return {
    courtSlots: grouped ?? [],
    /** The detail payload already carries a preview, so a failed list call
        degrades to three reviews rather than to none. */
    reviews: reviewPage?.reviews ?? arena.recentReviews ?? [],
    /** null means signed out; a failed call means "signed in, cannot review". */
    eligibility: token ? (eligibility ?? { canReview: false, bookingPublicId: null }) : null,
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

/** Slots are materialised 14 days out, so that is how far the picker goes. */
const BOOKABLE_DAYS = 7;

function bookableDays(): string[] {
  const start = new Date();
  return Array.from({ length: BOOKABLE_DAYS }, (_, offset) =>
    toLocalDateString(new Date(start.getTime() + offset * 86_400_000)),
  );
}

/** Task F2.3 + F2.4. Arena detail with the live slot grid. */
export default async function ArenaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const arena = await apiFetchSafe<ArenaDetail>(API_ENDPOINTS.arenaDetail(slug));
  if (!arena) notFound();

  const days = bookableDays();
  const requested = Array.isArray(query['date']) ? query['date'][0] : query['date'];
  /**
   * Defaults to today, but only honours a date we actually offer — an
   * arbitrary `?date=` would query a day with no materialised slots and render
   * an empty grid that looks like an outage.
   */
  const selectedDate =
    requested && DATE_PATTERN.test(requested) && days.includes(requested)
      ? requested
      : (days[0] as string);

  const { courtSlots, reviews, eligibility } = await loadPageData(arena, selectedDate);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <ArenaHeader arena={arena} />

      <div className="mt-8">
        <ArenaGallery
          images={arena.images ?? []}
          arenaName={arena.name}
          sport={arena.sportsSupported[0] ?? 'badminton'}
        />
      </div>

      {arena.description ? (
        <p className="text-ink-secondary mt-6 max-w-2xl text-sm">{arena.description}</p>
      ) : null}

      <ArenaStats stats={arena.stats} />
      <Amenities amenities={arena.amenities} />
      <Availability
        arena={arena}
        courtSlots={courtSlots}
        localDate={selectedDate}
        days={days}
      />

      <ArenaReviews
        reviews={reviews}
        rating={arena.rating}
        eligibility={eligibility}
        arenaPublicId={arena.publicId}
        arenaSlug={arena.slug}
      />
    </main>
  );
}

function Availability({
  arena,
  courtSlots,
  localDate,
  days,
}: {
  arena: ArenaDetail;
  courtSlots: CourtSlots[];
  localDate: string;
  days: string[];
}) {
  /** Nothing left to sell today is normal by late evening — say so, rather
      than leaving a grid of greyed hours as the only explanation. */
  const hasBookable = courtSlots.some((group) =>
    group.slots.some((slot) => slot.status === 'available'),
  );

  return (
    <section className="mt-10">
      <h2 className="font-display text-display-md uppercase">Availability</h2>
      <p className="text-ink-muted mt-1 text-sm">
        Pick back-to-back hours on one court. Prices are per hour.
      </p>

      <DayPicker days={days} selected={localDate} slug={arena.slug} />

      {courtSlots.length > 0 && !hasBookable ? (
        <p className="border-line-subtle text-ink-secondary mt-4 border-t pt-4 text-sm">
          No hours left to book on this day. Try another date above.
        </p>
      ) : null}

      {courtSlots.length === 0 ? (
        <p className="text-ink-muted border-line-subtle mt-6 border-t py-10 text-center text-sm">
          No slots published for today. Try another date.
        </p>
      ) : (
        courtSlots.map((group) => {
          const court = arena.courts.find((c) => c._id === group.courtId);
          return (
            <SlotGrid
              key={group.courtId}
              courtName={court ? `${court.name} · ${court.sport}` : 'Court'}
              slots={group.slots}
              arenaSlug={arena.slug}
              localDate={localDate}
            />
          );
        })
      )}
    </section>
  );
}

function ArenaHeader({ arena }: { arena: ArenaDetail }) {
  const cheapest = arena.courts.reduce(
    (min, court) => Math.min(min, court.basePricePerHourPaise),
    Number.MAX_SAFE_INTEGER,
  );

  return (
    <header className="flex flex-wrap items-start justify-between gap-6">
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

/**
 * Plain links, not a client-side date control.
 *
 * The page is already a dynamic Server Component that re-reads slots per
 * request, so `?date=` is all a day change needs — and it survives a refresh,
 * a shared link and a back button, which a useState day would not.
 */
function DayPicker({
  days,
  selected,
  slug,
}: {
  days: string[];
  selected: string;
  slug: string;
}) {
  return (
    <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Choose a day">
      {days.map((day) => {
        const isSelected = day === selected;
        return (
          <Link
            key={day}
            href={`/arenas/${slug}?date=${day}`}
            aria-current={isSelected ? 'date' : undefined}
            scroll={false}
            className={
              isSelected
                ? 'bg-volt text-ink-inverse rounded-chip shrink-0 px-3 py-2 text-sm font-medium'
                : 'border-line text-ink-secondary hover:border-line-strong hover:text-ink rounded-chip shrink-0 border px-3 py-2 text-sm transition-colors duration-150'
            }
          >
            {formatDayLabel(`${day}T12:00:00+05:30`)}
          </Link>
        );
      })}
    </nav>
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
