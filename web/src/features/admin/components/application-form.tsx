'use client';

import { useState } from 'react';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { LUCKNOW_AREAS } from '@/mocks/seed/arenas';

const SPORTS = ['cricket', 'football', 'badminton'] as const;

/** Stage 1 lead capture. Six fields — see arena_onboarding.md §3. */
export function ApplicationForm() {
  const [sports, setSports] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return <SubmittedNotice />;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
      }}
    >
      <Input label="Your name" name="ownerName" autoComplete="name" required />

      <Input
        label="Mobile number"
        name="phone"
        type="tel"
        inputMode="numeric"
        maxLength={10}
        prefix="+91"
        placeholder="98765 43210"
        className="tabular"
        required
      />

      <Input label="Venue name" name="venueName" required />

      <AreaSelect />

      <SportPicker sports={sports} onChange={setSports} />

      <Input
        label="How many games can run at the same time?"
        name="courtCount"
        type="number"
        min={1}
        max={20}
        hint="Not how many rooms — how many separate matches can play at once."
        className="tabular"
        required
      />

      <Button type="submit" size="lg" fullWidth disabled={sports.length === 0}>
        Submit application
      </Button>

      <p className="text-ink-muted text-xs">
        No cost, no contract. We verify every venue in person before it goes live.
      </p>
    </form>
  );
}

function AreaSelect() {
  return (
    <div>
      <label htmlFor="area" className="label-caps text-ink-muted mb-2 block">
        Area
      </label>
      <select
        id="area"
        name="areaName"
        required
        className="border-line focus-within:border-line-strong text-ink bg-surface h-11 w-full border px-3 text-sm outline-none"
      >
        <option value="">Select an area</option>
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
      <legend className="label-caps text-ink-muted mb-2">Sports you offer</legend>
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

function SubmittedNotice() {
  return (
    <div className="border-win/40 bg-win/10 border p-6">
      <h2 className="font-display text-lg uppercase">Application received</h2>
      <p className="text-ink-secondary mt-2 text-sm">
        We&rsquo;ll call you today to confirm the details and arrange a visit. Nothing goes live
        until we&rsquo;ve seen the venue.
      </p>
    </div>
  );
}
