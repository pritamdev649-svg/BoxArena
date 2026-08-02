'use client';

import { useState } from 'react';
import { RotateCcw, Timer } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { t } from '@/shared/i18n';
import {
  recordEventAction,
  recordPointAction,
  startMatchAction,
  undoPointAction,
  type PointOutcome,
  type RallyState,
  type ScoringResult,
} from '../actions';
import { MatchClock } from './match-clock';
import { CourtView } from './court-view';
import { ScoreHeader, umpireCall } from './score-header';
import { PointZones } from './point-zones';
import { CompletePanel, StartPanel } from './panels';

/**
 * The official's scoreboard.
 *
 * Laid out the way a real umpire's app is: score header, the call, the court
 * with the server's position, then the two scoring halves. State comes back
 * from the server on every command — the rules live in exactly one place
 * (badminton-engine.ts) and this screen renders what it is told.
 */
export interface ScoreboardProps {
  matchPublicId: string;
  creatorNames: string[];
  opponentNames: string[];
  initialState: RallyState;
  status: string;
  startedAt?: string | undefined;
  canConfirm: boolean;
}

/** Owns the request cycle so the components themselves stay markup. */
function useScoring(initial: RallyState) {
  const [state, setState] = useState<RallyState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const run = async (fn: () => Promise<ScoringResult>) => {
    setBusy(true);
    setError(undefined);
    const result = await fn();
    setBusy(false);

    if (!result.success) {
      setError(result.error ?? t('scoring.failed'));
      return;
    }
    if (result.state) setState(result.state);
    setNotice(result.changeEnds ? t('scoring.changeEnds') : undefined);
  };

  return { state, setState, busy, setBusy, error, setError, notice, run };
}

export function Scoreboard(props: ScoreboardProps) {
  const scoring = useScoring(props.initialState);
  const [started, setStarted] = useState(props.status !== 'scheduled');

  const start = () => {
    scoring.setBusy(true);
    void startMatchAction(props.matchPublicId)
      .then((result) => {
        if (!result.success) {
          scoring.setError(result.error ?? t('scoring.failed'));
          return;
        }
        if (result.state) scoring.setState(result.state);
        setStarted(true);
      })
      .finally(() => scoring.setBusy(false));
  };

  if (!started) {
    return <StartPanel busy={scoring.busy} error={scoring.error} onStart={start} />;
  }

  return <LiveBody props={props} scoring={scoring} />;
}

function LiveBody({
  props,
  scoring,
}: {
  props: ScoreboardProps;
  scoring: ReturnType<typeof useScoring>;
}) {
  const [outcome, setOutcome] = useState<PointOutcome | undefined>();
  const score = usePointTap({ matchPublicId: props.matchPublicId, scoring, outcome, setOutcome });

  const undo = () =>
    void scoring.run(() =>
      undoPointAction({
        matchPublicId: props.matchPublicId,
        idempotencyKey: crypto.randomUUID(),
      }),
    );

  const creatorLabel = props.creatorNames.join(' / ');
  const opponentLabel = props.opponentNames.join(' / ');

  return (
    <div className="flex min-h-[80vh] flex-col gap-2">
      <TopBar props={props} scoring={scoring} creatorLabel={creatorLabel} opponentLabel={opponentLabel} />

      {scoring.state.isComplete ? (
        <CompletePanel
          state={scoring.state}
          creatorName={creatorLabel}
          opponentName={opponentLabel}
          canConfirm={props.canConfirm}
          matchPublicId={props.matchPublicId}
        />
      ) : (
        <PlayArea
          props={props}
          scoring={scoring}
          outcome={outcome}
          onOutcome={setOutcome}
          onPoint={score}
        />
      )}

      <SecondaryControls busy={scoring.busy} matchPublicId={props.matchPublicId} onUndo={undo} />
    </div>
  );
}

/**
 * One tap = one rally, with the optional outcome tag attached and then
 * cleared. The tag is never sticky — see OutcomeTags.
 */
