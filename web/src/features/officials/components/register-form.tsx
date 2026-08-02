'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { t } from '@/shared/i18n';
import { registerOfficialAction } from '../actions';

/**
 * Registering as an official.
 *
 * Anyone may list themselves and set their own price — that is the stated rule
 * (featuredoc/11). What registration does NOT grant is the power to settle a
 * money match: that needs ID verification, which ops does afterwards. The form
 * says so plainly rather than letting someone discover it at a match.
 */
const SPORTS = ['badminton', 'cricket', 'football'] as const;

function useRegistration() {
  const [displayName, setDisplayName] = useState('');
  const [sports, setSports] = useState<string[]>(['badminton']);
  const [rupees, setRupees] = useState('');
  const [experience, setExperience] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const result = await registerOfficialAction({
      type: 'independent',
      displayName: displayName.trim(),
      sports,
      /** Rupees on screen, integer paise on the wire. */
      pricePerMatchPaise: Math.round(Number(rupees) * 100),
      ...(experience ? { experienceYears: Number(experience) } : {}),
    });

    setPending(false);
    if (!result.success) {
      setError(result.error ?? t('officials.failed'));
      return;
    }
    setDone(true);
  };

  return {
    displayName, setDisplayName, sports, setSports, rupees, setRupees,
    experience, setExperience, pending, error, done, submit,
  };
}

export function RegisterOfficialForm() {
  const form = useRegistration();
  const { done } = form;

  if (done) {
    return (
      <div className="border-win/40 bg-win/10 rounded-control border p-5">
        <p className="text-win font-medium">{t('officials.registered')}</p>
        <p className="text-ink-secondary mt-2 text-sm">{t('officials.registeredHint')}</p>
      </div>
    );
  }

  return (
    <form onSubmit={form.submit} className="space-y-4">
      <Input
        label={t('officials.nameLabel')}
        value={form.displayName}
        onChange={(event) => form.setDisplayName(event.target.value)}
        placeholder={t('officials.namePlaceholder')}
        maxLength={60}
        required
      />

      <SportPicker selected={form.sports} onChange={form.setSports} />
      <PriceFields form={form} />

      {form.error ? <p className="text-loss text-sm">{form.error}</p> : null}

      <p className="border-line-subtle text-ink-secondary rounded-control border border-dashed p-3 text-xs">
        {t('officials.verificationNote')}
      </p>

      <Button type="submit" size="lg" disabled={form.pending || form.sports.length === 0}>
        {form.pending ? t('officials.registering') : t('officials.register')}
      </Button>
    </form>
  );
}

function PriceFields({ form }: { form: ReturnType<typeof useRegistration> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label={t('officials.priceLabel')}
        type="number"
        min={0}
        step={50}
        value={form.rupees}
        onChange={(event) => form.setRupees(event.target.value)}
        className="tabular"
        required
      />
      <Input
        label={t('officials.experienceLabel')}
        type="number"
        min={0}
        max={60}
        value={form.experience}
        onChange={(event) => form.setExperience(event.target.value)}
        className="tabular"
      />
    </div>
  );
}

function SportPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <span className="label-caps text-ink-muted mb-2 block">{t('officials.sportsLabel')}</span>
      <div className="flex flex-wrap gap-2">
        {SPORTS.map((sport) => {
          const isOn = selected.includes(sport);
          return (
            <button
              key={sport}
              type="button"
              aria-pressed={isOn}
              onClick={() =>
                onChange(isOn ? selected.filter((s) => s !== sport) : [...selected, sport])
              }
              className={
                isOn
                  ? 'bg-volt text-ink-inverse rounded-chip px-3 py-2 text-sm font-medium'
                  : 'border-line text-ink-secondary hover:border-line-strong rounded-chip border px-3 py-2 text-sm'
              }
            >
              {sport}
            </button>
          );
        })}
      </div>
    </div>
  );
}
