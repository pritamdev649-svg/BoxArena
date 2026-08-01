import type { Metadata } from 'next';
import { ComingSoon } from '@/shared/ui/coming-soon';

export const metadata: Metadata = { title: 'Courts & pricing' };

export default function CourtsPage() {
  return (
    <ComingSoon
      title="Courts & pricing"
      description="Manage what you sell and what it costs. The API endpoints exist; this screen is next."
      covers={[
        'Add, rename and deactivate courts',
        'Set operating hours per day of the week',
        'Weekday, weekend and holiday price bands with a live weekly preview',
        'Block slots for maintenance or rain — with a warning listing bookings it would affect',
      ]}
      backHref="/partner/dashboard"
      backLabel="Back to dashboard"
    />
  );
}
