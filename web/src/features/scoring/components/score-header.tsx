'use client';

import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/i18n';
import type { RallyState } from '../actions';

/**
 * The umpire's header: one row per side, current score large, completed games
 * trailing to the right — the shape every scoreboard in the sport uses, so an
 * official already knows how to read it.
 */
export function ScoreHeader({
  state,
  creatorName,
  opponentName,
}: {
  state: RallyState;
  creatorName: string;
  opponentName: string;
}) {
  return (
    <div className="border-line-subtle bg-surface divide-line-subtle divide-y border">
      <SideRow
        name={creatorName}
        current={state.current.creator}
        games={state.games.map((game) => game.creator)}
        isServing={state.serving === 'creator'}
      />
      <SideRow
        name={opponentName}
        current={state.current.opponent}
        games={state.games.map((game) => game.opponent)}
        isServing={state.serving === 'opponent'}
      />
    </div>
  );
}

function SideRow({
  name,
  current,
  games,
  isServing,
}: {
  name: string;
  current: number;
  games: number[];
  isServing: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {/* Shuttle-side marker: colour AND a dot, never colour alone (§2 rule 3). */}
      <span
        className={cn('size-2.5 shrink-0 rounded-full', isServing ? 'bg-volt' : 'bg-transparent')}
        aria-label={isServing ? t('scoring.serving') : undefined}
      />
      <span className="text-ink min-w-0 flex-1 truncate text-sm font-medium">{name}</span>

      <span className="font-display tabular w-10 text-right text-2xl">{current}</span>

      {games.map((points, index) => (
        <span
          key={`g${String(index)}`}
          className="text-ink-muted tabular w-7 text-right text-sm"
        >
          {points}
        </span>
      ))}
    </div>
  );
}

/**
 * The call an umpire would say aloud, e.g. "Service over. Eight — three."
 *
 * Server's score is always announced first, which is the actual convention;
 * getting that backwards is the kind of detail a real official notices
 * immediately.
 */
export function umpireCall(state: RallyState, serviceChanged: boolean): string {
  if (state.isComplete) return t('scoring.matchComplete');

  const serverPoints =
    state.serving === 'creator' ? state.current.creator : state.current.opponent;
  const receiverPoints =
    state.serving === 'creator' ? state.current.opponent : state.current.creator;

  const score = `${String(serverPoints)}–${String(receiverPoints)}`;

  if (serverPoints === receiverPoints && serverPoints >= 20) {
    return `${t('scoring.callDeuce')} ${score}`;
  }
  if (serviceChanged) return `${t('scoring.callServiceOver')} ${score}`;
  return score;
}
