import type { Metadata } from 'next';
import Link from 'next/link';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPartnerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { SettingsSection } from '@/shared/ui/settings-section';
import { t } from '@/shared/i18n';
import {
  CourtList,
  PricingBands,
  PricingPreview,
  BlockSlotsForm,
  type OwnerArena,
  type OwnerCourt,
  type ExistingRule,
  type CourtPreview,
} from '@/features/partner';

export const metadata: Metadata = { title: t('partnerCourts.metaTitle') };
export const dynamic = 'force-dynamic';

/**
 * Courts & pricing — what the venue sells and what it costs.
 *
 * Operating hours deliberately are NOT here even though they shape the grid:
 * they live on the settings screen, and having one field editable from two
 * places is how the two screens end up disagreeing. The preview below shows
 * their effect, and links there to change them.
 */
export default async function CourtsPage() {
  const token = await getPartnerToken();
  const arenas = await apiFetchSafe<OwnerArena[]>(API_ENDPOINTS.ownerArenas, { token });
  const arena = arenas?.[0];

  if (!arena) {
    return (
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <Header />
        <NoVenue />
      </main>
    );
  }

  /** Independent reads — the bands and their preview do not depend on each other. */
  const [rules, previews] = await Promise.all([
    apiFetchSafe<ExistingRule[]>(API_ENDPOINTS.ownerPricingRulesFor(arena.publicId), { token }),
    apiFetchSafe<CourtPreview[]>(API_ENDPOINTS.ownerPricingPreview(arena.publicId), { token }),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Header />

      <p className="text-ink-secondary border-line-subtle border-b pb-6 text-sm">
        {arena.name} · {arena.address.areaName}
      </p>

      <Sections
        arenaPublicId={arena.publicId}
        courts={(arena.courts ?? []) as OwnerCourt[]}
        rules={rules ?? []}
        previews={previews ?? []}
      />
    </main>
  );
}

function Sections({
  arenaPublicId,
  courts,
  rules,
  previews,
}: {
  arenaPublicId: string;
  courts: OwnerCourt[];
  rules: ExistingRule[];
  previews: CourtPreview[];
}) {
  return (
    <>
      <SettingsSection
        heading={t('partnerCourts.courtsHeading')}
        body={t('partnerCourts.courtsBody')}
      >
        <CourtList arenaPublicId={arenaPublicId} courts={courts} />
      </SettingsSection>

      <SettingsSection
        heading={t('partnerCourts.bandsHeading')}
        body={t('partnerCourts.bandsBody')}
      >
        <PricingBands arenaPublicId={arenaPublicId} courts={courts} rules={rules} />
      </SettingsSection>

      <SettingsSection
        heading={t('partnerCourts.previewHeading')}
        body={t('partnerCourts.previewBody')}
      >
        <PricingPreview previews={previews} />
        <p className="text-ink-muted mt-4 text-xs">
          {t('partnerCourts.hoursLive')}{' '}
          <Link href="/partner/settings" className="text-volt-ink underline">
            {t('partnerCourts.hoursLink')}
          </Link>
        </p>
      </SettingsSection>

      <SettingsSection
        heading={t('partnerCourts.blockHeading')}
        body={t('partnerCourts.blockBody')}
        className="border-b-0"
      >
        <BlockSlotsForm courts={courts} />
      </SettingsSection>
    </>
  );
}

function Header() {
  return (
    <header className="mb-4">
      <h1 className="font-display text-display-md uppercase">{t('partnerCourts.title')}</h1>
      <p className="text-ink-secondary mt-2 text-sm">{t('partnerCourts.description')}</p>
    </header>
  );
}

function NoVenue() {
  return (
    <div className="border-line-subtle mt-8 border p-8">
      <h2 className="font-display text-lg uppercase">{t('partnerCourts.noVenueTitle')}</h2>
      <p className="text-ink-secondary mt-2 text-sm">{t('partnerCourts.noVenueBody')}</p>
    </div>
  );
}
