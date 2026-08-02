import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Wallet, CalendarCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { PageHero } from '@/shared/ui/page-hero';
import { t } from '@/shared/i18n';

export const metadata: Metadata = {
  title: t('officialsLanding.metaTitle'),
  description: t('officialsLanding.metaDescription'),
};

/**
 * The officials pitch, mirroring `/partner` for venues.
 *
 * Separate from the sign-up form because the offer needs explaining first —
 * particularly the verification rule, which decides whether an official's
 * scorecard can release prize money on its own. Someone who discovers that
 * limitation at their first paid match will not take a second one.
 */
const POINTS = [
  { icon: Wallet, key: 'earn' },
  { icon: ShieldCheck, key: 'verified' },
  { icon: CalendarCheck, key: 'control' },
] as const;

export default function OfficialsLandingPage() {
  return (
    <main>
      <PageHero
        eyebrow={t('officialsLanding.eyebrow')}
        title={t('officialsLanding.title')}
        description={t('officialsLanding.description')}
        sport="badminton"
      />

      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/officials/register">{t('officialsLanding.cta')}</Link>
          </Button>
        </div>

        <ol className="divide-line-subtle mt-12 divide-y">
          {POINTS.map((point) => (
            <li key={point.key} className="flex gap-5 py-6">
              <point.icon className="text-ink-muted mt-1 size-5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <h2 className="font-display text-ink text-lg uppercase">
                  {t(`officialsLanding.points.${point.key}.title`)}
                </h2>
                <p className="text-ink-secondary mt-1 text-sm">
                  {t(`officialsLanding.points.${point.key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="border-line-subtle mt-12 border-t pt-8">
          <h2 className="font-display text-display-md uppercase">
            {t('officialsLanding.rulesTitle')}
          </h2>
          <p className="text-ink-secondary mt-3 max-w-2xl text-sm">
            {t('officialsLanding.rulesBody')}
          </p>
        </div>
      </section>
    </main>
  );
}
