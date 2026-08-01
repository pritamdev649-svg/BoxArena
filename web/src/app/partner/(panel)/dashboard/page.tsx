import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { StatTile } from '@/shared/ui/stat-tile';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { formatPaiseCompact } from '@/shared/lib/money';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPartnerToken } from '@/shared/lib/panel-auth';
import { BookingTable, type OwnerArena, type OwnerBooking, type OwnerDashboard } from '@/features/partner';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

/** Task F4.3. Live data from the API — no mock layer on the panels. */
export default async function PartnerDashboardPage() {
  const token = await getPartnerToken();

  const [stats, arenas, bookings] = await Promise.all([
    apiFetchSafe<OwnerDashboard>(API_ENDPOINTS.ownerDashboard, { token }),
    apiFetchSafe<OwnerArena[]>(API_ENDPOINTS.ownerArenas, { token }),
    apiFetchSafe<OwnerBooking[]>(API_ENDPOINTS.ownerBookings(8), { token }),
  ]);

  if (!stats) return <NotConnected />;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-10">
        <h1 className="font-display text-display-md uppercase">Dashboard</h1>
        <p className="text-ink-secondary mt-2 text-sm">Last 30 days across your venues.</p>
      </header>

      <StatRow stats={stats} />

      <section className="border-line-subtle grid gap-8 border-b py-10 sm:grid-cols-2">
        <SourceSplit stats={stats} />
        <VenueList arenas={arenas ?? []} />
      </section>

      <section className="pt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg uppercase">Next bookings</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/partner/bookings">
              All bookings <ArrowRight />
            </Link>
          </Button>
        </div>
        <BookingTable bookings={bookings ?? []} />
      </section>
    </main>
  );
}

function StatRow({ stats }: { stats: OwnerDashboard }) {
  return (
      <section className="border-line-subtle grid gap-8 border-b pb-10 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Gross transaction value"
          value={formatPaiseCompact(stats.gtvPaise)}
          sublabel={`${String(stats.bookingCount)} confirmed bookings`}
          tone="accent"
        />
        <StatTile
          label="Occupancy"
          value={`${String(stats.occupancyPercent)}%`}
          sublabel="Of all bookable hours"
        />
        <StatTile
          label="Upcoming"
          value={String(stats.upcomingCount)}
          sublabel="Confirmed, not yet played"
        />
        <StatTile
          label="No-shows"
          value={String(stats.noShowCount)}
          sublabel={`${String(stats.cancelledCount)} cancellations`}
          tone={stats.noShowCount > 0 ? 'warning' : 'default'}
        />
      </section>
  );
}

/**
 * The online/offline split is what an owner reconciles against their own
 * register. If desk-entered walk-ins aren't showing here, staff aren't using
 * the offline entry screen and our inventory is drifting (§115).
 */
function SourceSplit({ stats }: { stats: OwnerDashboard }) {
  const total = stats.onlineCount + stats.offlineCount;
  const onlinePercent = total === 0 ? 0 : Math.round((stats.onlineCount / total) * 100);

  return (
    <div>
      <h2 className="font-display mb-4 text-lg uppercase">Where bookings come from</h2>

      <div className="bg-inset flex h-2 overflow-hidden rounded-full">
        <div className="bg-volt h-full" style={{ width: `${String(onlinePercent)}%` }} />
        <div className="bg-line-strong h-full flex-1" />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-ink-secondary flex items-center gap-2">
            <span className="bg-volt size-2 rounded-full" aria-hidden />
            Online (app &amp; web)
          </dt>
          <dd className="tabular text-ink font-medium">{stats.onlineCount}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-secondary flex items-center gap-2">
            <span className="bg-line-strong size-2 rounded-full" aria-hidden />
            Desk &amp; walk-ins
          </dt>
          <dd className="tabular text-ink font-medium">{stats.offlineCount}</dd>
        </div>
      </dl>
    </div>
  );
}

function VenueList({ arenas }: { arenas: OwnerArena[] }) {
  return (
    <div>
      <h2 className="font-display mb-4 text-lg uppercase">Your venues</h2>

      {arenas.length === 0 ? (
        <p className="text-ink-muted text-sm">No venues yet.</p>
      ) : (
        <ul className="divide-line-subtle divide-y">
          {arenas.map((arena) => (
            <li key={arena.publicId} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-ink truncate text-sm font-medium">{arena.name}</p>
                <p className="text-ink-muted text-xs">
                  {arena.address.areaName} · {arena.courts.length} courts ·{' '}
                  {arena.commissionPercent}% commission
                </p>
              </div>
              {arena.verificationStatus === 'rejected' ? (
                <Badge tone="loss">Rejected</Badge>
              ) : (
                <Badge tone={arena.isVerified ? 'win' : 'warning'}>
                  {arena.isVerified ? 'Live' : 'Pending'}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Designed state, not a crash — the API being down is an operational fact. */
function NotConnected() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-20">
      <h1 className="font-display text-display-md uppercase">Dashboard unavailable</h1>
      <p className="text-ink-secondary mt-3 max-w-md text-sm">
        We couldn&rsquo;t reach the booking service. Your data is safe — this is a connection
        problem on our side. Try again in a moment.
      </p>
    </main>
  );
}
