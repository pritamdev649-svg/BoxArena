'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { saveStepAction, submitApplicationAction, type ApplicationSnapshot } from '../actions';
import { StepVenue, StepLocation } from './step-basics';
import { StepCourts, StepHours } from './step-courts';
import { StepPolicy, StepPayout } from './step-terms';

/**
 * The 7-step venue onboarding wizard (F4.2).
 *
 * Resumable by construction: each step PATCHes on its own and the server
 * tracks `currentStep`, so closing the tab loses at most the step in progress.
 * The owner is assumed to be on a mid-range Android on 4G, standing in a turf
 * office, being interrupted.
 *
 * Step 5 (pricing bands) is deliberately skippable — the base per-hour price
 * set on each court in step 3 already produces a working price for every slot,
 * and bands are an optimisation an owner can add later from the panel.
 */
const STEPS = [
  'Venue',
  'Location',
  'Courts',
  'Hours',
  'Pricing',
  'Policy',
  'Payout',
] as const;

function useWizard(startAt: number) {
  /** Resume where they left off, never past the end. */
  const [step, setStep] = useState(Math.min(startAt || 1, STEPS.length));
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const save = async (data: unknown) => {
    setPending(true);
    setError(undefined);
    const result = await saveStepAction(step, data);
    setPending(false);

    if (!result.success) {
      setError(result.error);
      return;
    }
    if (step < STEPS.length) setStep(step + 1);
  };

  const submit = async () => {
    setPending(true);
    setError(undefined);
    const result = await submitApplicationAction();
    setPending(false);
    if (result.success) setSubmitted(true);
    else setError(result.error);
  };

  return { step, setStep, error, pending, submitted, save, submit };
}

export function OnboardingWizard({ application }: { application: ApplicationSnapshot }) {
  const { step, setStep, error, pending, submitted, save, submit } = useWizard(
    application.currentStep,
  );

  if (submitted) return <Submitted />;

  return (
    <div>
      <StepRail current={step} onJump={setStep} furthest={application.currentStep || 1} />

      <div className="border-line bg-surface mt-6 border p-6">
        <StepBody
          step={step}
          application={application}
          pending={pending}
          onSave={(data) => void save(data)}
        />

        {error ? (
          <p className="border-loss/40 bg-loss/10 text-loss mt-4 border p-3 text-sm">{error}</p>
        ) : null}
      </div>

      {step === STEPS.length ? (
        <div className="mt-6">
          <p className="text-ink-secondary mb-3 text-sm">
            Once you submit, our team verifies your venue &mdash; a call, a look at the pin
            against satellite, and a site visit. You&rsquo;ll hear from us within two working days.
          </p>
          <Button disabled={pending} onClick={() => void submit()}>
            {pending ? 'Submitting…' : 'Submit for verification'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StepBody({
  step,
  application,
  pending,
  onSave,
}: {
  step: number;
  application: ApplicationSnapshot;
  pending: boolean;
  onSave: (data: unknown) => void;
}) {
  const props = { application, pending, onSave };

  switch (step) {
    case 1:
      return <StepVenue {...props} />;
    case 2:
      return <StepLocation {...props} />;
    case 3:
      return <StepCourts {...props} />;
    case 4:
      return <StepHours {...props} />;
    case 5:
      return <StepPricing {...props} />;
    case 6:
      return <StepPolicy {...props} />;
    default:
      return <StepPayout {...props} />;
  }
}

/**
 * Pricing bands, skippable.
 *
 * Shown rather than hidden so the owner knows the capability exists, but not
 * made a blocker: a venue with a base price per court is fully bookable, and
 * making people build a weekday/weekend/holiday matrix before they can go live
 * is where onboarding dies.
 */
function StepPricing({ pending, onSave }: { pending: boolean; onSave: (data: unknown) => void }) {
  return (
    <div>
      <h2 className="font-display text-lg uppercase">Pricing bands</h2>
      <p className="text-ink-secondary mt-2 text-sm">
        Each court already has a base price per hour from the last step, and that is what every
        slot will cost. Peak, off-peak and weekend bands are worth setting up &mdash; morning and
        late-evening slots usually carry a premium, and the empty 9&ndash;4 window is what a
        discount fills &mdash; but you can do that from your panel once you&rsquo;re live.
      </p>
      <Button className="mt-6" disabled={pending} onClick={() => onSave([])}>
        {pending ? 'Saving…' : 'Skip for now'}
      </Button>
    </div>
  );
}

function StepRail({
  current,
  furthest,
  onJump,
}: {
  current: number;
  furthest: number;
  onJump: (step: number) => void;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STEPS.map((label, index) => {
        const number = index + 1;
        const done = number < furthest;
        const active = number === current;
        /** Only backwards — jumping ahead would skip validation the API runs. */
        const reachable = number <= furthest;

        return (
          <li key={label}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onJump(number)}
              className={rail(active, reachable)}
            >
              {done ? <Check className="size-3" /> : <span className="tabular">{number}</span>}
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function rail(active: boolean, reachable: boolean): string {
  const base =
    'rounded-chip flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition';
  if (active) return `${base} border-volt bg-volt/10 text-ink`;
  if (reachable) return `${base} border-line text-ink-secondary hover:border-line-strong`;
  return `${base} border-line-subtle text-ink-muted cursor-not-allowed`;
}

function Submitted() {
  return (
    <div className="border-win/40 bg-win/10 border p-6">
      <h2 className="font-display text-lg uppercase">Submitted</h2>
      <p className="text-ink-secondary mt-2 text-sm">
        Your venue is with our team. We verify every listing before it goes live &mdash; we check
        the pin against satellite view, confirm the court count, and match your bank details to
        your PAN. Expect a call within two working days.
      </p>
    </div>
  );
}
