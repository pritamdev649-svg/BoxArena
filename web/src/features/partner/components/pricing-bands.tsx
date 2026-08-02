'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { t } from '@/shared/i18n';
import { setPricingRulesAction, type PricingRuleInput, type PartnerMutationResult } from '../actions';
import { Outcome } from './court-list';
import type { OwnerCourt } from './court-list';

/**
 * Peak / off-peak / weekend price bands.
 *
 * A band says "on these days, between these hours, an hour costs this". Where
 * two bands overlap the more specific one wins — holiday beats weekend beats
 * weekday — and the owner's priority number beats all of it
 * (pricing.service.ts). Anything not covered by a band falls back to the
 * court's base price, which is why an empty list is a valid, working state.
 *
 * Saving REPLACES the whole set, so this component always submits every row it
 * is showing. Repricing only touches future AVAILABLE slots: a slot someone
 * already booked keeps the price they agreed to.
 */
export interface ExistingRule {
  _id: string;
  courtId?: string;
  appliesTo: PricingRuleInput['appliesTo'];
  daysOfWeek?: number[];
  specificDate?: string;
  startTime: string;
  endTime: string;
  pricePerHourPaise: number;
  priority: number;
}

interface BandRow extends Omit<PricingRuleInput, 'courtId'> {
  /** Local only — React needs a stable key before the row is ever saved. */
  key: string;
  /**
   * Explicitly `| undefined`: switching a band back to "all courts" has to
   * clear the field, and under exactOptionalPropertyTypes an optional property
   * cannot be assigned undefined. JSON.stringify drops it on the way out.
   */
  courtId?: string | undefined;
}

const APPLIES_TO: PricingRuleInput['appliesTo'][] = [
  'weekday',
  'weekend',
  'holiday',
  'specific_date',
];

function optionsFor(current: PricingRuleInput['appliesTo']): PricingRuleInput['appliesTo'][] {
  return APPLIES_TO.includes(current) ? APPLIES_TO : [...APPLIES_TO, current];
}

function toRow(rule: ExistingRule): BandRow {
  return {
    key: rule._id,
    appliesTo: rule.appliesTo,
    startTime: rule.startTime,
    endTime: rule.endTime,
    pricePerHourPaise: rule.pricePerHourPaise,
    priority: rule.priority,
    ...(rule.courtId ? { courtId: String(rule.courtId) } : {}),
    ...(rule.specificDate ? { specificDate: rule.specificDate } : {}),
    ...(rule.daysOfWeek ? { daysOfWeek: rule.daysOfWeek } : {}),
  };
}

/** Row state plus the save call — keeps the component itself declarative. */
function useBands(arenaPublicId: string, rules: ExistingRule[]) {
  const [rows, setRows] = useState<BandRow[]>(() => rules.map(toRow));
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<PartnerMutationResult & { slotsRepriced?: number }>();

  const update = (key: string, patch: Partial<BandRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const remove = (key: string) =>
    setRows((current) => current.filter((row) => row.key !== key));

  const add = () =>
    setRows((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        appliesTo: 'weekday',
        startTime: '18:00',
        endTime: '22:00',
        pricePerHourPaise: 0,
        priority: 0,
      },
    ]);

  const save = async () => {
    setPending(true);
    setResult(
      await setPricingRulesAction(
        arenaPublicId,
        rows.map(({ key: _key, ...rule }) => rule),
      ),
    );
    setPending(false);
  };

  return { rows, pending, result, update, remove, add, save };
}

export function PricingBands({
  arenaPublicId,
  courts,
  rules,
}: {
  arenaPublicId: string;
  courts: OwnerCourt[];
  rules: ExistingRule[];
}) {
  const { rows, pending, result, update, remove, add, save } = useBands(arenaPublicId, rules);

  return (
    <div>
      {rows.length === 0 ? (
        <p className="text-ink-muted text-sm">{t('partnerCourts.noBands')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <BandEditor
              key={row.key}
              row={row}
              courts={courts}
              onChange={(patch) => update(row.key, patch)}
              onRemove={() => remove(row.key)}
            />
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="size-4" /> {t('partnerCourts.addBand')}
        </Button>
        <Button size="sm" disabled={pending} onClick={() => void save()}>
          {pending ? t('partnerCourts.saving') : t('partnerCourts.saveBands')}
        </Button>
      </div>

      {result?.success && typeof result.slotsRepriced === 'number' ? (
        <p className="border-win/40 bg-win/10 text-win rounded-control mt-4 border p-3 text-sm">
          {t('partnerCourts.repriced', { count: result.slotsRepriced })}
        </p>
      ) : (
        <Outcome result={result?.success ? undefined : result} />
      )}
    </div>
  );
}

function BandEditor({
  row,
  courts,
  onChange,
  onRemove,
}: {
  row: BandRow;
  courts: OwnerCourt[];
  onChange: (patch: Partial<BandRow>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="border-line-subtle grid gap-3 border p-3 sm:grid-cols-2 lg:grid-cols-6">
      <WhenFields row={row} onChange={onChange} />

      <Field label={t('partnerCourts.rupeesPerHour')}>
        <input
          type="number"
          min={0}
          step={10}
          value={row.pricePerHourPaise / 100}
          onChange={(event) =>
            onChange({ pricePerHourPaise: Math.round(Number(event.target.value) * 100) })
          }
          className={CONTROL}
        />
      </Field>

      <Field label={t('partnerCourts.court')}>
        <select
          value={row.courtId ?? ''}
          onChange={(event) =>
            onChange({ courtId: event.target.value === '' ? undefined : event.target.value })
          }
          className={CONTROL}
        >
          <option value="">{t('partnerCourts.allCourts')}</option>
          {courts.map((court) => (
            <option key={court._id} value={court._id}>
              {court.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex items-end">
        <Button variant="ghost" size="sm" onClick={onRemove} aria-label={t('partnerCourts.removeBand')}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

/** When the band applies: kind, optional date, and the hour range. */
function WhenFields({
  row,
  onChange,
}: {
  row: BandRow;
  onChange: (patch: Partial<BandRow>) => void;
}) {
  return (
    <>
      <Field label={t('partnerCourts.appliesTo')}>
        <select
          value={row.appliesTo}
          onChange={(event) =>
            onChange({ appliesTo: event.target.value as PricingRuleInput['appliesTo'] })
          }
          className={CONTROL}
        >
          {/* A band created elsewhere (the onboarding wizard offers chosen-days)
              must still show its own kind, or saving would silently convert it. */}
          {optionsFor(row.appliesTo).map((option) => (
            <option key={option} value={option}>
              {t(`partnerCourts.appliesTo_${option}`)}
            </option>
          ))}
        </select>
      </Field>

      {row.appliesTo === 'specific_date' ? (
        <Field label={t('partnerCourts.onDate')}>
          <input
            type="date"
            value={row.specificDate ?? ''}
            onChange={(event) => onChange({ specificDate: event.target.value })}
            className={CONTROL}
          />
        </Field>
      ) : null}

      <Field label={t('partnerCourts.from')}>
        <TimeInput value={row.startTime} onChange={(startTime) => onChange({ startTime })} />
      </Field>

      <Field label={t('partnerCourts.to')}>
        <TimeInput value={row.endTime} onChange={(endTime) => onChange({ endTime })} />
      </Field>
    </>
  );
}

const CONTROL =
  'border-line text-ink bg-surface rounded-control tabular h-10 w-full border px-2 text-sm outline-none';

function TimeInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <input
      type="time"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={CONTROL}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label-caps text-ink-muted mb-1 block">{label}</span>
      {children}
    </label>
  );
}
