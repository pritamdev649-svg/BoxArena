'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { formatPaiseCompact } from '@/shared/lib/money';
import { t } from '@/shared/i18n';
import { createTopupAction, verifyTopupAction } from '../actions';

/**
 * Adding money.
 *
 * Quick amounts first, because most top-ups are "enough for tonight's court"
 * rather than a considered figure — and typing ₹ amounts on a phone at a venue
 * is exactly where a mis-typed zero happens.
 */
const QUICK_AMOUNTS_PAISE = [50_000, 100_000, 200_000, 500_000];
const MIN_TOPUP_PAISE = 10_000;

function useTopup(onCredited: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const topUp = async (paise: number) => {
    setPending(true);
    setError(undefined);

    const created = await createTopupAction(paise);
    if (!created.success || !created.order) {
      setPending(false);
      setError(created.error ?? t('wallet.failed'));
      return;
    }

    /**
     * Real Razorpay checkout is not wired on web yet — that needs their JS SDK
     * and live keys. Rather than fake it, say so: a button that appears to
     * take money and does not is worse than one that explains itself.
     */
    if (!created.order.isMock) {
      setPending(false);
      setError(t('wallet.gatewayNotWired'));
      return;
    }

    const verified = await verifyTopupAction({
      orderId: created.order.orderId,
      paymentId: `pay_mock_${created.order.orderId}`,
      signature: 'mock',
    });

    setPending(false);
    if (!verified.success) {
      setError(verified.error ?? t('wallet.failed'));
      return;
    }
    setDone(t('wallet.credited', { count: Math.round(paise / 100) }));
    onCredited();
  };

  return { pending, error, done, topUp };
}

export function TopupForm() {
  const [rupees, setRupees] = useState('');
  const { pending, error, done, topUp } = useTopup(() => setRupees(''));

  const paise = Math.round(Number(rupees) * 100);
  const isValid = Number.isFinite(paise) && paise >= MIN_TOPUP_PAISE;

  return (
    <div className="border-line bg-surface border p-5">
      <h2 className="font-display text-base uppercase">{t('wallet.topupHeading')}</h2>
      <p className="text-ink-secondary mt-1 text-sm">{t('wallet.topupBody')}</p>

      <QuickAmounts onPick={(amount) => setRupees(String(amount / 100))} />

      <div className="mt-4">
        <Input
          label={t('wallet.amountLabel')}
          type="number"
          min={MIN_TOPUP_PAISE / 100}
          step={50}
          value={rupees}
          onChange={(event) => setRupees(event.target.value)}
          className="tabular"
        />
      </div>

      {error ? <p className="text-loss mt-3 text-sm">{error}</p> : null}
      {done ? <p className="text-win mt-3 text-sm font-medium">{done}</p> : null}

      <Button
        size="lg"
        className="mt-4"
        disabled={!isValid || pending}
        onClick={() => void topUp(paise)}
      >
        {pending ? t('wallet.adding') : t('wallet.addMoney')}
      </Button>

      <p className="text-ink-muted mt-3 text-xs">
        {t('wallet.minimum')} {formatPaiseCompact(MIN_TOPUP_PAISE)}
      </p>
    </div>
  );
}

/** Most top-ups are "enough for tonight's court", not a considered figure. */
function QuickAmounts({ onPick }: { onPick: (paise: number) => void }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {QUICK_AMOUNTS_PAISE.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onPick(amount)}
          className="border-line text-ink-secondary hover:border-line-strong hover:text-ink rounded-chip border px-3 py-1.5 text-sm transition-colors duration-150"
        >
          {formatPaiseCompact(amount)}
        </button>
      ))}
    </div>
  );
}
