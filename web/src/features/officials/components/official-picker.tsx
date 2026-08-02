'use client';

import { useState } from 'react';
import { ShieldCheck, Star } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { MoneyText } from '@/shared/ui/money-text';
import { t } from '@/shared/i18n';
import {
  collectOfficialFeeAction,
  confirmOfficialAction,
  proposeOfficialAction,
  type OfficialSummary,
} from '../actions';

/**
 * Choosing who officiates (featuredoc/11 §OF3).
 *
 * Both captains must agree before the choice locks, so this screen shows the
 * other side's answer rather than pretending the decision is yours alone. The
 * payout-trigger status is stated on every card because it changes what
 * happens to prize money — an official who cannot settle means both captains
 * still have to confirm the result afterwards.
 */
export interface AssignmentState {
  officialId: string | null;
  canTriggerPayout: boolean;
  confirmedByCreator: boolean;
  confirmedByOpponent: boolean;
  locked: boolean;
}

export function OfficialPicker({
  matchPublicId,
  officials,
  assignment,
  chosenPublicId,
  feeCollected,
}: {
  matchPublicId: string;
  officials: OfficialSummary[];
  assignment: AssignmentState;
  chosenPublicId: string | null;
  feeCollected: boolean;
}) {
  const { pending, error, notice, run } = useAssignment();

  return (
    <div>
      <Status assignment={assignment} feeCollected={feeCollected} />

      {error ? <p className="text-loss mt-4 text-sm">{error}</p> : null}
      {notice && !error ? <p className="text-win mt-4 text-sm">{notice}</p> : null}

      {assignment.locked ? (
        <LockedActions
          matchPublicId={matchPublicId}
          feeCollected={feeCollected}
          pending={pending}
          onRun={run}
        />
      ) : null}

      <OfficialList
        officials={officials}
        chosenPublicId={chosenPublicId}
        disabled={pending !== null}
        onPropose={(officialPublicId) =>
          void run(officialPublicId, () =>
            proposeOfficialAction({ matchPublicId, officialPublicId }),
          )
        }
      />

      {chosenPublicId && !assignment.locked ? (
        <Button
          className="mt-6"
          disabled={pending !== null}
          onClick={() => void run('confirm', () => confirmOfficialAction(matchPublicId))}
        >
          {t('officials.confirmChoice')}
        </Button>
      ) : null}
    </div>
  );
}

function useAssignment() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const run = async (key: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setPending(key);
    setError(undefined);
    const result = await fn();
    setPending(null);
    if (!result.success) setError(result.error ?? t('officials.failed'));
    else setNotice(t('officials.saved'));
  };

  return { pending, error, notice, run };
}

function OfficialList({
  officials,
  chosenPublicId,
  disabled,
  onPropose,
}: {
  officials: OfficialSummary[];
  chosenPublicId: string | null;
  disabled: boolean;
  onPropose: (officialPublicId: string) => void;
}) {
  if (officials.length === 0) {
    return <p className="text-ink-muted mt-6 text-sm">{t('officials.noneAvailable')}</p>;
  }

  return (
    <ul className="mt-6 space-y-3">
      {officials.map((official) => (
        <li key={official.publicId}>
          <OfficialCard
            official={official}
            isChosen={official.publicId === chosenPublicId}
            disabled={disabled}
            onPropose={() => onPropose(official.publicId)}
          />
        </li>
      ))}
    </ul>
  );
}

function Status({
  assignment,
  feeCollected,
}: {
  assignment: AssignmentState;
  feeCollected: boolean;
}) {
  return (
    <div className="border-line-subtle bg-surface border p-4 text-sm">
      <p className="text-ink font-medium">
        {assignment.locked ? t('officials.lockedTitle') : t('officials.pendingTitle')}
      </p>
      <ul className="text-ink-secondary mt-2 space-y-1 text-xs">
        <li>
          {t('officials.creatorAnswer')}{' '}
          {assignment.confirmedByCreator ? t('officials.agreed') : t('officials.waiting')}
        </li>
        <li>
          {t('officials.opponentAnswer')}{' '}
          {assignment.confirmedByOpponent ? t('officials.agreed') : t('officials.waiting')}
        </li>
        {assignment.locked ? (
          <li>{feeCollected ? t('officials.feePaid') : t('officials.feeDue')}</li>
        ) : null}
      </ul>
    </div>
  );
}

function LockedActions({
  matchPublicId,
  feeCollected,
  pending,
  onRun,
}: {
  matchPublicId: string;
  feeCollected: boolean;
  pending: string | null;
  onRun: (key: string, fn: () => Promise<{ success: boolean; error?: string }>) => Promise<void>;
}) {
  if (feeCollected) return null;

  return (
    <Button
      className="mt-4"
      disabled={pending !== null}
      onClick={() => void onRun('fee', () => collectOfficialFeeAction(matchPublicId))}
    >
      {pending === 'fee' ? t('officials.collecting') : t('officials.collectFee')}
    </Button>
  );
}

function OfficialCard({
  official,
  isChosen,
  disabled,
  onPropose,
}: {
  official: OfficialSummary;
  isChosen: boolean;
  disabled: boolean;
  onPropose: () => void;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-4 border p-4',
        isChosen ? 'border-volt bg-volt/5' : 'border-line-subtle bg-surface',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-ink flex items-center gap-1.5 text-sm font-medium">
          {official.displayName}
          {official.canTriggerPayout ? (
            <ShieldCheck className="text-win size-4" aria-label={t('officials.canSettle')} />
          ) : null}
        </p>
        <p className="text-ink-muted mt-1 text-xs">
          {official.sports.join(', ')}
          {official.experienceYears
            ? ` · ${t('officials.years', { count: official.experienceYears })}`
            : ''}
        </p>
        {/* Stated on every card: it decides what happens to the prize money. */}
        <p className={cn('mt-1 text-xs', official.canTriggerPayout ? 'text-win' : 'text-dispute')}>
          {official.canTriggerPayout ? t('officials.canSettle') : t('officials.needsCaptains')}
        </p>
      </div>

      <PriceColumn official={official} />

      <Button variant={isChosen ? 'secondary' : 'primary'} size="sm" disabled={disabled} onClick={onPropose}>
        {isChosen ? t('officials.chosen') : t('officials.choose')}
      </Button>
    </div>
  );
}

function PriceColumn({ official }: { official: OfficialSummary }) {
  return (
    <div className="text-right">
      {official.rating.count > 0 ? (
        <p className="text-ink-secondary flex items-center justify-end gap-1 text-xs">
          <Star className="text-gold size-3 fill-current" />
          <span className="tabular">{official.rating.average.toFixed(1)}</span>
        </p>
      ) : null}
      <MoneyText paise={official.pricePerMatchPaise} className="text-sm font-semibold" />
      <p className="text-ink-muted text-xs">{t('officials.perMatch')}</p>
    </div>
  );
}
