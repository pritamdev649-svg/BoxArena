'use client';

import { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { MoneyText } from '@/shared/ui/money-text';
import { Badge } from '@/shared/ui/badge';
import { formatPaiseCompact } from '@/shared/lib/money';
import { t, type MessageKey } from '@/shared/i18n';
import { requestWithdrawalAction } from '../withdraw-actions';

/**
 * Taking money out.
 *
 * Three things this screen refuses to hide, because each one is a surprise
 * that turns into a support ticket: only **winnings** are withdrawable, KYC is
 * required before anything moves, and **TDS is deducted** — so the amount
 * typed is never the amount received. The net figure updates as you type.
 */
export interface WithdrawalConfig {
  enabled: boolean;
  kycStatus: string;
  hasPayoutDestination: boolean;
  minWithdrawalPaise: number;
  tdsPercent: number;
  withdrawablePaise: number;
}

export interface WithdrawalRow {
  publicId: string;
  amountPaise: number;
  tdsPaise: number;
  netPayablePaise: number;
  status: string;
  requestedAt: string;
  rejectionReason?: string;
}

const STATUS_LABELS: Record<string, MessageKey> = {
  pending: 'wallet.statusPending',
  approved: 'wallet.statusApproved',
  processing: 'wallet.statusProcessing',
  completed: 'wallet.statusCompleted',
  rejected: 'wallet.statusRejected',
  failed: 'wallet.statusFailed',
};

export function WithdrawPanel({
  config,
  history,
}: {
  config: WithdrawalConfig;
  history: WithdrawalRow[];
}) {
  return (
    <section className="border-line-subtle mt-10 border-t pt-6">
      <h2 className="label-caps text-ink-muted mb-2">{t('wallet.withdrawHeading')}</h2>

      {config.enabled ? <WithdrawBody config={config} /> : <ClosedNotice />}

      {history.length > 0 ? <History rows={history} /> : null}
    </section>
  );
}

/** The feature flag is off — say so plainly rather than showing a dead form. */
function ClosedNotice() {
  return <p className="text-ink-secondary text-sm">{t('wallet.withdrawBody')}</p>;
}

function WithdrawBody({ config }: { config: WithdrawalConfig }) {
  return (
    <div>
      <div className="border-line bg-surface border p-4">
        <p className="label-caps text-ink-muted">{t('wallet.withdrawableHeading')}</p>
        <MoneyText
          paise={config.withdrawablePaise}
          className="font-display mt-1 block text-2xl"
        />
        <p className="text-ink-muted mt-2 text-xs">{t('wallet.withdrawableNote')}</p>
      </div>

      <Blocked config={config} />
    </div>
  );
}

/**
 * Every reason a withdrawal cannot be requested, checked in the order the
 * player would hit them. Returns the form only once none apply.
 */
function Blocked({ config }: { config: WithdrawalConfig }) {
  if (config.kycStatus !== 'verified') {
    return <Notice message={t('wallet.withdrawKycBlocked')} />;
  }
  if (!config.hasPayoutDestination) {
    return <Notice message={t('wallet.withdrawNoDestination')} />;
  }
  if (config.withdrawablePaise < config.minWithdrawalPaise) {
    return <Notice message={t('wallet.withdrawNothing')} />;
  }
  return <WithdrawForm config={config} />;
}

function Notice({ message }: { message: string }) {
  return (
    <p className="border-line-subtle bg-surface-muted text-ink-secondary mt-4 border p-3 text-sm">
      {message}
    </p>
  );
}

function useWithdraw() {
  const [rupees, setRupees] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const result = await requestWithdrawalAction(Math.round(Number(rupees) * 100));
    setPending(false);

    if (result.success) {
      setDone(true);
      setRupees('');
      return;
    }
    setError(result.error ?? t('wallet.withdrawFailed'));
  };

  return { rupees, setRupees, pending, error, done, submit };
}

function WithdrawForm({ config }: { config: WithdrawalConfig }) {
  const form = useWithdraw();
  const paise = Math.round(Number(form.rupees) * 100);
  const valid = Number.isFinite(paise) && paise >= config.minWithdrawalPaise;

  return (
    <form onSubmit={form.submit} className="mt-4">
      <Input
        label={t('wallet.withdrawAmountLabel')}
        type="number"
        min={config.minWithdrawalPaise / 100}
        max={config.withdrawablePaise / 100}
        step={100}
        value={form.rupees}
        onChange={(event) => form.setRupees(event.target.value)}
        className="tabular"
        required
      />

      <p className="text-ink-muted mt-2 text-xs">
        {t('wallet.withdrawMinimum')} {formatPaiseCompact(config.minWithdrawalPaise)} ·{' '}
        {t('wallet.withdrawTds', { count: config.tdsPercent })}
      </p>

      {valid ? <NetLine paise={paise} tdsPercent={config.tdsPercent} /> : null}

      <Button type="submit" size="sm" className="mt-4" disabled={form.pending || !valid}>
        {form.pending ? t('wallet.withdrawPending') : t('wallet.withdrawCta')}
      </Button>

      {form.error ? (
        <p className="text-loss mt-3 text-sm">{form.error}</p>
      ) : null}
      {form.done ? (
        <p className="text-win mt-3 text-sm">{t('wallet.withdrawRequested')}</p>
      ) : null}
    </form>
  );
}

/**
 * Mirrors `computeTds` server-side. Shown before submitting because "why did I
 * get ₹700 when I asked for ₹1,000" is the question this prevents.
 */
function NetLine({ paise, tdsPercent }: { paise: number; tdsPercent: number }) {
  const tds = Math.floor((paise * tdsPercent) / 100);

  return (
    <dl className="divide-line-subtle border-line-subtle mt-3 divide-y border-y text-sm">
      <Row label={t('wallet.withdrawTdsRow')} paise={-tds} muted />
      <Row label={t('wallet.withdrawYouGet')} paise={paise - tds} />
    </dl>
  );
}

function Row({ label, paise, muted }: { label: string; paise: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-6 py-2">
      <dt className={muted ? 'text-ink-muted' : 'text-ink-secondary'}>{label}</dt>
      <dd>
        <MoneyText
          paise={paise}
          tone={muted ? 'muted' : 'default'}
          className="font-medium"
        />
      </dd>
    </div>
  );
}

function History({ rows }: { rows: WithdrawalRow[] }) {
  return (
    <div className="mt-8">
      <h3 className="label-caps text-ink-muted mb-2">{t('wallet.withdrawHistory')}</h3>
      <ul className="divide-line-subtle border-line-subtle divide-y border-y">
        {rows.map((row) => (
          <HistoryRow key={row.publicId} row={row} />
        ))}
      </ul>
    </div>
  );
}

function HistoryRow({ row }: { row: WithdrawalRow }) {
  const label = STATUS_LABELS[row.status];

  return (
    <li className="flex items-start justify-between gap-4 py-3 text-sm">
      <div className="min-w-0">
        <MoneyText paise={row.amountPaise} className="font-medium" />
        <p className="text-ink-muted text-xs">
          {new Date(row.requestedAt).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'short',
          })}
        </p>
        {row.rejectionReason ? (
          <p className="text-loss mt-1 text-xs">{row.rejectionReason}</p>
        ) : null}
      </div>

      <Badge tone={row.status === 'rejected' ? 'loss' : 'neutral'}>
        {label ? t(label) : row.status}
      </Badge>
    </li>
  );
}
