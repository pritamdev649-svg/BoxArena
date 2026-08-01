import { redirect } from 'next/navigation';
import { PanelShell, type PanelNavSection } from '@/shared/ui/panel-shell';
import { getPartnerToken } from '@/shared/lib/panel-auth';

/**
 * Venue panel shell.
 *
 * Grouped by the job being done rather than by screen: an owner opens this to
 * run today, or to check money — those are different modes and the nav says so.
 *
 * The redirect here is a convenience, not the security boundary. Ownership
 * scoping is enforced in the API's service layer, so a caller who forges their
 * way past this still cannot read another venue's data (arena_onboarding.md
 * §12b, technical_spec.md §4.3).
 */
const SECTIONS: PanelNavSection[] = [
  {
    headingKey: 'panel.sectionManage',
    items: [
      { href: '/partner/dashboard', labelKey: 'nav.partnerDashboard' },
      { href: '/partner/bookings', labelKey: 'nav.partnerBookings' },
      { href: '/partner/courts', labelKey: 'nav.partnerCourts' },
    ],
  },
  {
    headingKey: 'panel.sectionMoney',
    items: [{ href: '/partner/settlements', labelKey: 'nav.partnerSettlements' }],
  },
  {
    headingKey: 'panel.sectionAccount',
    items: [{ href: '/partner/settings', labelKey: 'panel.settings' }],
  },
];

export default async function PartnerPanelLayout({ children }: { children: React.ReactNode }) {
  const token = await getPartnerToken();
  if (!token) redirect('/partner/login');

  return (
    <PanelShell titleKey="panel.partnerTitle" sections={SECTIONS} token={token}>
      {children}
    </PanelShell>
  );
}
