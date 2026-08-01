import { Badge, type BadgeTone } from '@/shared/ui/badge';
import { DataTable, EmptyRow } from '@/shared/ui/data-table';
import { MoneyText } from '@/shared/ui/money-text';
import { formatDayAndTime } from '@/shared/lib/datetime';
import type { BookingSource, BookingStatus, OwnerBooking } from '../types';

const STATUS_TONE: Record<BookingStatus, BadgeTone> = {
  confirmed: 'win',
  pending_payment: 'warning',
  cancelled_by_user: 'loss',
  cancelled_by_arena: 'loss',
  no_show: 'loss',
  completed: 'neutral',
  expired: 'neutral',
};

const STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  pending_payment: 'Awaiting payment',
  cancelled_by_user: 'Cancelled',
  cancelled_by_arena: 'You cancelled',
  no_show: 'No-show',
  completed: 'Completed',
  expired: 'Expired',
};

/** Walk-ins are visually distinct — the online/offline split is the number
    owners actually reconcile against their own register (§115). */
const SOURCE_LABEL: Record<BookingSource, string> = {
  app: 'App',
  web: 'Web',
  offline_desk: 'Desk',
  walk_in: 'Walk-in',
};

const HEADINGS = [
  { label: 'When' },
  { label: 'Court' },
  { label: 'Customer' },
  { label: 'Source' },
  { label: 'Status' },
  { label: 'Code', className: 'text-right' },
  { label: 'Amount', className: 'text-right' },
];

export function BookingTable({ bookings }: { bookings: OwnerBooking[] }) {
  return (
    <DataTable headings={HEADINGS}>
      {bookings.length === 0 ? (
        <EmptyRow colSpan={HEADINGS.length} message="No bookings for this day yet." />
      ) : (
        bookings.map((booking) => <BookingRow key={booking.publicId} booking={booking} />)
      )}
    </DataTable>
  );
}

function BookingRow({ booking }: { booking: OwnerBooking }) {
  const isOffline = booking.source === 'offline_desk' || booking.source === 'walk_in';

  return (
    <tr className="hover:bg-elevated/60 transition-colors duration-150">
      <td className="text-ink px-3 py-3 whitespace-nowrap">
        {formatDayAndTime(booking.startAt)}
      </td>

      <td className="text-ink-secondary px-3 py-3">{booking.courtId?.name ?? '—'}</td>

      <td className="px-3 py-3">
        <p className="text-ink truncate">{booking.bookerId?.fullName ?? 'Walk-in customer'}</p>
        {booking.bookerId?.phoneNumber ? (
          <p className="text-ink-muted tabular text-xs">{booking.bookerId.phoneNumber}</p>
        ) : null}
      </td>

      <td className="px-3 py-3">
        <Badge tone={isOffline ? 'neutral' : 'info'}>{SOURCE_LABEL[booking.source]}</Badge>
      </td>

      <td className="px-3 py-3">
        <Badge tone={STATUS_TONE[booking.status]}>{STATUS_LABEL[booking.status]}</Badge>
      </td>

      <CheckInCell booking={booking} />
      <AmountCell booking={booking} />
    </tr>
  );
}

function CheckInCell({ booking }: { booking: OwnerBooking }) {
  return (
    <td className="px-3 py-3 text-right">
      {booking.checkedInAt ? (
        <span className="text-win label-caps">Checked in</span>
      ) : (
        <span className="tabular text-ink-secondary">{booking.checkInCode ?? '—'}</span>
      )}
    </td>
  );
}

function AmountCell({ booking }: { booking: OwnerBooking }) {
  return (
    <td className="px-3 py-3 text-right">
      <MoneyText paise={booking.totalPaise} className="font-medium" />
      {/* Pay-at-venue: what the desk still has to collect at the gate. */}
      {booking.balanceDuePaise > 0 ? (
        <p className="text-dispute text-xs">
          <MoneyText paise={booking.balanceDuePaise} className="text-dispute" /> due
        </p>
      ) : null}
    </td>
  );
}
