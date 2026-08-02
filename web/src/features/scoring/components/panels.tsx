'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { t } from '@/shared/i18n';
import { confirmResultAction, type RallyState } from '../actions';

/** Pre-match: the only thing on screen is the one action available. */
export function StartPanel({
  busy,
  error,
  onStart,
}: {
  busy: boolean;
  error: string | undefined;
  onStart: () => void;
}) {
  return (
    <div className="border-line bg-surface flex min-h-[50vh] flex-col items-center justify-center gap-4 border p-8 text-center">
      <p className="text-ink-secondary text-sm">{t('scoring.startHint')}</p>
      {error ? <p className="text-loss text-sm">{error}</p> : null}
      <Button size="lg" disabled={busy} onClick={onStart}>
        {busy ? t('scoring.starting') : t('scoring.startMatch')}
      </Button>
    </div>
  );
}

function gamesTally(state: RallyState) {
  return state.games.reduce(
    (tally, game) => {
      if (game.creator > game.opponent) tally.creator += 1;
      else tally.opponent += 1;
      return tally;
    },
    { creator: 0, opponent: 0 },
  );
}

/**
 * Post-match sign-off.
 *
 * The confirm button is where the money decision happens, so the outcome text
 * afterwards is explicit about whether anyone has actually been paid — an
 * official who cannot trigger payout must not walk away thinking they have
 * settled the match.
 */
export interface CompletePanelProps {
  state: RallyState;
  creatorName: string;
  opponentName: string;
  canConfirm: boolean;
  matchPublicId: string;
}

export function CompletePanel({
  state,
  creatorName,
  opponentName,
  canConfirm,
  matchPublicId,
}: CompletePanelProps) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string>();
  const [error, setError] = useState<string>();

  const tally = gamesTally(state);
  const winnerName = state.winner === 'creator' ? creatorName : opponentName;

  const confirm = async () => {
    setBusy(true);
    const result = await confirmResultAction(matchPublicId);
    setBusy(false);

    if (!result.success) {
      setError(result.error ?? t('scoring.failed'));
      return;
    }
    setDone(result.settled ? t('scoring.settled') : t('scoring.awaitingCaptains'));
  };

  if (done) return <Outcome message={done} />;

  return (
    <div className="border-line bg-surface flex flex-1 flex-col items-center justify-center gap-3 border p-6 text-center">
      <p className="label-caps text-ink-muted">{t('scoring.matchComplete')}</p>
      <p className="font-display text-display-md uppercase">{winnerName}</p>
      <p className="tabular text-ink-secondary">
        {tally.creator}–{tally.opponent}
      </p>

      {error ? <p className="text-loss text-sm">{error}</p> : null}

      {canConfirm ? (
        <Button size="lg" disabled={busy} className="mt-2 w-full" onClick={() => void confirm()}>
          <Check className="size-4" />
          {busy ? t('scoring.confirming') : t('scoring.confirmResult')}
        </Button>
      ) : (
        <p className="text-ink-muted text-sm">{t('scoring.notYourMatch')}</p>
      )}
    </div>
  );
}

function Outcome({ message }: { message: string }) {
  return (
    <div className="border-win/40 bg-win/10 rounded-control flex-1 border p-6 text-center">
      <p className="text-win font-medium">{message}</p>
    </div>
  );
}
