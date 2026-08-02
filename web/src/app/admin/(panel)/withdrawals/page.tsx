import type { Metadata } from 'next';
import { Badge } from '@/shared/ui/badge';
import { DataTable, EmptyRow } from '@/shared/ui/data-table';
import { MoneyText } from '@/shared/ui/money-text';
import { apiFetchSafe } from '@/shared/lib/api';
import { getAdminToken } from '@/shared/lib/panel-auth';
import { formatDayAndTime } from '@/shared/lib/datetime';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { WithdrawalReview } from '@/features/admin';

export const metadata: Metadata = { title: 'Withdrawals' };
export const dynamic = 'force-dynamic';

interface QueuedWithdrawal {
  _id: string;
  publicId: string;
  amountPaise: number;
  tdsPaise: number;
  netPayablePaise: number;
  status: string;
  requestedAt: string;
  destination: { type: string; ifsc?: string; accountLast4?: string; vpa?: string };
  userId?: { fullName?: string; phoneNumber?: string; publicId?: string } | null;
}

/**
 * Task F5.3 — the only queue where money leaves the platform.
 *
 * Every request here has ALREADY been debited from the player's winnings, so
 * an item sitting untouched is a player who cannot see their money and has not
 * received it either. Reject refunds it; approve marks it payable.
 */
export default async function WithdrawalsPage() {
  const token = await getAdminToken();
  const rows =
    (await apiFetchSafe<QueuedWithdrawal[]>(API_ENDPOINTS.adminWithdrawals(), { token })) ?? [];

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-display-md uppercase">Withdrawals</h1>
        <p className="text-ink-secondary mt-2 max-w-2xl text-sm">
          Winnings only, KYC verified, TDS already deducted. The balance left the player&rsquo;s
          wallet when they asked &mdash; rejecting refunds it with the reason you give them.
        </p>
      </header>

      <DataTable
        headings={[
          { label: 'Player' },
          { label: 'Requested' },
          { label: 'Amount' },
          { label: 'Payable' },
          { label: 'To' },
          { label: '' },
        ]}
      >
        {rows.length === 0 ? (
          <EmptyRow colSpan={6} message="Nothing waiting. Every request has been decided." />
        ) : (
          rows.map((row) => <WithdrawalRow key={row._id} row={row} />)
        )}
      </DataTable>
    </main>
  );
}

function WithdrawalRow({ row }: { row: QueuedWithdrawal }) {
  return (
    <tr className="hover:bg-elevated/60 align-top">
      <td className="px-3 py-3">
        <p className="text-ink font-medium">{row.userId?.fullName ?? '—'}</p>
        <p className="text-ink-muted text-xs">{row.userId?.phoneNumber ?? row.publicId}</p>
      </td>
      <td className="text-ink-muted px-3 py-3">{formatDayAndTime(row.requestedAt)}</td>
      <td className="px-3 py-3">
        <MoneyText paise={row.amountPaise} className="font-medium" />
        <p className="text-ink-muted text-xs">
          TDS <MoneyText paise={row.tdsPaise} tone="muted" />
        </p>
      </td>
      <td className="px-3 py-3">
        <MoneyText paise={row.netPayablePaise} className="font-medium" />
      </td>
      <td className="px-3 py-3">
        <Destination destination={row.destination} />
      </td>
      <td className="px-3 py-3">
        <WithdrawalReview publicId={row.publicId} />
      </td>
    </tr>
  );
}

/** Never the full account number — the last four is enough to match a payout. */
function Destination({ destination }: { destination: QueuedWithdrawal['destination'] }) {
  if (destination.type === 'upi') {
    return (
      <div>
        <Badge tone="neutral">UPI</Badge>
        <p className="text-ink-secondary mt-1 text-xs">{destination.vpa ?? '—'}</p>
      </div>
    );
  }

  return (
    <div>
      <Badge tone="neutral">Bank</Badge>
      <p className="text-ink-secondary mt-1 text-xs">
        {destination.ifsc ?? '—'}
        {destination.accountLast4 ? ` · ••${destination.accountLast4}` : ''}
      </p>
    </div>
  );
}
