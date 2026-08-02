import { AlertTriangle } from 'lucide-react';
import { MoneyText } from '@/shared/ui/money-text';
import { formatDate, formatSlotRange } from '@/shared/lib/datetime';
import { t } from '@/shared/i18n';

/**
 * One payout, broken down to the booking.
 *
 * Paying venues late — or unexplainably — is the fastest way to lose them, so
 * every number here is followed by the rows that produce it. An owner who can
 * reconcile a payment themselves does not need to call anyone.
 */
export interface SettlementBooking {
  publicId: string;
  startAt: string;
  endAt: string;
  sport: string;
  totalPaise: number;
  refundPaise?: number;
  balanceDuePaise?: number;
  status: string;
}

export interface SettlementDetail {
  publicId: string;
  periodStart: string;
  periodEnd: string;
  grossPaise: number;
  commissionPaise: number;
  refundsPaise: number;
  adjustmentsPaise: number;
  netPayablePaise: number;
  status: string;
  paidAt?: string;
  bookings: SettlementBooking[];
  heldBookings: SettlementBooking[];
}

export function SettlementBreakdown({ settlement }: { settlement: SettlementDetail }) {
  return (
    <div>
      <dl className="border-line-subtle space-y-2 border-b pb-4 text-sm">
        <Line label={t('partnerSettlements.gross')} paise={settlement.grossPaise} />
        <Line
          label={t('partnerSettlements.commission')}
          paise={-settlement.commissionPaise}
          tone="debit"
        />
        <Line
          label={t('partnerSettlements.refunds')}
          paise={-settlement.refundsPaise}
          tone="debit"
        />
        {settlement.adjustmentsPaise !== 0 ? (
          <Line
            label={t('partnerSettlements.collectedAtVenue')}
            paise={settlement.adjustmentsPaise}
            tone="debit"
          />
        ) : null}
      </dl>

      <div className="flex items-baseline justify-between pt-4">
        <p className="font-display text-base uppercase">{t('partnerSettlements.netPayable')}</p>
        <MoneyText paise={settlement.netPayablePaise} className="text-lg font-semibold" />
      </div>

      {settlement.heldBookings.length > 0 ? (
        <HeldNotice bookings={settlement.heldBookings} />
      ) : null}

      <h3 className="label-caps text-ink-muted mt-8 mb-2">
        {t('partnerSettlements.bookingCount', { count: settlement.bookings.length })}
      </h3>
      <BookingTable bookings={settlement.bookings} />
    </div>
  );
}

function BookingTable({ bookings }: { bookings: SettlementBooking[] }) {
  if (bookings.length === 0) {
    return <p className="text-ink-muted text-sm">{t('partnerSettlements.noBookings')}</p>;
  }

  return (
    <div className="border-line-subtle overflow-x-auto border">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-line-subtle text-ink-muted label-caps border-b">
            <th className="p-2 text-left">{t('partnerSettlements.date')}</th>
            <th className="p-2 text-left">{t('partnerSettlements.time')}</th>
            <th className="p-2 text-left">{t('partnerSettlements.reference')}</th>
            <th className="p-2 text-right">{t('partnerSettlements.value')}</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.publicId} className="border-line-subtle border-b last:border-b-0">
              <td className="text-ink-secondary tabular p-2">{formatDate(booking.startAt)}</td>
              <td className="text-ink-secondary tabular p-2 whitespace-nowrap">
                {formatSlotRange(booking.startAt, booking.endAt)}
              </td>
              <td className="text-ink-muted tabular p-2 text-xs">{booking.publicId}</td>
              <td className="p-2 text-right">
                <MoneyText paise={booking.totalPaise} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Held money is the single thing an owner will ring about. Lead with it. */
function HeldNotice({ bookings }: { bookings: SettlementBooking[] }) {
  return (
    <div className="border-dispute/40 bg-dispute/10 rounded-control mt-6 border p-4">
      <p className="text-dispute flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4" />
        {t('partnerSettlements.heldCount', { count: bookings.length })}
      </p>
      <p className="text-ink-secondary mt-1 text-xs">{t('partnerSettlements.heldHint')}</p>
      <ul className="divide-line-subtle mt-3 divide-y">
        {bookings.map((booking) => (
          <li key={booking.publicId} className="flex items-baseline justify-between py-1.5 text-xs">
            <span className="text-ink-secondary tabular">
              {formatDate(booking.startAt)} · {booking.publicId}
            </span>
            <MoneyText paise={booking.totalPaise} tone="muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Line({
  label,
  paise,
  tone,
}: {
  label: string;
  paise: number;
  tone?: 'debit';
}) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-secondary">{label}</dt>
      <dd>
        <MoneyText paise={paise} tone={tone === 'debit' ? 'debit' : 'default'} />
      </dd>
    </div>
  );
}
