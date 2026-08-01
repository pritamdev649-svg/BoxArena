import type { Metadata } from 'next';
import { ComingSoon } from '@/shared/ui/coming-soon';

export const metadata: Metadata = { title: 'Users' };

export default function AdminUsersPage() {
  return (
    <ComingSoon
      title="Users"
      description="Player and venue accounts. The suspend endpoint exists and is audit-logged; this screen is next."
      covers={[
        'Search by name, phone or public ID',
        'See wallet balances across all three buckets, and locked escrow',
        'Suspend an account with a mandatory reason (always audit-logged)',
        'Review KYC submissions before a first withdrawal',
        'Flag collusion: accounts sharing a device or bank account',
      ]}
      backHref="/admin"
      backLabel="Back to overview"
    />
  );
}
