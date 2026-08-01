import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin } from 'lucide-react';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { MoneyText } from '@/shared/ui/money-text';
import { Button } from '@/shared/ui/button';
import { formatDayLabel, formatSlotRange } from '@/shared/lib/datetime';
import { CheckoutPanel } from '@/features/booking';
import { t } from '@/shared/i18n';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: t('checkout.metaTitle') };

/**
 * Checkout for a held slot run.
 *
 * The hold was taken by Continue on the venue page, so arriving here means
 * those slots are already reserved for this player for a few minutes. This
 * page never re-holds: holdSlots only claims AVAILABLE slots, so a second
 * attempt on your own hold would fail with "unavailable" and read as a bug.
 *
 * Slot times and prices are re-read from the API rather than trusted from the
 * query string — the URL says WHICH slots, never what they cost.
 */
interface ArenaDetail {
  publicId: string;
  name: string;
  slug: string;
  bookingMode: string;
  depositPercent: number;
  address: { line1: string; areaName: string };
  courts: { _id: string; name: string; sport: string }[];
}

interface CourtSlots {
  courtId: string;
  slots: { id: string; startAt: string; endAt: string; pricePaise: number }[];
}

interface Wallet {
  spendablePaise: number;
}

interface SelectedSlot {
  id: string;
  startAt: string;
  endAt: string;
  pricePaise: number;
  courtId: string;
}

/** Re-reads the slots named in the URL so their times and prices come from the
    API, never from the query string. */
async function loadCheckout(input: { venue: string; date: string; slotIds: string[]; token: string }) {
  const arena = await apiFetchSafe<ArenaDetail>(API_ENDPOINTS.arenaDetail(input.venue));
  if (!arena) return null;

  const [grouped, wallet] = await Promise.all([
    apiFetchSafe<CourtSlots[]>(API_ENDPOINTS.arenaSlots(arena.publicId, input.date)),
    apiFetchSafe<Wallet>(API_ENDPOINTS.wallet, { token: input.token }),
  ]);

  const selected: SelectedSlot[] = (grouped ?? [])
    .flatMap((group) => group.slots.map((slot) => ({ ...slot, courtId: group.courtId })))
    .filter((slot) => input.slotIds.includes(slot.id))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  /** A slot we cannot see any more was re-sold or the date is wrong. */
  if (selected.length !== input.slotIds.length) return null;

  return {
    arena,
    selected,
    totalPaise: selected.reduce((sum, slot) => sum + slot.pricePaise, 0),
    spendablePaise: wallet?.spendablePaise ?? 0,
  };
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const venue = single(params['venue']);
  const date = single(params['date']);
  const until = single(params['until']);
  const slotIds = single(params['slots'])?.split(',').filter(Boolean) ?? [];

  if (!venue || !date || !until || slotIds.length === 0) return <Broken />;

  /** Signed out, or the 15-minute token lapsed while they picked slots. */
  const token = await getPlayerToken();
  if (!token) {
    const back = `/checkout?venue=${venue}&date=${date}&slots=${slotIds.join(',')}&until=${until}`;
    redirect(`/login?next=${encodeURIComponent(back)}`);
  }

  const data = await loadCheckout({ venue, date, slotIds, token });
  if (!data) return <Broken />;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="font-display text-display-md uppercase">{t('checkout.title')}</h1>

      <Summary arena={data.arena} selected={data.selected} totalPaise={data.totalPaise} />

      <div className="mt-6">
        <CheckoutPanel
          slotIds={slotIds}
          totalPaise={data.totalPaise}
          holdExpiresAt={until}
          arenaSlug={data.arena.slug}
          payAtVenueAllowed={data.arena.bookingMode === 'pay_at_venue_allowed'}
          depositPercent={data.arena.depositPercent}
          spendablePaise={data.spendablePaise}
        />
      </div>
    </main>
  );
}

function Summary({
  arena,
  selected,
  totalPaise,
}: {
  arena: ArenaDetail;
  selected: SelectedSlot[];
  totalPaise: number;
}) {
  const court = arena.courts.find((c) => c._id === selected[0]?.courtId);
  const first = selected[0];
  const last = selected[selected.length - 1];

  return (
    <section className="border-line-subtle bg-surface mt-6 border p-5">
      <h2 className="text-ink font-medium">{arena.name}</h2>
      <p className="text-ink-muted mt-1 flex items-center gap-1.5 text-xs">
        <MapPin className="size-3.5" />
        {arena.address.line1}, {arena.address.areaName}
      </p>

      <dl className="border-line-subtle mt-4 space-y-2 border-t pt-4 text-sm">
        <Row label={t('checkout.court')} value={court ? `${court.name} · ${court.sport}` : '—'} />
        <Row label={t('checkout.date')} value={first ? formatDayLabel(first.startAt) : '—'} />
        <Row
          label={t('checkout.time')}
          value={first && last ? formatSlotRange(first.startAt, last.endAt) : '—'}
        />
        <Row label={t('checkout.duration')} value={t('checkout.hours', { count: selected.length })} />
      </dl>

      <ul className="border-line-subtle mt-4 space-y-1 border-t pt-4">
        {selected.map((slot) => (
          <li key={slot.id} className="flex items-baseline justify-between text-sm">
            <span className="text-ink-secondary tabular">
              {formatSlotRange(slot.startAt, slot.endAt)}
            </span>
            <MoneyText paise={slot.pricePaise} tone="muted" />
          </li>
        ))}
        <li className="border-line-subtle flex items-baseline justify-between border-t pt-2 text-sm">
          <span className="text-ink font-medium">{t('checkout.total')}</span>
          <MoneyText paise={totalPaise} className="font-semibold" />
        </li>
      </ul>
    </section>
  );
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

/**
 * A checkout URL that no longer describes a real selection — a stale link, an
 * expired hold whose slots were re-sold, or a hand-edited query string.
 */
function Broken() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-20 text-center">
      <h1 className="font-display text-display-md uppercase">{t('checkout.brokenTitle')}</h1>
      <p className="text-ink-secondary mt-3 text-sm">{t('checkout.brokenBody')}</p>
      <Button className="mt-6" asChild>
        <Link href="/arenas">{t('checkout.browseArenas')}</Link>
      </Button>
    </main>
  );
}
