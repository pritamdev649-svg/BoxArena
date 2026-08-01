import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { CheckCircle2 } from 'lucide-react';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { MoneyText } from '@/shared/ui/money-text';
import { Button } from '@/shared/ui/button';
import { formatDayLabel, formatSlotRange } from '@/shared/lib/datetime';
import { t } from '@/shared/i18n';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: t('booking.metaTitle') };

/**
 * Booking receipt.
 *
 * The check-in code is the point of this page — it is what the venue's desk
 * verifies at the gate, so it gets the largest type on screen and is readable
 * across a counter at night. Everything else is supporting detail.
 */
interface Booking {
  publicId: string;
  status: string;
  startAt: string;
  endAt: string;
  sport: string;
  totalPaise: number;
  paidFromWalletPaise: number;
  balanceDuePaise: number;
  isPayAtVenue: boolean;
  checkInCode?: string;
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  const token = await getPlayerToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(`/bookings/${publicId}`)}`);

  const booking = await apiFetchSafe<Booking>(API_ENDPOINTS.bookingDetail(publicId), { token });

  if (!booking) {
    return (
      <main className="mx-auto w-full max-w-2xl px-6 py-20 text-center">
        <h1 className="font-display text-display-md uppercase">{t('booking.notFoundTitle')}</h1>
        <p className="text-ink-secondary mt-3 text-sm">{t('booking.notFoundBody')}</p>
        <Button className="mt-6" asChild>
          <Link href="/arenas">{t('checkout.browseArenas')}</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="text-win size-6" />
        <h1 className="font-display text-display-md uppercase">{t('booking.confirmedTitle')}</h1>
      </div>
      <p className="text-ink-secondary mt-2 text-sm">{t('booking.confirmedBody')}</p>

      {booking.checkInCode ? <CheckInCode code={booking.checkInCode} /> : null}
      <Details booking={booking} />

      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" asChild>
          <Link href="/arenas">{t('booking.bookAnother')}</Link>
        </Button>
      </div>
    </main>
  );
}

function Details({ booking }: { booking: Booking }) {
  return (
    <section className="border-line-subtle bg-surface mt-6 border p-5">
      <dl className="space-y-2 text-sm">
        <Row label={t('booking.when')} value={formatDayLabel(booking.startAt)} />
        <Row label={t('checkout.time')} value={formatSlotRange(booking.startAt, booking.endAt)} />
        <Row label={t('booking.sport')} value={booking.sport} />
        <Row label={t('booking.reference')} value={booking.publicId} />
      </dl>

      <dl className="border-line-subtle mt-4 space-y-2 border-t pt-4 text-sm">
        <MoneyRow label={t('booking.paid')} paise={booking.paidFromWalletPaise} />
        {booking.balanceDuePaise > 0 ? (
          <MoneyRow label={t('checkout.payAtGate')} paise={booking.balanceDuePaise} />
        ) : null}
        <MoneyRow label={t('checkout.total')} paise={booking.totalPaise} strong />
      </dl>
    </section>
  );
}

/** Sized to be read off a phone held up at a counter. */
function CheckInCode({ code }: { code: string }) {
  return (
    <section className="border-volt bg-volt/5 mt-6 border p-6 text-center">
      <p className="label-caps text-ink-muted">{t('booking.checkInCode')}</p>
      <p className="font-display tabular mt-2 text-5xl tracking-[0.2em]">{code}</p>
      <p className="text-ink-secondary mt-3 text-xs">{t('booking.checkInHint')}</p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function MoneyRow({ label, paise, strong }: { label: string; paise: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={strong ? 'text-ink font-medium' : 'text-ink-secondary'}>{label}</dt>
      <dd>
        <MoneyText paise={paise} className={strong ? 'font-semibold' : ''} />
      </dd>
    </div>
  );
}
