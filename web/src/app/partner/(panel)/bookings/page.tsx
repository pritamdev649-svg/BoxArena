import type { Metadata } from 'next';
import { StatTile } from '@/shared/ui/stat-tile';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPartnerToken } from '@/shared/lib/panel-auth';
import { BookingTable, type OwnerBooking } from '@/features/partner';
import { formatPaiseCompact } from '@/shared/lib/money';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export const metadata: Metadata = { title: 'Bookings' };
export const dynamic = 'force-dynamic';

/** Task F4.4. The screen desk staff live in. */
export default async function PartnerBookingsPage() {
  const token = await getPartnerToken();
  const bookings = (await apiFetchSafe<OwnerBooking[]>(API_ENDPOINTS.ownerBookings(100), { token })) ?? [];

  const confirmed = bookings.filter((b) => b.status === 'confirmed');
  const dueAtVenue = confirmed.reduce((sum, b) => sum + b.balanceDuePaise, 0);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-display-md uppercase">Bookings</h1>
          <p className="text-ink-secondary mt-2 text-sm">
            Everything booked at your venues, online and at the desk.
          </p>
        </div>
      </header>

      <section className="border-line-subtle mb-8 grid gap-8 border-b pb-8 sm:grid-cols-3">
        <StatTile label="Confirmed" value={String(confirmed.length)} />
        <StatTile
          label="Collect at venue"
          value={formatPaiseCompact(dueAtVenue)}
          sublabel="Pay-at-venue balances"
          tone={dueAtVenue > 0 ? 'warning' : 'default'}
        />
        <StatTile
          label="Checked in"
          value={String(confirmed.filter((b) => b.checkedInAt).length)}
          sublabel="Verified at the gate"
        />
      </section>

      <BookingTable bookings={bookings} />
    </main>
  );
}
