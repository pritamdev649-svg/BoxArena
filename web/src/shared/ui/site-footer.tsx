'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isPanelRoute } from '@/shared/lib/panel-routes';
import { Logo } from './logo';
import { t } from '@/shared/i18n';

const COLUMNS = [
  {
    headingKey: 'footer.play',
    links: [
      { href: '/arenas', labelKey: 'footer.findArena' },
      { href: '/challenges', labelKey: 'footer.openChallenges' },
      { href: '/leaderboard', labelKey: 'footer.cityTable' },
    ],
  },
  {
    headingKey: 'footer.venues',
    links: [
      { href: '/partner', labelKey: 'footer.listVenue' },
      { href: '/partner/pricing', labelKey: 'footer.payouts' },
    ],
  },
  {
    headingKey: 'footer.legal',
    links: [
      { href: '/legal/terms', labelKey: 'footer.terms' },
      { href: '/legal/privacy', labelKey: 'footer.privacy' },
      { href: '/legal/refunds', labelKey: 'footer.refunds' },
      { href: '/legal/responsible-gaming', labelKey: 'footer.responsibleGaming' },
    ],
  },
] as const;

export function SiteFooter() {
  const pathname = usePathname();

  /** Panels are tools, not pages — no marketing link tree under the dashboard. */
  if (isPanelRoute(pathname)) return null;

  return (
    <footer className="border-line-subtle mt-auto border-t">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Logo />
            <p className="text-ink-muted mt-3 text-sm">
              {t('footer.tagline')}
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.headingKey}>
              <h2 className="label-caps text-ink-muted mb-3">{t(column.headingKey)}</h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-ink-secondary hover:text-ink text-sm transition-colors duration-150"
                    >
                      {t(link.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-line-subtle text-ink-muted mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-6 text-xs">
          <span>© {new Date().getFullYear()} BoxArena</span>
          <span aria-hidden>·</span>
          <span>{t('footer.location')}</span>
          <span aria-hidden>·</span>
          {/* Statutory requirement once real money is live (compliance.md §9). */}
          <Link href="/legal/grievance" className="hover:text-ink-secondary">
            {t('footer.grievance')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
