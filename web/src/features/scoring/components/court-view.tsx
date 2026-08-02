'use client';

import { cn } from '@/shared/lib/cn';
import type { RallyState } from '../actions';

/**
 * The court, drawn from above, with the server's position marked.
 *
 * This is the one part of the screen an umpire checks against reality: if the
 * diagram says right-hand court and the player is standing left, someone has
 * mis-tapped. So it is derived from the score every render (server's own score
 * even → right, odd → left) rather than tracked — a corrected score can never
 * leave the diagram lying.
 *
 * In doubles the near/far halves each hold two players and the pair swaps
 * courts only when it wins a point on its own serve; `state.doubles` carries
 * which player is currently on the right.
 */
export function CourtView({
  state,
  creatorNames,
  opponentNames,
}: {
  state: RallyState;
  creatorNames: string[];
  opponentNames: string[];
}) {
  const isDoubles = state.doubles !== null;

  return (
    <div className="border-line-subtle bg-inset relative border">
      {/* 2 : 1 is close enough to a badminton court seen end-on to read right. */}
      <div className="grid aspect-[2/1] grid-rows-2">
        <CourtHalf
          names={opponentNames}
          isServingSide={state.serving === 'opponent'}
          serveCourt={state.serveCourt}
          rightIndex={state.doubles?.opponentRightIndex ?? 0}
          isDoubles={isDoubles}
          isFar
        />
        <CourtHalf
          names={creatorNames}
          isServingSide={state.serving === 'creator'}
          serveCourt={state.serveCourt}
          rightIndex={state.doubles?.creatorRightIndex ?? 0}
          isDoubles={isDoubles}
        />
      </div>

      {/* The net. */}
      <div className="border-line-strong absolute inset-x-0 top-1/2 border-t-2" aria-hidden />
    </div>
  );
}

/** Singles has one occupant; in doubles the partner holds the other court. */
function occupantIndexFor(court: 'right' | 'left', rightIndex: number, isDoubles: boolean): number {
  if (!isDoubles) return 0;
  return court === 'right' ? rightIndex : 1 - rightIndex;
}

function CourtHalf({
  names,
  isServingSide,
  serveCourt,
  rightIndex,
  isDoubles,
  isFar,
}: {
  names: string[];
  isServingSide: boolean;
  serveCourt: 'right' | 'left';
  rightIndex: number;
  isDoubles: boolean;
  isFar?: boolean;
}) {
  /**
   * "Right" is from the player's own point of view, so the far side's right is
   * the viewer's left. Mirroring here is what makes the diagram match what the
   * umpire actually sees from the chair.
   */
  const cells: ('right' | 'left')[] = isFar ? ['left', 'right'] : ['right', 'left'];

  return (
    <div className="border-line-subtle grid grid-cols-2 divide-x divide-[color:var(--color-line-subtle)]">
      {cells.map((court) => {
        const occupant = names[occupantIndexFor(court, rightIndex, isDoubles)] ?? '';
        const isServer = isServingSide && serveCourt === court;

        return (
          <div
            key={court}
            className={cn(
              'flex flex-col items-center justify-center gap-1 p-2 text-center transition-colors duration-150',
              isServer && 'bg-volt/10',
            )}
          >
            <span className="text-ink-secondary truncate text-xs">{occupant}</span>
            {isServer ? (
              <span className="bg-volt size-2.5 rounded-full" aria-label="Serving from here" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
