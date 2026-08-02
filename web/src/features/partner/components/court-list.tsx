'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { MoneyText } from '@/shared/ui/money-text';
import { Badge } from '@/shared/ui/badge';
import { t } from '@/shared/i18n';
import { addCourtAction, updateCourtAction, type PartnerMutationResult } from '../actions';

/**
 * Courts are inventory: each one is a thing that can be booked at the same
 * time as the others.
 *
 * Retiring a court is the dangerous operation, so it is a toggle with a
 * confirmation rather than a delete — and the API refuses it outright while
 * upcoming bookings exist, listing them instead of stranding players.
 */
export interface OwnerCourt {
  _id: string;
  name: string;
  sport: string;
  surface?: string;
  isIndoor?: boolean;
  isActive?: boolean;
  basePricePerHourPaise: number;
}

/**
 * Every sport a venue can sell — deliberately NOT narrowed to the competitive
 * scope. A turf owner lists the pitch they own; whether players can stake on a
 * football result is a separate question, enforced at challenge creation.
 */
const SPORTS = ['badminton', 'cricket', 'football'] as const;

export function CourtList({
  arenaPublicId,
  courts,
}: {
  arenaPublicId: string;
  courts: OwnerCourt[];
}) {
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<PartnerMutationResult>();

  return (
    <div>
      <ul className="divide-line-subtle divide-y">
        {courts.map((court) => (
          <CourtRow key={court._id} court={court} onResult={setResult} />
        ))}
      </ul>

      {courts.length === 0 ? (
        <p className="text-ink-muted py-3 text-sm">{t('partnerCourts.noCourts')}</p>
      ) : null}

      {adding ? (
        <AddCourtForm
          arenaPublicId={arenaPublicId}
          onDone={(outcome) => {
            setResult(outcome);
            if (outcome.success) setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> {t('partnerCourts.addCourt')}
        </Button>
      )}

      <Outcome result={result} />
    </div>
  );
}

function CourtRow({
  court,
  onResult,
}: {
  court: OwnerCourt;
  onResult: (result: PartnerMutationResult) => void;
}) {
  const [pending, setPending] = useState(false);
  const isActive = court.isActive !== false;

  const toggle = async () => {
    setPending(true);
    onResult(await updateCourtAction(court._id, { isActive: !isActive }));
    setPending(false);
  };

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-ink text-sm font-medium">
          {court.name}
          {isActive ? null : (
            <Badge tone="neutral" className="ml-2">
              {t('partnerCourts.retired')}
            </Badge>
          )}
        </p>
        <p className="text-ink-muted text-xs">
          {court.sport}
          {court.surface ? ` · ${court.surface}` : ''}
          {court.isIndoor ? ` · ${t('partnerCourts.indoor')}` : ''}
        </p>
      </div>

      <div className="text-right">
        <MoneyText paise={court.basePricePerHourPaise} className="text-sm font-medium" />
        <p className="text-ink-muted text-xs">{t('partnerCourts.basePrice')}</p>
      </div>

      <Button variant="ghost" size="sm" disabled={pending} onClick={() => void toggle()}>
        {isActive ? t('partnerCourts.retire') : t('partnerCourts.reactivate')}
      </Button>
    </li>
  );
}

function useNewCourt(arenaPublicId: string, onDone: (result: PartnerMutationResult) => void) {
  const [name, setName] = useState('');
  const [sport, setSport] = useState<string>(SPORTS[0]);
  const [surface, setSurface] = useState('');
  const [rupees, setRupees] = useState('');
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    onDone(
      await addCourtAction(arenaPublicId, {
        name: name.trim(),
        sport,
        /** Rupees in the UI, paise on the wire — money is integer paise. */
        basePricePerHourPaise: Math.round(Number(rupees) * 100),
        ...(surface.trim() ? { surface: surface.trim() } : {}),
      }),
    );
    setPending(false);
  };

  return { name, setName, sport, setSport, surface, setSurface, rupees, setRupees, pending, submit };
}

function AddCourtForm({
  arenaPublicId,
  onDone,
  onCancel,
}: {
  arenaPublicId: string;
  onDone: (result: PartnerMutationResult) => void;
  onCancel: () => void;
}) {
  const form = useNewCourt(arenaPublicId, onDone);

  return (
    <form onSubmit={form.submit} className="border-line-subtle mt-4 border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label={t('partnerCourts.nameLabel')}
          value={form.name}
          onChange={(event) => form.setName(event.target.value)}
          placeholder={t('partnerCourts.namePlaceholder')}
          maxLength={50}
          required
        />
        <SportSelect value={form.sport} onChange={form.setSport} />
        <Input
          label={t('partnerCourts.surfaceLabel')}
          value={form.surface}
          onChange={(event) => form.setSurface(event.target.value)}
          placeholder={t('partnerCourts.surfacePlaceholder')}
          maxLength={40}
        />
        <Input
          label={t('partnerCourts.priceLabel')}
          type="number"
          min={0}
          step={10}
          value={form.rupees}
          onChange={(event) => form.setRupees(event.target.value)}
          className="tabular"
          required
        />
      </div>

      <FormActions
        disabled={form.pending || !form.name.trim() || !form.rupees}
        pending={form.pending}
        onCancel={onCancel}
      />
    </form>
  );
}

function FormActions({
  disabled,
  pending,
  onCancel,
}: {
  disabled: boolean;
  pending: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <Button type="submit" size="sm" disabled={disabled}>
        {pending ? t('partnerCourts.saving') : t('partnerCourts.addCourt')}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
        {t('partnerCourts.cancel')}
      </Button>
    </div>
  );
}

function SportSelect({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div>
      <label htmlFor="court-sport" className="label-caps text-ink-muted mb-2 block">
        {t('partnerCourts.sportLabel')}
      </label>
      <select
        id="court-sport"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-line text-ink bg-surface rounded-control h-11 w-full border px-3 text-sm outline-none"
      >
        {SPORTS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Shared success/failure line, including the conflicts the API returned. */
export function Outcome({ result }: { result: PartnerMutationResult | undefined }) {
  if (!result) return null;

  if (result.success) {
    return (
      <p className="border-win/40 bg-win/10 text-win rounded-control mt-4 border p-3 text-sm">
        {t('partnerCourts.saved')}
      </p>
    );
  }

  return (
    <div className="border-loss/40 bg-loss/10 rounded-control mt-4 border p-3 text-sm">
      <p className="text-loss font-medium">{result.error}</p>
      {result.conflicts && result.conflicts.length > 0 ? (
        <ul className="divide-line-subtle mt-2 divide-y">
          {result.conflicts.map((conflict) => (
            <li key={conflict.slotId} className="tabular flex justify-between py-1 text-xs">
              <span>
                {conflict.localDate} ·{' '}
                {new Date(conflict.startAt).toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span className="text-loss uppercase">{conflict.status}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
