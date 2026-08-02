'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { t } from '@/shared/i18n';
import { confirmResultAction } from '../actions';

/**
 * A captain's answer to a result somebody else recorded.
 *
 * Only shown when the official could NOT trigger payout — a team's own person
 * officiated, so their scorecard is on the record but the money still waits on
 * both captains (games_rule/badminton.md §6).
 *
 * Disagreeing is a first-class action, not a hidden link: a captain who thinks
 * the score is wrong needs an obvious route that is not "do nothing and hope".
 */
export function ConfirmResultPanel({
  matchPublicId,
  summary,
}: {
  matchPublicId: string;
  summary: string;
}) {
  const { pending, error, done, answer } = useAnswer(matchPublicId);

  if (done) {
    return (
      <div className="border-line bg-surface rounded-control border p-5 text-center">
        <p className="text-ink font-medium">{done}</p>
      </div>
    );
  }

  return (
    <div className="border-line bg-surface border p-5">
      <p className="label-caps text-ink-muted">{t('officials.confirmHeading')}</p>
      <p className="font-display mt-2 text-xl uppercase">{summary}</p>
      <p className="text-ink-secondary mt-3 text-sm">{t('officials.confirmBody')}</p>

      {error ? <p className="text-loss mt-4 text-sm">{error}</p> : null}

      <Answers pending={pending} onAnswer={answer} />
      <p className="text-ink-muted mt-3 text-xs">{t('officials.disputeHint')}</p>
    </div>
  );
}

/** Agreeing and contesting are equally prominent — see the component note. */
function Answers({
  pending,
  onAnswer,
}: {
  pending: 'agree' | 'dispute' | null;
  onAnswer: (agree: boolean) => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap gap-3">
      <Button size="lg" disabled={pending !== null} onClick={() => onAnswer(true)}>
        <Check className="size-4" />
        {pending === 'agree' ? t('officials.sending') : t('officials.agree')}
      </Button>
      <Button
        size="lg"
        variant="secondary"
        disabled={pending !== null}
        onClick={() => onAnswer(false)}
      >
        <X className="size-4" />
        {pending === 'dispute' ? t('officials.sending') : t('officials.disagree')}
      </Button>
    </div>
  );
}

function useAnswer(matchPublicId: string) {
  const [pending, setPending] = useState<'agree' | 'dispute' | null>(null);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const answer = async (agree: boolean) => {
    setPending(agree ? 'agree' : 'dispute');
    setError(undefined);

    const result = await confirmResultAction({ matchPublicId, agree });
    setPending(null);

    if (!result.success) {
      setError(result.error ?? t('officials.failed'));
      return;
    }
    if (result.disputed) {
      setDone(t('officials.disputed'));
      return;
    }
    setDone(result.settled ? t('officials.settled') : t('officials.awaitingOther'));
  };

  return { pending, error, done, answer };
}
