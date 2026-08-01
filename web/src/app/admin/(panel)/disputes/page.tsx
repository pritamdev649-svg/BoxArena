import type { Metadata } from 'next';
import { Badge } from '@/shared/ui/badge';
import { DataTable, EmptyRow } from '@/shared/ui/data-table';
import { apiFetchSafe } from '@/shared/lib/api';
import { getAdminToken } from '@/shared/lib/panel-auth';
import { formatDayAndTime } from '@/shared/lib/datetime';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export const metadata: Metadata = { title: 'Disputes' };
export const dynamic = 'force-dynamic';

interface Dispute {
  _id: string;
  reason: string;
  status: string;
  slaDueAt: string;
  createdAt: string;
  matchId?: { publicId: string; sport: string } | null;
}

/** Task F5.2. Escrow is frozen while these sit here — SLA is the point. */
export default async function DisputesPage() {
  const token = await getAdminToken();
  const disputes = (await apiFetchSafe<Dispute[]>(API_ENDPOINTS.adminDisputes, { token })) ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-display-md uppercase">Disputes</h1>
        <p className="text-ink-secondary mt-2 max-w-2xl text-sm">
          Both captains submitted different scores. Their entry fees stay in escrow until this is
          resolved, so overdue items are money frozen in someone&rsquo;s account.
        </p>
      </header>

      <DataTable
        headings={[
          { label: 'Match' },
          { label: 'Sport' },
          { label: 'Reason' },
          { label: 'Raised' },
          { label: 'SLA' },
          { label: 'Status' },
        ]}
      >
        {disputes.length === 0 ? (
          <EmptyRow
            colSpan={6}
            message="No open disputes. Every match settled on the scores both sides agreed."
          />
        ) : (
          disputes.map((dispute) => <DisputeRow key={dispute._id} dispute={dispute} />)
        )}
      </DataTable>
    </main>
  );
}

function DisputeRow({ dispute }: { dispute: Dispute }) {
  /** Computed per row, not once during render — Date.now() in a render body
      is an impure call and React (rightly) flags it. */
  const isOverdue = new Date(dispute.slaDueAt).valueOf() < new Date().valueOf();

  return (
    <tr className="hover:bg-elevated/60">
      <td className="text-ink px-3 py-3 font-medium">{dispute.matchId?.publicId ?? '—'}</td>
      <td className="text-ink-secondary px-3 py-3 capitalize">{dispute.matchId?.sport ?? '—'}</td>
      <td className="text-ink-secondary px-3 py-3 capitalize">
        {dispute.reason.replace(/_/gu, ' ')}
      </td>
      <td className="text-ink-muted px-3 py-3">{formatDayAndTime(dispute.createdAt)}</td>
      <td className="px-3 py-3">
        <Badge tone={isOverdue ? 'loss' : 'neutral'}>
          {isOverdue ? 'Overdue' : formatDayAndTime(dispute.slaDueAt)}
        </Badge>
      </td>
      <td className="px-3 py-3">
        <Badge tone={dispute.status === 'resolved' ? 'win' : 'warning'}>
          {dispute.status.replace(/_/gu, ' ')}
        </Badge>
      </td>
    </tr>
  );
}