function usePointTap(input: {
  matchPublicId: string;
  scoring: ReturnType<typeof useScoring>;
  outcome: PointOutcome | undefined;
  setOutcome: (next: PointOutcome | undefined) => void;
}) {
  const { matchPublicId, scoring, outcome, setOutcome } = input;
  return (side: 'creator' | 'opponent') => {
    void scoring.run(() =>
      recordPointAction({
        matchPublicId,
        side,
        /** Fresh key per tap, so a retry is a no-op not a phantom point. */
        idempotencyKey: crypto.randomUUID(),
        ...(outcome ? { outcome } : {}),
      }),
    );
    setOutcome(undefined);
  };
}

/** Clock, score rows and the umpire's call. */
function TopBar({
  props,
  scoring,
  creatorLabel,
  opponentLabel,
}: {
  props: ScoreboardProps;
  scoring: ReturnType<typeof useScoring>;
  creatorLabel: string;
  opponentLabel: string;
}) {
  return (
    <>
      <MatchClock startedAt={props.startedAt} />
      <ScoreHeader state={scoring.state} creatorName={creatorLabel} opponentName={opponentLabel} />
      <p className="bg-volt text-ink-inverse self-start px-2 py-1 text-xs font-semibold">
        {umpireCall(scoring.state, false)}
      </p>
      <Banners notice={scoring.notice} error={scoring.error} />
    </>
  );
}

function PlayArea({
  props,
  scoring,
  outcome,
  onOutcome,
  onPoint,
}: {
  props: ScoreboardProps;
  scoring: ReturnType<typeof useScoring>;
  outcome: PointOutcome | undefined;
  onOutcome: (next: PointOutcome | undefined) => void;
  onPoint: (side: 'creator' | 'opponent') => void;
}) {
  return (
    <>
      <CourtView
        state={scoring.state}
        creatorNames={props.creatorNames}
        opponentNames={props.opponentNames}
      />
      <OutcomeTags selected={outcome} onSelect={onOutcome} />
      <PointZones
        state={scoring.state}
        creatorName={props.creatorNames.join(' / ')}
        opponentName={props.opponentNames.join(' / ')}
        disabled={scoring.busy}
        onPoint={onPoint}
      />
    </>
  );
}

/**
 * Optional colour on the next rally.
 *
 * Deliberately a one-shot tag rather than a mode: an umpire who left "winner"
 * switched on would silently mis-attribute every following point, and nobody
 * would notice until the statistics looked absurd.
 */
function OutcomeTags({
  selected,
  onSelect,
}: {
  selected: PointOutcome | undefined;
  onSelect: (next: PointOutcome | undefined) => void;
}) {
  const options: { value: PointOutcome; label: string }[] = [
    { value: 'winner', label: t('scoring.outcomeWinner') },
    { value: 'unforced_error', label: t('scoring.outcomeError') },
    { value: 'service_fault', label: t('scoring.outcomeFault') },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-ink-muted text-xs">{t('scoring.outcomeHint')}</span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(selected === option.value ? undefined : option.value)}
          aria-pressed={selected === option.value}
          className={
            selected === option.value
              ? 'bg-volt text-ink-inverse rounded-chip px-2.5 py-1 text-xs font-medium'
              : 'border-line text-ink-secondary hover:border-line-strong rounded-chip border px-2.5 py-1 text-xs'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SecondaryControls({
  busy,
  matchPublicId,
  onUndo,
}: {
  busy: boolean;
  matchPublicId: string;
  onUndo: () => void;
}) {
  const [timeoutBusy, setTimeoutBusy] = useState(false);

  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="lg" disabled={busy} onClick={onUndo} className="flex-1">
        <RotateCcw className="size-4" /> {t('scoring.undo')}
      </Button>
      <Button
        variant="secondary"
        size="lg"
        disabled={timeoutBusy}
        className="flex-1"
        onClick={() => {
          setTimeoutBusy(true);
          void recordEventAction({ matchPublicId, eventType: 'timeout' }).finally(() =>
            setTimeoutBusy(false),
          );
        }}
      >
        <Timer className="size-4" /> {t('scoring.timeout')}
      </Button>
    </div>
  );
}

/** Ends-change prompt and the last failure, in that priority. */
function Banners({ notice, error }: { notice?: string | undefined; error?: string | undefined }) {
  return (
    <>
      {notice ? (
        <p className="border-volt bg-volt/10 text-volt-ink rounded-control border p-3 text-center text-sm font-medium">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="border-loss/40 bg-loss/10 text-loss rounded-control border p-3 text-sm">
          {error}
        </p>
      ) : null}
    </>
  );
}
