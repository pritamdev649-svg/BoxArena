'use client';

import { Download } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { formatDate } from '@/shared/lib/datetime';
import { t } from '@/shared/i18n';
import type { SettlementDetail } from './settlement-detail';

/**
 * CSV statement for the venue's accountant.
 *
 * Built in the browser from the data already on screen rather than from a
 * download endpoint: there is nothing here the page has not already fetched,
 * and a second server route would be a second place for the payout maths to
 * drift from what the owner was shown.
 *
 * Amounts are written in RUPEES with two decimals — a spreadsheet is the one
 * place paise-as-integers would silently become a hundredfold error.
 */
function toCsv(settlement: SettlementDetail): string {
  const rupees = (paise: number) => (paise / 100).toFixed(2);

  const rows: string[][] = [
    ['Settlement', settlement.publicId],
    ['Period start', formatDate(settlement.periodStart)],
    ['Period end', formatDate(settlement.periodEnd)],
    ['Status', settlement.status],
    [],
    ['Gross', rupees(settlement.grossPaise)],
    ['Commission', rupees(-settlement.commissionPaise)],
    ['Refunds', rupees(-settlement.refundsPaise)],
    ['Collected at venue', rupees(settlement.adjustmentsPaise)],
    ['Net payable', rupees(settlement.netPayablePaise)],
    [],
    ['Booking', 'Date', 'Sport', 'Value (INR)'],
    ...settlement.bookings.map((booking) => [
      booking.publicId,
      formatDate(booking.startAt),
      booking.sport,
      rupees(booking.totalPaise),
    ]),
  ];

  return rows.map((row) => row.map(escapeCell).join(',')).join('\n');
}

/** A venue named "Ravi's Turf, Aliganj" must not shift every later column. */
function escapeCell(value: string): string {
  return /[",\n]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value;
}

export function StatementDownload({ settlement }: { settlement: SettlementDetail }) {
  const download = () => {
    const blob = new Blob([toCsv(settlement)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `boxarena-${settlement.publicId}.csv`;
    link.click();

    /** Revoke, or the blob is pinned in memory for the life of the tab. */
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="secondary" size="sm" onClick={download}>
      <Download className="size-4" /> {t('partnerSettlements.download')}
    </Button>
  );
}
