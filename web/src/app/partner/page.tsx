import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/shared/ui/page-hero';
import { Button } from '@/shared/ui/button';
import { t } from '@/shared/i18n';

export const metadata: Metadata = {
  title: t('partner.metaTitle'),
  description: t('partner.metaDescription'),
};

/**
 * Task F4.1. Order matters: owners want earnings -> cost -> effort -> proof,
 * not a feature list (arena_onboarding.md §2).
 */
const VALUE_POINTS = [
  { n: '01', key: 'fill' },
  { n: '02', key: 'paid' },
  { n: '03', key: 'setup' },
  { n: '04', key: 'walkins' },
] as const;

export default function PartnerPage() {
  return (
    <main>
      <PageHero
        eyebrow={t('partner.eyebrow')}
        title={t('partner.title')}
        description={t('partner.description')}
        sport="football"
      >
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/partner/apply">{t('partner.applyCta')}</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/partner/pricing">{t('partner.payoutsCta')}</Link>
          </Button>
        </div>
      </PageHero>

      <section className="border-line-subtle border-b px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <ol className="divide-line-subtle divide-y">
            {VALUE_POINTS.map((point) => (
              <li key={point.n} className="flex gap-6 py-6">
                <span className="tabular font-display text-ink-muted w-10 shrink-0 text-xl">
                  {point.n}
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-ink text-lg uppercase">
                    {t(`partner.points.${point.key}.title`)}
                  </h2>
                  <p className="text-ink-secondary mt-1.5 max-w-2xl text-sm">
                    {t(`partner.points.${point.key}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <PricingSection />
    </main>
  );
}

function PricingSection() {
  return (
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-display text-display-md mb-8 uppercase">{t('partner.costTitle')}</h2>
          <dl className="grid gap-8 sm:grid-cols-3">
            {(['commission', 'setup', 'settlement'] as const).map((key) => (
              <div key={key}>
                <dt className="label-caps text-ink-muted">{t(`partner.cost.${key}.label`)}</dt>
                <dd className="font-display tabular text-ink mt-2 text-3xl">
                  {t(`partner.cost.${key}.value`)}
                </dd>
                <dd className="text-ink-secondary mt-1 text-sm">{t(`partner.cost.${key}.note`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
  );
}
