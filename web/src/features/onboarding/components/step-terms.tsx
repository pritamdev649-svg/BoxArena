'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { StepProps } from './step-basics';

const AMENITIES = [
  'parking',
  'washroom',
  'floodlights',
  'changing_room',
  'cafeteria',
  'cctv',
  'first_aid',
  'equipment_rental',
] as const;

/**
 * Step 6 — amenities, cancellation and booking mode.
 *
 * Booking mode is the real decision on this screen. `prepaid_only` is safest
 * for everyone and converts worst; `pay_at_venue_allowed` is how Indian turf
 * booking actually works and converts far better, at the cost of no-shows.
 * The compromise is the deposit: enough skin in the game that a booking means
 * something, small enough that people still book.
 */
export function StepPolicy({ application, pending, onSave }: StepProps) {
  const [amenities, setAmenities] = useState<string[]>(application.amenities ?? []);
  const [freeHours, setFreeHours] = useState('24');
  const [refundPercent, setRefundPercent] = useState('50');
  const [bookingMode, setBookingMode] = useState(application.bookingMode ?? 'prepaid_only');

  const toggle = (amenity: string) =>
    setAmenities(
      amenities.includes(amenity)
        ? amenities.filter((item) => item !== amenity)
        : [...amenities, amenity],
    );

  return (
    <div>
      <h2 className="font-display text-lg uppercase">Amenities and policy</h2>

      <AmenityPicker selected={amenities} onToggle={toggle} />

      <CancellationFields
        freeHours={freeHours}
        refundPercent={refundPercent}
        onFreeHours={setFreeHours}
        onRefundPercent={setRefundPercent}
      />

      <BookingMode value={bookingMode} onChange={setBookingMode} />

      <Button
        className="mt-6"
        disabled={pending}
        onClick={() =>
          onSave({
            amenities,
            cancellationPolicy: {
              freeCancellationHours: Number(freeHours),
              partialRefundPercent: Number(refundPercent),
            },
            bookingMode,
          })
        }
      >
        {pending ? 'Saving…' : 'Save and continue'}
      </Button>
    </div>
  );
}

function AmenityPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (amenity: string) => void;
}) {
  return (
    <div className="mt-5">
      <p className="label-caps text-ink-muted mb-2">What you offer</p>
      <div className="flex flex-wrap gap-2">
        {AMENITIES.map((amenity) => (
          <button
            key={amenity}
            type="button"
            onClick={() => onToggle(amenity)}
            className={chip(selected.includes(amenity))}
          >
            {amenity.replace(/_/gu, ' ')}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Published to players and honoured automatically, so it has to match what the
 * owner would actually do at the desk.
 */
function CancellationFields({
  freeHours,
  refundPercent,
  onFreeHours,
  onRefundPercent,
}: {
  freeHours: string;
  refundPercent: string;
  onFreeHours: (value: string) => void;
  onRefundPercent: (value: string) => void;
}) {
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Input
          label="Free cancellation up to (hours before)"
          type="number"
          min={0}
          max={168}
          value={freeHours}
          onChange={(e) => onFreeHours(e.target.value)}
          className="tabular"
        />
        <Input
          label="Refund after that (%)"
          type="number"
          min={0}
          max={100}
          value={refundPercent}
          onChange={(e) => onRefundPercent(e.target.value)}
          className="tabular"
        />
      </div>
      <p className="text-ink-muted mt-2 text-xs">
        This is published to players and honoured automatically &mdash; it has to match what you
        would actually do at the desk.
      </p>
    </>
  );
}

function BookingMode({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mt-6">
      <p className="label-caps text-ink-muted mb-2">How players pay</p>

      <div className="space-y-2">
        <ModeOption
          value="prepaid_only"
          current={value}
          onChange={onChange}
          title="Prepaid only"
          body="The slot is paid for before it is held. No no-shows, fewer bookings."
        />
        <ModeOption
          value="pay_at_venue_allowed"
          current={value}
          onChange={onChange}
          title="Pay at venue allowed"
          body="A small deposit holds the slot and the rest is paid at your desk. More bookings, and the deposit is forfeited if nobody turns up."
        />
      </div>
    </div>
  );
}

function ModeOption({
  value,
  current,
  onChange,
  title,
  body,
}: {
  value: string;
  current: string;
  onChange: (next: string) => void;
  title: string;
  body: string;
}) {
  return (
    <label className={option(current === value)}>
      <input
        type="radio"
        name="bookingMode"
        checked={current === value}
        onChange={() => onChange(value)}
        className="mt-1 size-4"
      />
      <span>
        <span className="text-ink block text-sm font-medium">{title}</span>
        <span className="text-ink-secondary block text-xs">{body}</span>
      </span>
    </label>
  );
}

/**
 * Step 7 — payout and agreement.
 *
 * The bank name must match the PAN, which ops verifies before a single rupee
 * moves. Commission is per-venue rather than global because it is negotiated
 * per venue &mdash; the field is here so the owner sees what they agreed to.
 */
function usePayoutForm() {
  const [accountHolderName, setHolder] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountNumber, setAccount] = useState('');
  const [pan, setPan] = useState('');
  const [accepted, setAccepted] = useState(false);

  const hasDestination = Boolean(ifsc.trim() || accountNumber.trim());
  const ready = Boolean(accountHolderName.trim() && pan.trim() && hasDestination && accepted);

  return {
    accountHolderName,
    setHolder,
    ifsc,
    setIfsc,
    accountNumber,
    setAccount,
    pan,
    setPan,
    accepted,
    setAccepted,
    ready,
  };
}

type PayoutForm = ReturnType<typeof usePayoutForm>;

export function StepPayout({ pending, onSave }: StepProps) {
  const form = usePayoutForm();

  return (
    <div>
      <h2 className="font-display text-lg uppercase">Getting paid</h2>
      <p className="text-ink-secondary mt-2 text-sm">
        Settlements run weekly, three working days after the slot date. Money for a Monday match
        reaches you the following week.
      </p>

      <BankFields form={form} />

      <label className="mt-5 flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={form.accepted}
          onChange={(e) => form.setAccepted(e.target.checked)}
          className="mt-0.5 size-4"
        />
        <span className="text-ink-secondary">
          I accept the partner terms, and I confirm I own or operate this venue.
        </span>
      </label>

      <Button
        className="mt-6"
        disabled={pending || !form.ready}
        onClick={() => onSave(payoutPayload(form))}
      >
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}

function payoutPayload(form: PayoutForm) {
  return {
    payout: {
      accountHolderName: form.accountHolderName,
      pan: form.pan,
      ...(form.ifsc.trim() ? { ifsc: form.ifsc.trim() } : {}),
      ...(form.accountNumber.trim() ? { accountNumber: form.accountNumber.trim() } : {}),
    },
    agreement: {
      /** Pre-filled from ops; negotiable per venue, which is why it is per-arena. */
      commissionPercent: 10,
      settlementCycle: 'weekly',
      acceptedTerms: true,
    },
  };
}

function BankFields({ form }: { form: PayoutForm }) {
  return (
    <div className="mt-5 grid gap-4">
      <Input
        label="Account holder name (as on the bank record)"
        value={form.accountHolderName}
        onChange={(e) => form.setHolder(e.target.value)}
        required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Account number"
          value={form.accountNumber}
          onChange={(e) => form.setAccount(e.target.value)}
          className="tabular"
        />
        <Input
          label="IFSC"
          value={form.ifsc}
          onChange={(e) => form.setIfsc(e.target.value.toUpperCase())}
          className="tabular"
          maxLength={11}
        />
      </div>
      <Input
        label="PAN"
        value={form.pan}
        onChange={(e) => form.setPan(e.target.value.toUpperCase())}
        className="tabular"
        maxLength={10}
        required
      />
    </div>
  );
}

function chip(active: boolean): string {
  const base = 'rounded-chip border px-3 py-1.5 text-xs capitalize transition';
  return active
    ? `${base} border-volt bg-volt/10 text-ink`
    : `${base} border-line text-ink-secondary hover:border-line-strong`;
}

function option(active: boolean): string {
  const base = 'flex cursor-pointer items-start gap-3 border p-3';
  return active ? `${base} border-volt bg-volt/5` : `${base} border-line-subtle`;
}
