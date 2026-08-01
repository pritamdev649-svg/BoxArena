'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { MoneyText } from '@/shared/ui/money-text';
import { formatCountdown, secondsUntil } from '@/shared/lib/datetime';
import { t } from '@/shared/i18n';
import { confirmBookingAction } from '../actions';

/**
 * The confirm half of checkout.
 *
 * The hold is already taken by the time this renders — Continue on the venue
 * page did that — so the only jobs here are: show how long it lasts, let the
 * player choose how to pay where the venue allows it, and confirm exactly once.
 *
 * The countdown is honest about what it is. It is a display of the expiry the
 * hold API returned; the server re-checks the real hold on confirm, so a
 * tampered clock buys nothing (booking.service.ts assertHoldStillValid).
 */
export interface CheckoutPanelProps {
  slotIds: string[];
  totalPaise: number;
  /** ISO instant the hold lapses, as returned by the hold API. */
  holdExpiresAt: string;
  arenaSlug: string;
  payAtVenueAllowed: boolean;
  depositPercent: number;
  spendablePaise: number;
}

export function CheckoutPanel({
  slotIds,
  totalPaise,
  holdExpiresAt,
  arenaSlug,
  payAtVenueAllowed,
  depositPercent,
  spendablePaise,
}: CheckoutPanelProps) {
  const [payAtVenue, setPayAtVenue] = useState(false);
  const secondsLeft = useCountdown(holdExpiresAt);
  const { pending, error, confirm } = useConfirm({ slotIds, arenaSlug });

  const chargeNowPaise = payAtVenue
    ? Math.floor((totalPaise * depositPercent) / 100)
    : totalPaise;
  const shortfall = chargeNowPaise - spendablePaise;

  if (secondsLeft <= 0) return <HoldExpired arenaSlug={arenaSlug} />;

  return (
    <div className="border-line bg-surface border p-5">
      <HoldTimer secondsLeft={secondsLeft} />

      {payAtVenueAllowed ? (
        <PaymentChoice
          payAtVenue={payAtVenue}
          onChange={setPayAtVenue}
          depositPercent={depositPercent}
        />
      ) : null}

      <Totals
        chargeNowPaise={chargeNowPaise}
        dueAtGatePaise={payAtVenue ? totalPaise - chargeNowPaise : 0}
        spendablePaise={spendablePaise}
        shortfall={shortfall}
      />

      {error ? <p className="text-loss mt-4 text-sm">{error}</p> : null}

      <Button
        size="lg"
        fullWidth
        className="mt-5"
        disabled={pending || shortfall > 0}
        onClick={() => void confirm(payAtVenue)}
      >
        {pending ? t('checkout.confirming') : t('checkout.confirm')}
      </Button>

      <p className="text-ink-muted mt-3 text-center text-xs">{t('checkout.releaseNote')}</p>
    </div>
  );
}

/** Owns the confirm request, including the key that makes it safe to retry. */
function useConfirm({ slotIds, arenaSlug }: { slotIds: string[]; arenaSlug: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  /**
   * One key per mounted checkout, so tapping Confirm twice — or retrying after
   * a timeout that actually succeeded — returns the first booking rather than
   * charging the wallet a second time.
   */
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);

  const confirm = async (isPayAtVenue: boolean) => {
    setPending(true);
    setError(undefined);

    const result = await confirmBookingAction({ slotIds, isPayAtVenue, idempotencyKey });

    if (result.success && result.bookingPublicId) {
      router.push(`/bookings/${result.bookingPublicId}`);
      return;
    }

    setPending(false);
    if (result.needsAuth) {
      router.push(`/login?next=${encodeURIComponent(`/arenas/${arenaSlug}`)}`);
      return;
    }
    setError(result.error ?? t('checkout.failed'));
  };

  return { pending, error, confirm };
}

