import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { StatTile } from '@/shared/ui/stat-tile';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { DataTable, EmptyRow } from '@/shared/ui/data-table';
import { apiFetchSafe } from '@/shared/lib/api';
import { getAdminToken } from '@/shared/lib/panel-auth';
import { formatDayLabel } from '@/shared/lib/datetime';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export const metadata: Metadata = { title: 'Overview' };
export const dynamic = 'force-dynamic';

interface AdminOverview {
  pendingApplications: number;
  openDisputes: number;
  arenas: number;
  users: number;
  todayBookings: number;
}

interface Application {
  publicId: string;
  status: string;
  createdAt: string;
  lead: { ownerName: string; venueName: string; areaName: string; courtCount: number };
}

/** Task F5.1/F5.3. Ops overview — the queues that need a human. */
export default async function AdminOverviewPage() {
  const token = await getAdminToken();

  const [overview, applications] = await Promise.all([
    apiFetchSafe<AdminOverview>(API_ENDPOINTS.adminOverview, { token }),
    apiFetchSafe<Application[]>(`${API_ENDPOINTS.adminApplications}?status=pending_verification`, { token }),
  ]);

  if (!overview) {
    return (
      <main className="mx-auto w-full max-w-6xl px-6 py-20">
        <h1 className="font-display text-display-md uppercase">Ops unavailable</h1>
        <p className="text-ink-secondary mt-3 text-sm">Could not reach the API.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="font-display text-display-md mb-8 uppercase">Overview</h1>

      {/* Queues first: these are the numbers that mean somebody must act. */}
      <section className="border-line-subtle grid gap-8 border-b pb-10 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="Venues to verify"
          value={String(overview.pendingApplications)}
          sublabel="Awaiting site check"
          tone={overview.pendingApplications > 0 ? 'warning' : 'default'}
        />
        <StatTile
          label="Open disputes"
          value={String(overview.openDisputes)}
          sublabel="Escrow held"
          tone={overview.openDisputes > 0 ? 'warning' : 'default'}
        />
        <StatTile label="Live venues" value={String(overview.arenas)} />
        <StatTile label="Players" value={String(overview.users)} />
        <StatTile label="Upcoming bookings" value={String(overview.todayBookings)} />
      </section>

      <ApprovalQueue applications={applications ?? []} />

      <p className="text-ink-muted mt-8 text-xs">
        <Badge tone="neutral" className="mr-2">
          Audited
        </Badge>
        Every approval, rejection and suspension is written to the audit log with the acting
        admin and reason.
      </p>
    </main>
  );
}

function ApprovalQueue({ applications }: { applications: Application[] }) {
  return (
      <section className="pt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg uppercase">Venues awaiting approval</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/applications">
              All applications <ArrowRight />
            </Link>
          </Button>
        </div>

        <DataTable
          headings={[
            { label: 'Venue' },
            { label: 'Owner' },
            { label: 'Area' },
            { label: 'Courts', className: 'text-right' },
            { label: 'Applied' },
            { label: '', className: 'text-right' },
          ]}
        >
          {!applications || applications.length === 0 ? (
            <EmptyRow colSpan={6} message="Nothing waiting. Every venue has been reviewed." />
          ) : (
            applications.map((application) => (
              <tr key={application.publicId} className="hover:bg-elevated/60">
                <td className="text-ink px-3 py-3 font-medium">{application.lead.venueName}</td>
                <td className="text-ink-secondary px-3 py-3">{application.lead.ownerName}</td>
                <td className="text-ink-secondary px-3 py-3">{application.lead.areaName}</td>
                <td className="tabular text-ink-secondary px-3 py-3 text-right">
                  {application.lead.courtCount}
                </td>
                <td className="text-ink-muted px-3 py-3">
                  {formatDayLabel(application.createdAt)}
                </td>
                <td className="px-3 py-3 text-right">
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/admin/applications/${application.publicId}`}>Review</Link>
                  </Button>
                </td>
              </tr>
            ))
          )}
        </DataTable>
      </section>
  );
}
