'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { MoneyText } from '@/shared/ui/money-text';
import { Button } from '@/shared/ui/button';
import { formatTime } from '@/shared/lib/datetime';
import { holdSlotsAction } from '@/features/booking';



export interface GridSlot {
  id: string;
  startAt: string;
  endAt: string;
  /** `past` is server-computed: the slot is free but inside the booking
      lead-time window, so it can no longer be held. */
  status: 'available' | 'booked' | 'blocked' | 'held' | 'past';
  pricePaise: number;
}

export function SlotGrid({
  courtName,
  slots,
  arenaSlug,
  localDate,
}: {
  courtName: string;
  slots: GridSlot[];
  arenaSlug: string;
  /** The IST day these slots belong to — checkout re-reads them by date. */
  localDate: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  /**
   * Selection must stay one unbroken run (edge_cases.md §15).
   *
   * Rules chosen for predictability over cleverness:
   *  - Tapping an unselected slot extends the run, or starts a new one if it
   *    would leave a gap.
   *  - Tapping a selected slot drops it AND everything after it, so you can
   *    never punch a hole in the middle.
   */
  const toggle = (slot: GridSlot) => {
    if (slot.status !== 'available') return;

    setSelected((current) => {
      if (current.includes(slot.id)) {
        const cutoff = indexOfSlot(slots, slot.id);
        return current.filter((id) => indexOfSlot(slots, id) < cutoff);
      }

      const next = [...current, slot.id];
      return isContiguous(slots, next) ? next : [slot.id];
    });
  };

  const totalPaise = slots
    .filter((slot) => selected.includes(slot.id))
    .reduce((sum, slot) => sum + slot.pricePaise, 0);

  return (
    <section className="border-line-subtle border-t py-6">
      <h3 className="font-display mb-4 text-base uppercase">{courtName}</h3>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {slots.map((slot) => (
          <SlotButton
            key={slot.id}
            slot={slot}
            isSelected={selected.includes(slot.id)}
            onSelect={() => toggle(slot)}
          />
        ))}
      </div>

      <SelectionBar
        selectedIds={orderedSelection(slots, selected)}
        totalPaise={totalPaise}
        arenaSlug={arenaSlug}
        localDate={localDate}
      />
    </section>
  );
}

/** The API requires a contiguous run in start-time order; selection order is
    whatever the player tapped. Sort before sending. */
function orderedSelection(slots: GridSlot[], selectedIds: string[]): string[] {
  return [...selectedIds].sort((a, b) => indexOfSlot(slots, a) - indexOfSlot(slots, b));
}

/**
 * Four meanings, none carried by colour alone (design_system.md §2 rule 3):
 * available (surface + border), selected (volt fill), taken (struck),
 * passed (faded + label), blocked (hatched).
 */
function statusClass(status: GridSlot['status'], isSelected: boolean): string {
  if (isSelected) return 'bg-volt text-ink-inverse border-volt font-semibold';

  switch (status) {
    case 'available':
      return 'border-line bg-surface text-ink hover:border-line-strong';
    case 'booked':
    case 'held':
      return 'bg-inset border-line-subtle text-ink-muted line-through';
    /** Muted but NOT struck through — nobody booked it, the hour just went. */
    case 'past':
      return 'border-line-subtle text-ink-muted opacity-50';
    case 'blocked':
      return 'hatch border-line-subtle text-ink-muted';
  }
}

function SlotButton({
  slot,
  isSelected,
  onSelect,
}: {
  slot: GridSlot;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isBookable = slot.status === 'available';
  const isBlocked = slot.status === 'blocked';
  const isPast = slot.status === 'past';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isBookable}
      aria-pressed={isSelected}
      /** 44px floor — this is tapped one-handed, outdoors, at night. */
      className={cn(
        'rounded-control flex min-h-11 flex-col items-center justify-center border px-2 py-2 text-xs transition-colors duration-150',
        statusClass(slot.status, isSelected),
      )}
    >
      <span className="tabular">{formatTime(slot.startAt)}</span>
      {isBookable && !isSelected ? (
        <span className="tabular text-ink-muted mt-0.5 text-[10px]">
          ₹{Math.round(slot.pricePaise / 100)}
        </span>
      ) : null}
      {isBlocked ? <span className="label-caps mt-0.5 text-[9px]">Closed</span> : null}
      {isPast ? <span className="label-caps mt-0.5 text-[9px]">Passed</span> : null}
    </button>
  );
}

function indexOfSlot(slots: GridSlot[], id: string): number {
  return slots.findIndex((slot) => slot.id === id);
}

/** Selected ids must form an unbroken run in start-time order. */
function isContiguous(slots: GridSlot[], selectedIds: string[]): boolean {
  const indices = selectedIds.map((id) => indexOfSlot(slots, id)).sort((a, b) => a - b);

  return indices.every((value, position) =>
    position === 0 ? true : value === (indices[position - 1] ?? -99) + 1,
  );
}

/** Owns the hold request and where it sends you next. */
function useHold({ arenaSlug, localDate }: { arenaSlug: string; localDate: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const start = async (slotIds: string[], expectedTotalPaise: number) => {
    setPending(true);
    setError(undefined);

    const result = await holdSlotsAction({ slotIds, expectedTotalPaise });

    if (result.success && result.holdExpiresAt) {
      const query = new URLSearchParams({
        venue: arenaSlug,
        date: localDate,
        slots: slotIds.join(','),
        until: result.holdExpiresAt,
      });
      router.push(`/checkout?${query.toString()}`);
      return;
    }

    setPending(false);

    /** Not an error — they just have not signed in yet. */
    if (result.needsAuth) {
      router.push(`/login?next=${encodeURIComponent(`/arenas/${arenaSlug}`)}`);
      return;
    }

    setError(result.error ?? 'Could not hold those slots. Try again.');
    /** Someone else took a slot, or the price moved — the grid is now stale. */
    router.refresh();
  };

  return { pending, error, start };
}

/**
 * Continue takes the hold, then hands off to checkout.
 *
 * The hold happens HERE rather than on the checkout page because the copy
 * promises it ("held for 5 minutes once you continue") and because holding is
 * what stops the slot being sold to someone else while this player reads the
 * total. Checkout only confirms.
 */
function SelectionBar({
  selectedIds,
  totalPaise,
  arenaSlug,
  localDate,
}: {
  selectedIds: string[];
  totalPaise: number;
  arenaSlug: string;
  localDate: string;
}) {
  const { pending, error, start } = useHold({ arenaSlug, localDate });

  if (selectedIds.length === 0) return null;

  return (
    <div className="border-line bg-surface mt-5 border p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-ink text-sm font-medium">
            {selectedIds.length} hour{selectedIds.length === 1 ? '' : 's'} selected
          </p>
          <p className="text-ink-muted text-xs">Held for 5 minutes once you continue</p>
        </div>
        <div className="flex items-center gap-4">
          <MoneyText paise={totalPaise} className="text-lg font-semibold" />
          <Button disabled={pending} onClick={() => void start(selectedIds, totalPaise)}>
            {pending ? 'Holding…' : 'Continue'}
          </Button>
        </div>
      </div>

      {error ? <p className="text-loss mt-3 text-sm">{error}</p> : null}
    </div>
  );
}