function Totals({
  chargeNowPaise,
  dueAtGatePaise,
  spendablePaise,
  shortfall,
}: {
  chargeNowPaise: number;
  dueAtGatePaise: number;
  spendablePaise: number;
  shortfall: number;
}) {
  return (
    <>
      <dl className="border-line-subtle mt-5 space-y-2 border-t pt-4 text-sm">
        <Line label={t('checkout.payNow')} paise={chargeNowPaise} strong />
        {dueAtGatePaise > 0 ? <Line label={t('checkout.payAtGate')} paise={dueAtGatePaise} /> : null}
        <Line label={t('checkout.walletBalance')} paise={spendablePaise} />
      </dl>

      {shortfall > 0 ? (
        <p className="border-loss/40 bg-loss/10 text-loss rounded-control mt-4 border p-3 text-sm">
          {t('checkout.shortfall')} <MoneyText paise={shortfall} className="font-semibold" />
        </p>
      ) : null}
    </>
  );
}

/** Ticks once a second against the real clock, not a decrementing counter —
    a backgrounded tab freezes timers and would otherwise over-report time. */
function useCountdown(until: string): number {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(until));

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft(secondsUntil(until)), 1000);
    return () => clearInterval(timer);
  }, [until]);

  return secondsLeft;
}

function HoldTimer({ secondsLeft }: { secondsLeft: number }) {
  /** Under a minute the hold is genuinely about to go — say so in colour. */
  const urgent = secondsLeft <= 60;

  return (
    <p
      className={cn(
        'flex items-center gap-2 text-sm',
        urgent ? 'text-loss' : 'text-ink-secondary',
      )}
    >
      <Clock className="size-4" />
      {t('checkout.heldFor')}
      <span className="tabular font-semibold">{formatCountdown(secondsLeft)}</span>
    </p>
  );
}

function PaymentChoice({
  payAtVenue,
  onChange,
  depositPercent,
}: {
  payAtVenue: boolean;
  onChange: (next: boolean) => void;
  depositPercent: number;
}) {
  return (
    <fieldset className="mt-5">
      <legend className="label-caps text-ink-muted mb-2">{t('checkout.paymentHeading')}</legend>
      <div className="space-y-2">
        <PaymentOption
          selected={!payAtVenue}
          onSelect={() => onChange(false)}
          label={t('checkout.payFullLabel')}
          hint={t('checkout.payFullHint')}
        />
        <PaymentOption
          selected={payAtVenue}
          onSelect={() => onChange(true)}
          label={t('checkout.payDepositLabel', { count: depositPercent })}
          hint={t('checkout.payDepositHint')}
        />
      </div>
    </fieldset>
  );
}

function PaymentOption({
  selected,
  onSelect,
  label,
  hint,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-control block w-full border p-3 text-left transition-colors duration-150',
        selected ? 'border-volt bg-volt/5' : 'border-line hover:border-line-strong',
      )}
    >
      <span className="text-ink block text-sm font-medium">{label}</span>
      <span className="text-ink-muted block text-xs">{hint}</span>
    </button>
  );
}

function Line({ label, paise, strong }: { label: string; paise: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={strong ? 'text-ink font-medium' : 'text-ink-secondary'}>{label}</dt>
      <dd>
        <MoneyText paise={paise} className={strong ? 'font-semibold' : ''} />
      </dd>
    </div>
  );
}

/** A lapsed hold cannot be resumed — the slots went back on sale (§14). */
function HoldExpired({ arenaSlug }: { arenaSlug: string }) {
  return (
    <div className="border-line bg-surface border p-5">
      <p className="text-ink text-sm font-medium">{t('checkout.expiredTitle')}</p>
      <p className="text-ink-secondary mt-1 text-sm">{t('checkout.expiredBody')}</p>
      <Button className="mt-4" asChild>
        <Link href={`/arenas/${arenaSlug}`}>{t('checkout.pickAgain')}</Link>
      </Button>
    </div>
  );
}
