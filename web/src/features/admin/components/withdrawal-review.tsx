'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { reviewWithdrawalAction } from '../withdrawal-actions';

/**
 * The approve/reject control on one queued withdrawal.
 *
 * Rejecting opens a reason field first rather than firing immediately — this
 * is the only text the player ever sees explaining why their money came back,
 * and a blank one is worse than no rejection at all.
 */
export function WithdrawalReview({ publicId }: { publicId: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const decide = async (decision: 'approve' | 'reject') => {
    setPending(true);
    setError(undefined);
    const result = await reviewWithdrawalAction(publicId, decision, reason.trim() || undefined);
    setPending(false);
    if (!result.success) setError(result.error);
  };

  if (rejecting) {
    return (
      <RejectForm
        reason={reason}
        onReason={setReason}
        state={{ pending, error }}
        onConfirm={() => void decide('reject')}
        onCancel={() => setRejecting(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" disabled={pending} onClick={() => void decide('approve')}>
        {pending ? 'Working…' : 'Approve'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setRejecting(true)}>
        Reject
      </Button>
      {error ? <p className="text-loss text-xs">{error}</p> : null}
    </div>
  );
}

function RejectForm({
  reason,
  onReason,
  state,
  onConfirm,
  onCancel,
}: {
  reason: string;
  onReason: (next: string) => void;
  state: { pending: boolean; error: string | undefined };
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="min-w-56">
      <Input
        label="Reason the player will see"
        value={reason}
        onChange={(event) => onReason(event.target.value)}
        maxLength={500}
        autoFocus
      />
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="danger"
          disabled={state.pending || !reason.trim()}
          onClick={onConfirm}
        >
          {state.pending ? 'Rejecting…' : 'Confirm reject'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {state.error ? <p className="text-loss mt-2 text-xs">{state.error}</p> : null}
    </div>
  );
}
