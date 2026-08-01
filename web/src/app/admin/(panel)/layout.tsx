import { redirect } from 'next/navigation';
import { PanelShell, type PanelNavSection } from '@/shared/ui/panel-shell';
import { getAdminToken } from '@/shared/lib/panel-auth';

/**
 * Ops console shell.
 *
 * Queues first, because ops work is queue-shaped: something is waiting and has
 * an SLA. People and system sit below — they are looked up, not worked through.
 *
 * Every mutation behind here writes an AuditLog server-side (api_contract.md
 * §13), and the config editor is super-admin only.
 */
const SECTIONS: PanelNavSection[] = [
  {
    headingKey: 'panel.sectionQueues',
    items: [
      { href: '/admin', labelKey: 'nav.adminOverview', prefixMatch: false },
      { href: '/admin/applications', labelKey: 'nav.adminApplications' },
      { href: '/admin/disputes', labelKey: 'nav.adminDisputes' },
    ],
  },
  {
    headingKey: 'panel.sectionPeople',
    items: [{ href: '/admin/users', labelKey: 'nav.adminUsers' }],
  },
  {
    headingKey: 'panel.sectionSystem',
    items: [
      { href: '/admin/settings', labelKey: 'panel.settings' },
      { href: '/admin/audit', labelKey: 'nav.adminAudit' },
    ],
  },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const token = await getAdminToken();
  if (!token) redirect('/admin/login');

  return (
    <PanelShell titleKey="panel.adminTitle" sections={SECTIONS}>
      {children}
    </PanelShell>
  );
}
