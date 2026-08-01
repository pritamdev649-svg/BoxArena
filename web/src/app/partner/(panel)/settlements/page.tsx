import type { Metadata } from 'next';
import { ComingSoon } from '@/shared/ui/coming-soon';

export const metadata: Metadata = { title: 'Settlements' };

export default function SettlementsPage() {
  return (
    <ComingSoon
      title="Settlements"
      description="Every payment we send you, and exactly which bookings make it up. Paying venues late is the fastest way to lose them, so this is deliberately transparent."
      covers={[
        'Weekly payout history, T+3 after the slot date',
        'Gross, platform commission, refunds, and net payable',
        'The full booking list behind each payment',
        'Bookings held back because a dispute is open',
        'Download a statement for your accountant',
      ]}
      backHref="/partner/dashboard"
      backLabel="Back to dashboard"
    />
  );
}
