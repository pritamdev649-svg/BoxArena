import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge, type BadgeTone } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { DataTable, EmptyRow } from '@/shared/ui/data-table';
import { apiFetchSafe } from '@/shared/lib/api';
import { getAdminToken } from '@/shared/lib/panel-auth';
import { formatDayLabel } from '@/shared/lib/datetime';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export const metadata: Metadata = { title: 'Applications' };
export const dynamic = 'force-dynamic';

interface Application {
  publicId: string;
  status: string;
  currentStep: number;
  createdAt: string;
  lead: {
    ownerName: string;
    phoneNumber: string;
    venueName: string;
    areaName: string;
    courtCount: number;
    source: string;
  };
}

const STATUS_TONE: Record<string, BadgeTone> = {
  submitted: 'neutral',
  in_progress: 'info',
  pending_verification: 'warning',
  approved: 'win',
  rejected: 'loss',
  abandoned: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Lead',
  in_progress: 'In wizard',
  pending_verification: 'Needs review',
  approved: 'Approved',
  rejected: 'Rejected',
  abandoned: 'Abandoned',
};

export default async function ApplicationsPage() {
  const token = await getAdminToken();
  const applications = (await apiFetchSafe<Application[]>(API_ENDPOINTS.adminApplications, { token })) ?? [];

  const needsReview = applications.filter((a) => a.status === 'pending_verification');
  const inProgress = applications.filter((a) => a.status === 'in_progress');

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-display-md uppercase">Applications</h1>
        <p className="text-ink-secondary mt-2 max-w-2xl text-sm">
          Nothing goes live on trust. One fake or wrongly-pinned venue taking a booking destroys
          the trust the whole platform runs on.
        </p>
      </header>

      <div className="mb-8 flex flex-wrap gap-3 text-sm">
        <span className="text-ink-secondary">
          <strong className="text-dispute tabular">{needsReview.length}</strong> need review
        </span>
        <span className="text-ink-muted" aria-hidden>
          ·
        </span>
        {/* Abandoned wizards are the highest-intent lead list ops has (§10.3). */}
        <span className="text-ink-secondary">
          <strong className="text-ink tabular">{inProgress.length}</strong> abandoned mid-wizard —
          worth a call
        </span>
      </div>

      <DataTable
        headings={[
          { label: 'Venue' },
          { label: 'Owner' },
          { label: 'Area' },
          { label: 'Source' },
          { label: 'Status' },
          { label: 'Applied' },
          { label: '', className: 'text-right' },
        ]}
      >
        {applications.length === 0 ? (
          <EmptyRow colSpan={7} message="No venue applications yet." />
        ) : (
          applications.map((application) => (
            <ApplicationRow key={application.publicId} application={application} />
          ))
        )}
      </DataTable>
    </main>
  );
}

function ApplicationRow({ application }: { application: Application }) {
  return (
    <tr className="hover:bg-elevated/60">
      <td className="px-3 py-3">
        <p className="text-ink font-medium">{application.lead.venueName}</p>
        <p className="text-ink-muted tabular text-xs">{application.lead.courtCount} courts</p>
      </td>
      <td className="px-3 py-3">
        <p className="text-ink-secondary">{application.lead.ownerName}</p>
        <p className="text-ink-muted tabular text-xs">{application.lead.phoneNumber}</p>
      </td>
      <td className="text-ink-secondary px-3 py-3">{application.lead.areaName}</td>
      <td className="text-ink-muted px-3 py-3 text-xs capitalize">
        {application.lead.source.replace('_', ' ')}
      </td>
      <td className="px-3 py-3">
        <Badge tone={STATUS_TONE[application.status] ?? 'neutral'}>
          {STATUS_LABEL[application.status] ?? application.status}
        </Badge>
      </td>
      <td className="text-ink-muted px-3 py-3">{formatDayLabel(application.createdAt)}</td>
      <td className="px-3 py-3 text-right">
        <Button size="sm" variant="secondary" asChild>
          <Link href={`/admin/applications/${application.publicId}`}>
            {application.status === 'pending_verification' ? 'Review' : 'View'}
          </Link>
        </Button>
      </td>
    </tr>
  );
}
