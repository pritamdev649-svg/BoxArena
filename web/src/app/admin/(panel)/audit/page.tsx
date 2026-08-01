import type { Metadata } from 'next';
import { ComingSoon } from '@/shared/ui/coming-soon';

export const metadata: Metadata = { title: 'Audit log' };

export default function AdminAuditPage() {
  return (
    <ComingSoon
      title="Audit log"
      description="Every privileged action, who took it, and why. Rows are already being written by the API — this is the reader."
      covers={[
        'Venue approvals and rejections, with the ops checklist state at the time',
        'Account suspensions and the stated reason',
        'Wallet adjustments (super admin only)',
        'Dispute resolutions and the admin note',
        'Filter by actor, action or target',
      ]}
      backHref="/admin"
      backLabel="Back to overview"
    />
  );
}
