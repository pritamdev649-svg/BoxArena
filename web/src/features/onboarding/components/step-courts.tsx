'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { StepProps } from './step-basics';

interface CourtDraft {
  name: string;
  sport: string;
  surface: string;
  isIndoor: boolean;
  rupees: string;
}

/** A venue sells what it has — narrower scopes apply to challenges, not courts. */
const SPORTS = ['badminton', 'cricket', 'football'] as const;

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Step 3 — courts.
 *
 * The question that gets this right is &ldquo;how many games can run at the
 * same time?&rdquo;, not &ldquo;how many courts do you have?&rdquo;. A hall
 * with four nets is four courts. One turf that splits into two five-a-side
 * pitches is two courts, and both must be bookable independently.
 */
export function StepCourts({ application, pending, onSave }: StepProps) {
  const [courts, setCourts] = useState<CourtDraft[]>(
    application.courts?.map((court) => ({
      name: court.name,
      sport: court.sport,
      surface: '',
      isIndoor: court.isIndoor,
      rupees: String(court.basePricePerHourPaise / 100),
    })) ?? [blankCourt(1)],
  );

  const update = (index: number, patch: Partial<CourtDraft>) =>
    setCourts(courts.map((court, i) => (i === index ? { ...court, ...patch } : court)));

  const valid = courts.length > 0 && courts.every((court) => court.name.trim() && court.rupees);

  return (
    <div>
      <h2 className="font-display text-lg uppercase">Your courts</h2>
      <p className="text-ink-secondary mt-2 text-sm">
        One row for every game that can run at the same time. Four nets in one hall is four
        courts &mdash; players book them separately.
      </p>

      <ul className="mt-5 space-y-4">
        {courts.map((court, index) => (
          <CourtRow
            key={index}
            court={court}
            onChange={(patch) => update(index, patch)}
            onRemove={
              courts.length > 1
                ? () => setCourts(courts.filter((_, i) => i !== index))
                : undefined
            }
          />
        ))}
      </ul>

      <Button
        variant="secondary"
        size="sm"
        className="mt-4"
        onClick={() => setCourts([...courts, blankCourt(courts.length + 1)])}
      >
        <Plus className="size-4" /> Add another court
      </Button>

      <div className="mt-6">
        <Button disabled={pending || !valid} onClick={() => onSave(courts.map(toPayload))}>
          {pending ? 'Saving…' : 'Save and continue'}
        </Button>
      </div>
    </div>
  );
}

function blankCourt(index: number): CourtDraft {
  return {
    name: `Court ${String(index)}`,
    sport: 'badminton',
    surface: '',
    isIndoor: true,
    rupees: '',
  };
}

/** Rupees in the UI, integer paise on the wire. */
function toPayload(court: CourtDraft) {
  return {
    name: court.name.trim(),
    sport: court.sport,
    isIndoor: court.isIndoor,
    basePricePerHourPaise: Math.round(Number(court.rupees) * 100),
    ...(court.surface.trim() ? { surface: court.surface.trim() } : {}),
  };
}

function CourtRow({
  court,
  onChange,
  onRemove,
}: {
  court: CourtDraft;
  onChange: (patch: Partial<CourtDraft>) => void;
  onRemove: (() => void) | undefined;
}) {
  return (
    <li className="border-line-subtle border p-4">
      <CourtFields court={court} onChange={onChange} />

      <div className="mt-3 flex items-center justify-between">
        <label className="text-ink-secondary flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={court.isIndoor}
            onChange={(e) => onChange({ isIndoor: e.target.checked })}
            className="size-4"
          />
          Indoor
        </label>
        {onRemove ? (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <X className="size-4" /> Remove
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function CourtFields({
  court,
  onChange,
}: {
  court: CourtDraft;
  onChange: (patch: Partial<CourtDraft>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Input
        label="Name"
        value={court.name}
        onChange={(e) => onChange({ name: e.target.value })}
        maxLength={50}
      />
      <div>
        <label className="label-caps text-ink-muted mb-2 block">Sport</label>
        <select
          value={court.sport}
          onChange={(e) => onChange({ sport: e.target.value })}
          className="border-line text-ink bg-surface rounded-control h-11 w-full border px-3 text-sm outline-none"
        >
          {SPORTS.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>
      </div>
      <Input
        label="Surface"
        value={court.surface}
        onChange={(e) => onChange({ surface: e.target.value })}
        placeholder="Wooden, synthetic, turf"
        maxLength={40}
      />
      <Input
        label="Price per hour (₹)"
        type="number"
        min={0}
        step={10}
        value={court.rupees}
        onChange={(e) => onChange({ rupees: e.target.value })}
        className="tabular"
      />
    </div>
  );
}

/**
 * Step 4 — operating hours.
 *
 * This template is what the slot cron materialises from, so a wrong closing
 * time here means slots that cannot be played, not just a cosmetic error.
 */
export function StepHours({ application, pending, onSave }: StepProps) {
  const [hours, setHours] = useState(
    application.operatingHours ??
      DAYS.map((_, dayOfWeek) => ({
        dayOfWeek,
        openTime: '06:00',
        closeTime: '23:00',
        isClosed: false,
      })),
  );

  const update = (index: number, patch: Partial<(typeof hours)[number]>) =>
    setHours(hours.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div>
      <h2 className="font-display text-lg uppercase">Opening hours</h2>
      <p className="text-ink-secondary mt-2 text-sm">
        Slots are generated from these, so set them to the hours you can actually let people
        play.
      </p>

      <ul className="divide-line-subtle border-line-subtle mt-5 divide-y border-y">
        {hours.map((row, index) => (
          <DayRow key={row.dayOfWeek} row={row} onChange={(patch) => update(index, patch)} />
        ))}
      </ul>

      <Button className="mt-6" disabled={pending} onClick={() => onSave(hours)}>
        {pending ? 'Saving…' : 'Save and continue'}
      </Button>
    </div>
  );
}

interface DayHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

function DayRow({
  row,
  onChange,
}: {
  row: DayHours;
  onChange: (patch: Partial<DayHours>) => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="text-ink w-24 text-sm font-medium">{DAYS[row.dayOfWeek]}</span>

      {row.isClosed ? (
        <span className="text-ink-muted flex-1 text-sm">Closed</span>
      ) : (
        <div className="flex flex-1 items-center gap-2">
          <input
            type="time"
            value={row.openTime}
            onChange={(e) => onChange({ openTime: e.target.value })}
            className="border-line bg-surface rounded-control h-10 border px-2 text-sm"
          />
          <span className="text-ink-muted text-sm">to</span>
          <input
            type="time"
            value={row.closeTime}
            onChange={(e) => onChange({ closeTime: e.target.value })}
            className="border-line bg-surface rounded-control h-10 border px-2 text-sm"
          />
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={() => onChange({ isClosed: !row.isClosed })}>
        {row.isClosed ? 'Open this day' : 'Mark closed'}
      </Button>
    </li>
  );
}
