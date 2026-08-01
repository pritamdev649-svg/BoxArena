import type { Metadata } from 'next';
import { SettingsSection, SettingsRow } from '@/shared/ui/settings-section';
import { Badge } from '@/shared/ui/badge';
import { apiFetchSafe } from '@/shared/lib/api';
import { getAdminToken } from '@/shared/lib/panel-auth';
import { t } from '@/shared/i18n';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export const metadata: Metadata = {
  title: t('adminSettings.metaTitle'),
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

interface ConfigEntry {
  key: string;
  value: unknown;
  description?: string;
}

/**
 * Runtime configuration (F5.3, api_contract.md §13).
 *
 * The flag that matters most here is `ENABLE_PAID_CHALLENGES`: the launch build
 * ships with it off, and the whole money loop stays dormant behind it until
 * legal and app-store approval land (compliance.md §7). Showing it as the first
 * thing on this page is deliberate — a launch-defining switch should not be
 * something you have to remember to go and check.
 */
export default async function AdminSettingsPage() {
  const token = await getAdminToken();
  const config = await apiFetchSafe<ConfigEntry[]>(API_ENDPOINTS.adminConfig, { token });
  const entries = config ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-4">
        <h1 className="font-display text-display-md uppercase">{t('adminSettings.title')}</h1>
        <p className="text-ink-secondary mt-2 text-sm">{t('adminSettings.description')}</p>
      </header>

      <SettingsSection
        heading={t('adminSettings.flagsHeading')}
        body={t('adminSettings.flagsBody')}
        restriction={t('adminSettings.superAdminOnly')}
      >
        <FlagRows entries={entries} />
      </SettingsSection>

      <SettingsSection
        heading={t('adminSettings.holidaysHeading')}
        body={t('adminSettings.holidaysBody')}
      >
        <HolidayList entries={entries} />
      </SettingsSection>

      <SettingsSection
        heading={t('adminSettings.limitsHeading')}
        body={t('adminSettings.limitsBody')}
      >
        <ConfigRows entries={entries.filter((entry) => !isFlag(entry) && !isHolidayKey(entry.key))} />
      </SettingsSection>
    </main>
  );
}

const HOLIDAY_KEY = 'india_holiday_dates';

function isHolidayKey(key: string): boolean {
  return key === HOLIDAY_KEY;
}

function isFlag(entry: ConfigEntry): boolean {
  return typeof entry.value === 'boolean' || entry.key.startsWith('ENABLE_');
}

function FlagRows({ entries }: { entries: ConfigEntry[] }) {
  const flags = entries.filter(isFlag);
  if (flags.length === 0) return <EmptyConfig />;

  return (
    <div>
      {flags.map((entry) => {
        const isOn = entry.value === true || entry.value === 'true';
        return (
          <SettingsRow
            key={entry.key}
            label={entry.key}
            {...(entry.description ? { hint: entry.description } : {})}
            value={<Badge tone={isOn ? 'win' : 'neutral'}>{isOn ? 'On' : 'Off'}</Badge>}
          />
        );
      })}
    </div>
  );
}

/**
 * An empty list is a real state, not a missing one: with no dates configured,
 * holiday pricing bands never match and every holiday charges the weekday or
 * weekend rate. Owners will report that as a bug, so say it here.
 */
function HolidayList({ entries }: { entries: ConfigEntry[] }) {
  const entry = entries.find((row) => isHolidayKey(row.key));
  const dates = Array.isArray(entry?.value)
    ? entry.value.filter((date): date is string => typeof date === 'string')
    : [];

  if (dates.length === 0) {
    return (
      <p className="border-dispute/50 bg-dispute/10 text-dispute border p-4 text-sm">
        No holiday dates configured. Holiday price bands will never apply until ops adds dates
        to <code>{HOLIDAY_KEY}</code>.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {dates.map((date) => (
        <span key={date} className="bg-inset text-ink rounded-chip px-3 py-2 text-sm tabular">
          {date}
        </span>
      ))}
    </div>
  );
}

function ConfigRows({ entries }: { entries: ConfigEntry[] }) {
  if (entries.length === 0) return <EmptyConfig />;

  return (
    <div>
      {entries.map((entry) => (
        <SettingsRow
          key={entry.key}
          label={entry.key}
          {...(entry.description ? { hint: entry.description } : {})}
          value={formatValue(entry.value)}
        />
      ))}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function EmptyConfig() {
  return (
    <p className="text-ink-muted text-sm">
      Nothing configured yet. Defaults from the server environment are in force.
    </p>
  );
}
