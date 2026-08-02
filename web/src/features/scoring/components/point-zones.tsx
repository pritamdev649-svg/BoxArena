'use client';

import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';
import type { RallyState } from '../actions';

/**
 * Deliberately the biggest thing on screen. One tap = one rally.
 *
 * Full-height halves because this is operated one-handed, outdoors, at night —
 * a mis-tap is the one error the layout has to make hard.
 */
function PointZone({
  label,
  points,
  isServing,
  disabled,
  onTap,
}: {
  label: string;
  points: number;
  isServing: boolean;
  disabled: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center gap-2 border p-6 transition-colors duration-150',
        'active:bg-volt active:text-ink-inverse disabled:opacity-60',
        isServing ? 'border-volt bg-volt/5' : 'border-line bg-surface',
      )}
    >
      <span className="text-ink-secondary truncate text-sm font-medium">{label}</span>
      <span className="font-display tabular text-6xl">{points}</span>
      {/* Never colour alone — the serving side is also labelled (§2 rule 3). */}
      <span className={cn('label-caps text-volt-ink', isServing ? '' : 'opacity-0')}>
        {t('scoring.serving')}
      </span>
    </button>
  );
}

export function PointZones({
  state,
  creatorName,
  opponentName,
  disabled,
  onPoint,
}: {
  state: RallyState;
  creatorName: string;
  opponentName: string;
  disabled: boolean;
  onPoint: (side: 'creator' | 'opponent') => void;
}) {
  return (
    <div className="grid flex-1 grid-cols-2 gap-3">
      <PointZone
        label={creatorName}
        points={state.current.creator}
        isServing={state.serving === 'creator'}
        disabled={disabled}
        onTap={() => onPoint('creator')}
      />
      <PointZone
        label={opponentName}
        points={state.current.opponent}
        isServing={state.serving === 'opponent'}
        disabled={disabled}
        onTap={() => onPoint('opponent')}
      />
    </div>
  );
}
