'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { LUCKNOW_AREAS } from '@/mocks/seed/arenas';
import { t } from '@/shared/i18n';
import { registerVenueAction, verifyVenueAction } from '../actions';
import { DevCodeNotice } from './otp-form';

/**
 * Venue registration — the six-field lead from arena_onboarding.md §3.
 *
 * Deliberately short: this gets filled standing in a turf office, often by a
 * field-sales rep with the owner. Everything else (photos, map pin, courts,
 * pricing, payout) belongs to the 7-step wizard AFTER the phone is verified,
 * because a long form before any commitment is where owners drop off.
 *
 * Creates an `ArenaApplication` and a pending `arena_owner` — never a live
 * arena. Nothing goes live without human verification.
 */

const SPORTS = ['cricket', 'football', 'badminton'] as const;

export function PartnerRegisterForm() {
  const [sports, setSports] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<{ applicationPublicId: string; devCode?: string }>();

  /** Once the application exists, the owner just has to confirm their phone. */
  if (pending) {
    return (
      <VerifyVenueStep
        applicationPublicId={pending.applicationPublicId}
        {...(pending.devCode ? { devCode: pending.devCode } : {})}
      />
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setError(undefined);
    setLoading(true);
    const result = await registerVenueAction({
      ownerName: String(data.get('ownerName') ?? ''),
      phoneNumber: String(data.get('phoneNumber') ?? ''),
      venueName: String(data.get('venueName') ?? ''),
      areaName: String(data.get('areaName') ?? ''),
      sports,
      courtCount: Number(data.get('courtCount') ?? 1),
    });
    setLoading(false);

    if (!result.success || !result.applicationPublicId) {
      setError(result.error ?? 'Could not submit that. Try again.');
      return;
    }
    setPending({
      applicationPublicId: result.applicationPublicId,
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  };

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <LeadFields sports={sports} onSports={setSports} />

      {error ? (
        <p className="border-loss/40 bg-loss/10 text-loss border px-3 py-2 text-xs">{error}</p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={sports.length === 0 || loading}>
        {loading ? t('auth.sending') : t('partnerAuth.submit')}
      </Button>

      <p className="text-ink-muted text-xs">{t('partnerAuth.noCost')}</p>
    </form>
  );
}

/** The six fields from arena_onboarding.md §3, in the order an owner thinks about them. */
function LeadFields({
  sports,
  onSports,
}: {
  sports: string[];
  onSports: (next: string[]) => void;
}) {
  return (
    <>
      <Input label={t('partnerAuth.ownerNameLabel')} name="ownerName" autoComplete="name" required />

      <Input
        label={t('auth.phoneLabel')}
        name="phoneNumber"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        maxLength={10}
        prefix={t('auth.dialCode')}
        placeholder={t('auth.phonePlaceholder')}
        className="tabular"
        required
      />

      <Input label={t('partnerAuth.venueNameLabel')} name="venueName" required />

      <AreaSelect />

      <SportPicker sports={sports} onChange={onSports} />

      <Input
        label={t('partnerAuth.courtCountLabel')}
        name="courtCount"
        type="number"
        min={1}
        max={20}
        hint={t('partnerAuth.courtCountHint')}
        className="tabular"
        required
      />
    </>
  );
}

/**
 * Step 2 of registration. Confirming the phone promotes the applicant to a
 * pending `arena_owner` and signs them straight into the panel, where the
 * 7-step wizard picks up.
 */
function VerifyVenueStep({
  applicationPublicId,
  devCode,
}: {
  applicationPublicId: string;
  devCode?: string;
}) {
  const [code, setCode] = useState(devCode ?? '');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    setLoading(true);
    const result = await verifyVenueAction(applicationPublicId, code);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? t('auth.invalidCode'));
      return;
    }
    /**
     * Straight into the wizard, not the panel. The panel is for a venue that
     * is already live; a freshly verified applicant has no arena to manage
     * yet, and landing them on an empty dashboard is where onboarding stalled.
     */
    router.push('/partner/onboarding');
    router.refresh();
  };

  return (
    <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
      <p className="text-ink-secondary text-sm">{t('auth.codeSentTo')}</p>

      {devCode ? <DevCodeNotice code={devCode} /> : null}

      <Input
        label={t('auth.codeLabel')}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder={t('auth.codePlaceholder')}
        className="tabular tracking-[0.4em]"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/gu, ''))}
        {...(error ? { error } : {})}
        required
      />

      <Button type="submit" size="lg" fullWidth disabled={code.length !== 6 || loading}>
        {loading ? t('auth.verifying') : t('auth.verify')}
      </Button>
    </form>
  );
}

function AreaSelect() {
  return (
    <div>
      <label htmlFor="areaName" className="label-caps text-ink-muted mb-2 block">
        {t('partnerAuth.areaLabel')}
      </label>
      <select
        id="areaName"
        name="areaName"
        required
        className="border-line focus-within:border-line-strong text-ink bg-surface h-11 w-full border px-3 text-sm outline-none"
      >
        <option value="">{t('partnerAuth.areaPlaceholder')}</option>
        {LUCKNOW_AREAS.map((area) => (
          <option key={area} value={area}>
            {area}
          </option>
        ))}
      </select>
    </div>
  );
}

function SportPicker({
  sports,
  onChange,
}: {
  sports: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="label-caps text-ink-muted mb-2">{t('partnerAuth.sportsLabel')}</legend>
      <div className="flex flex-wrap gap-2">
        {SPORTS.map((sport) => {
          const isOn = sports.includes(sport);
          return (
            <button
              key={sport}
              type="button"
              aria-pressed={isOn}
              onClick={() =>
                onChange(isOn ? sports.filter((s) => s !== sport) : [...sports, sport])
              }
              className={
                isOn
                  ? 'bg-volt text-ink-inverse rounded-chip px-3 py-2 text-sm font-medium capitalize'
                  : 'border-line text-ink-secondary hover:border-line-strong rounded-chip border px-3 py-2 text-sm capitalize'
              }
            >
              {sport}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
