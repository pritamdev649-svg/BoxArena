'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { t } from '@/shared/i18n';
import { blockSlotsAction, type BlockSlotsResult } from '../actions';
import type { OwnerCourt } from './court-list';

/**
 * Takes a range of hours off sale — rain, maintenance, a private event.
 *
 * Blocking deliberately does NOT cancel bookings that already exist inside the
 * window. It removes the free hours and reports the confirmed bookings it
 * could not touch, because cancelling those refunds players and that has to be
 * the owner's explicit decision, not a side effect of blocking an afternoon.
 */
function useBlockForm(defaultCourtId: string) {
  const [courtId, setCourtId] = useState(defaultCourtId);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<BlockSlotsResult>();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setResult(
      await blockSlotsAction({
        courtId,
        /** datetime-local carries no zone; the venue is in IST, so say so. */
        from: `${from}:00+05:30`,
        to: `${to}:00+05:30`,
        reason: reason.trim(),
      }),
    );
    setPending(false);
  };

  return {
    courtId, setCourtId, from, setFrom, to, setTo, reason, setReason, pending, result, submit,
  };
}

export function BlockSlotsForm({ courts }: { courts: OwnerCourt[] }) {
  const bookable = courts.filter((court) => court.isActive !== false);
  const form = useBlockForm(bookable[0]?._id ?? '');

  if (bookable.length === 0) {
    return <p className="text-ink-muted text-sm">{t('partnerCourts.noCourts')}</p>;
  }

  return (
    <form onSubmit={form.submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <CourtSelect courts={bookable} value={form.courtId} onChange={form.setCourtId} />

        <Input
          label={t('partnerCourts.reasonLabel')}
          value={form.reason}
          onChange={(event) => form.setReason(event.target.value)}
          placeholder={t('partnerCourts.reasonPlaceholder')}
          minLength={3}
          maxLength={200}
          required
        />

        <Input
          label={t('partnerCourts.blockFrom')}
          type="datetime-local"
          value={form.from}
          onChange={(event) => form.setFrom(event.target.value)}
          className="tabular"
          required
        />

        <Input
          label={t('partnerCourts.blockTo')}
          type="datetime-local"
          value={form.to}
          onChange={(event) => form.setTo(event.target.value)}
          className="tabular"
          required
        />
      </div>

      <Button type="submit" size="sm" className="mt-4" disabled={form.pending || !form.from || !form.to}>
        {form.pending ? t('partnerCourts.blocking') : t('partnerCourts.blockSlots')}
      </Button>

      <BlockOutcome result={form.result} />
    </form>
  );
}

function CourtSelect({
  courts,
  value,
  onChange,
}: {
  courts: OwnerCourt[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <label htmlFor="block-court" className="label-caps text-ink-muted mb-2 block">
        {t('partnerCourts.court')}
      </label>
      <select
        id="block-court"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-line text-ink bg-surface rounded-control h-11 w-full border px-3 text-sm outline-none"
      >
        {courts.map((court) => (
          <option key={court._id} value={court._id}>
            {court.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function BlockOutcome({ result }: { result: BlockSlotsResult | undefined }) {
  if (!result) return null;

  if (!result.success) {
    return (
      <p className="border-loss/40 bg-loss/10 text-loss rounded-control mt-4 border p-3 text-sm">
        {result.error}
      </p>
    );
  }

  const affected = result.affectedBookings ?? [];

  return (
    <div className="mt-4 space-y-3">
      <p className="border-win/40 bg-win/10 text-win rounded-control border p-3 text-sm">
        {t('partnerCourts.blocked', { count: result.blockedCount ?? 0 })}
      </p>

      {affected.length > 0 ? (
        <div className="border-dispute/40 bg-dispute/10 rounded-control border p-3">
          <p className="text-dispute flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4" />
            {t('partnerCourts.stillBooked', { count: affected.length })}
          </p>
          <p className="text-ink-secondary mt-1 text-xs">{t('partnerCourts.stillBookedHint')}</p>
          <ul className="divide-line-subtle mt-2 divide-y">
            {affected.map((booking) => (
              <li key={booking.publicId} className="tabular flex justify-between py-1 text-xs">
                <span>{booking.publicId}</span>
                <span>
                  {new Date(booking.startAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
