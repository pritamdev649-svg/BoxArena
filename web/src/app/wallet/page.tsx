import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { MoneyText } from '@/shared/ui/money-text';
import {
  TopupForm,
  Ledger,
  WithdrawPanel,
  type LedgerEntry,
  type WithdrawalRow,
  type WithdrawalConfig,
} from '@/features/wallet';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('wallet.metaTitle') };
export const dynamic = 'force-dynamic';

interface WalletSummary {
  depositPaise: number;
  winningsPaise: number;
  bonusPaise: number;
  lockedPaise: number;
  spendablePaise: number;
  withdrawal: WithdrawalConfig;
}

/**
 * The wallet (task F2.7).
 *
 * Closes the last break in the revenue loop: checkout charges this balance,
 * and until now there was no way to add to it on web — a player who ran short
 * hit the shortfall guard with nowhere to go.
 */
export default async function WalletPage() {
  const token = await getPlayerToken();
  if (!token) redirect(`/login?next=${encodeURIComponent('/wallet')}`);

  const [wallet, ledger, withdrawals] = await Promise.all([
    apiFetchSafe<WalletSummary>(API_ENDPOINTS.wallet, { token }),
    apiFetchSafe<LedgerEntry[]>(API_ENDPOINTS.walletTransactions(), { token }),
    apiFetchSafe<WithdrawalRow[]>(API_ENDPOINTS.walletWithdrawals, { token }),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-display-md uppercase">{t('wallet.title')}</h1>
        <p className="text-ink-secondary mt-2 text-sm">{t('wallet.description')}</p>
      </header>

      {wallet ? <Balances wallet={wallet} /> : null}

      <div className="mt-8">
        <TopupForm />
      </div>

      <section className="mt-10">
        <h2 className="label-caps text-ink-muted mb-3">{t('wallet.ledgerHeading')}</h2>
        <Ledger entries={ledger ?? []} />
      </section>

      {wallet ? (
        <WithdrawPanel config={wallet.withdrawal} history={withdrawals ?? []} />
      ) : null}
    </main>
  );
}

function Balances({ wallet }: { wallet: WalletSummary }) {
  return (
    <div>
      <div className="border-line bg-surface border p-5">
        <p className="label-caps text-ink-muted">{t('wallet.spendable')}</p>
        <MoneyText paise={wallet.spendablePaise} className="font-display mt-1 block text-3xl" />
      </div>

      <dl className="divide-line-subtle border-line-subtle mt-4 divide-y border-y text-sm">
        <Line label={t('wallet.depositHeading')} paise={wallet.depositPaise} />
        <Line label={t('wallet.winningsHeading')} paise={wallet.winningsPaise} />
        <Line
          label={t('wallet.bonusHeading')}
          paise={wallet.bonusPaise}
          note={t('wallet.bonusNote')}
        />
        {wallet.lockedPaise > 0 ? (
          <Line
            label={t('wallet.lockedHeading')}
            paise={wallet.lockedPaise}
            note={t('wallet.lockedNote')}
            muted
          />
        ) : null}
      </dl>
    </div>
  );
}

function Line({
  label,
  paise,
  note,
  muted,
}: {
  label: string;
  paise: number;
  note?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0">
        <dt className={muted ? 'text-ink-muted' : 'text-ink-secondary'}>{label}</dt>
        {note ? <p className="text-ink-muted mt-0.5 text-xs">{note}</p> : null}
      </div>
      <dd className="shrink-0">
        <MoneyText paise={paise} tone={muted ? 'muted' : 'default'} className="font-medium" />
      </dd>
    </div>
  );
}
