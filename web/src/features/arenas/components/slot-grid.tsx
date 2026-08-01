'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { MoneyText } from '@/shared/ui/money-text';
import { Button } from '@/shared/ui/button';
import { formatTime } from '@/shared/lib/datetime';

/**
 * Slot grid (task F2.4) — the awkward-state screen.
 *
 * Four states carry meaning, and none rely on colour alone (design_system.md
 * §2 rule 3): available (surface + border), selected (volt fill), booked
 * (inset, struck), blocked (diagonal hatch).
 *
 * Multi-hour selection must be CONTIGUOUS on one court — the backend rejects
 * gaps, so the UI must not let you build one (edge_cases.md §15).
 */

export interface GridSlot {
  id: string;
  startAt: string;
  endAt: string;
  status: 'available' | 'booked' | 'blocked' | 'held';
  pricePaise: number;
}

export function SlotGrid({
  courtName,
  slots,
}: {
  courtName: string;
  slots: GridSlot[];
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

      <SelectionBar count={selected.length} totalPaise={totalPaise} />
    </section>
  );
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

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isBookable}
      aria-pressed={isSelected}
      /** 44px floor — this is tapped one-handed, outdoors, at night. */
      className={cn(
        'rounded-control flex min-h-11 flex-col items-center justify-center border px-2 py-2 text-xs transition-colors duration-150',
        isSelected && 'bg-volt text-ink-inverse border-volt font-semibold',
        !isSelected && isBookable && 'border-line bg-surface text-ink hover:border-line-strong',
        slot.status === 'booked' && 'bg-inset border-line-subtle text-ink-muted line-through',
        slot.status === 'held' && 'bg-inset border-line-subtle text-ink-muted line-through',
        isBlocked && 'hatch border-line-subtle text-ink-muted',
      )}
    >
      <span className="tabular">{formatTime(slot.startAt)}</span>
      {isBookable && !isSelected ? (
        <span className="tabular text-ink-muted mt-0.5 text-[10px]">
          ₹{Math.round(slot.pricePaise / 100)}
        </span>
      ) : null}
      {isBlocked ? <span className="label-caps mt-0.5 text-[9px]">Closed</span> : null}
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

function SelectionBar({ count, totalPaise }: { count: number; totalPaise: number }) {
  if (count === 0) return null;

  return (
    <div className="border-line bg-surface mt-5 flex flex-wrap items-center justify-between gap-4 border p-4">
      <div>
        <p className="text-ink text-sm font-medium">
          {count} hour{count === 1 ? '' : 's'} selected
        </p>
        <p className="text-ink-muted text-xs">Held for 5 minutes once you continue</p>
      </div>
      <div className="flex items-center gap-4">
        <MoneyText paise={totalPaise} className="text-lg font-semibold" />
        <Button>Continue</Button>
      </div>
    </div>
  );
}
