import type { Metadata } from 'next';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPartnerToken } from '@/shared/lib/panel-auth';
import { t } from '@/shared/i18n';
import type { OwnerArena } from '@/features/partner';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { SettingsForm } from './settings-form';

export const metadata: Metadata = { title: t('partnerSettings.metaTitle') };
export const dynamic = 'force-dynamic';

/**
 * Venue settings — the ongoing half of arena_onboarding.md §7.
 *
 * Reads live from `GET /owner/arenas`; writes go to
 * `PATCH /owner/arenas/:publicId`, which refuses any change that would strand
 * an existing booking and lists the conflicts instead (§10.4).
 */
export default async function PartnerSettingsPage() {
  const token = await getPartnerToken();
  const arenas = await apiFetchSafe<OwnerArena[]>(API_ENDPOINTS.ownerArenas, { token });
  const arena = arenas?.[0];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-4">
        <h1 className="font-display text-display-md uppercase">{t('partnerSettings.title')}</h1>
        <p className="text-ink-secondary mt-2 text-sm">{t('partnerSettings.description')}</p>
      </header>

      {arena ? <SettingsForm arena={arena} /> : <NoVenue />}
    </main>
  );
}

function NoVenue() {
  return (
    <div className="border-line-subtle mt-8 border p-8">
      <h2 className="font-display text-lg uppercase">No venue yet</h2>
      <p className="text-ink-secondary mt-2 text-sm">
        Settings appear once your venue is approved. We verify every venue in person before it
        goes live.
      </p>
    </div>
  );
}
