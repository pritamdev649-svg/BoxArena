'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { t } from '@/shared/i18n';
import { acceptChallengeAction } from '../actions';

/**
 * The gate in front of accepting a money challenge (money spec MM3).
 *
 * The checkbox is mandatory and is NOT pre-ticked. It exists so that "I did
 * not realise I would lose the entry fee" is never true — a player has to
 * state, in one action, that they understood both outcomes.
 */
export function AcceptPanel({
  challengePublicId,
  teamPublicId,
}: {
  challengePublicId: string;
  teamPublicId: string | null;
}) {
  const [understood, setUnderstood] = useState(false);
  const { pending, error, done, accept } = useAccept(challengePublicId, teamPublicId);

  if (done) {
    return (
      <p className="border-win/40 bg-win/10 text-win rounded-control border p-4 text-sm font-medium">
        {t('challengeMoney.accept')} ✓
      </p>
    );
  }

  return (
    <div className="border-line bg-surface border p-5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={understood}
          onChange={(event) => setUnderstood(event.target.checked)}
          className="accent-volt mt-0.5 size-4 shrink-0"
        />
        <span className="text-ink-secondary text-sm">{t('challengeMoney.confirmLabel')}</span>
      </label>

      {error ? <p className="text-loss mt-4 text-sm">{error}</p> : null}

      <Button
        size="lg"
        className="mt-5"
        /** Unticked box, or no team to enter — either way this cannot proceed. */
        disabled={!understood || pending || !teamPublicId}
        onClick={() => void accept()}
      >
        {pending ? t('challengeMoney.accepting') : t('challengeMoney.accept')}
      </Button>
    </div>
  );
}

function useAccept(challengePublicId: string, teamPublicId: string | null) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const accept = async () => {
    if (!teamPublicId) return;
    setPending(true);
    setError(undefined);

    const result = await acceptChallengeAction({ challengePublicId, teamId: teamPublicId });

    setPending(false);
    if (!result.success) {
      setError(result.error ?? t('challengeMoney.acceptFailed'));
      return;
    }
    setDone(true);
  };

  return { pending, error, done, accept };
}
