import { MoneyText } from '@/shared/ui/money-text';
import { formatDayAndTime } from '@/shared/lib/datetime';
import { t } from '@/shared/i18n';

/**
 * The ledger.
 *
 * Every balance change, in order, with its reason. This is the answer to
 * "where did my money go" — and the reason the wallet is trustworthy at all,
 * since balances are derived from these rows rather than edited directly.
 */
export interface LedgerEntry {
  _id: string;
  type: string;
  bucket: string;
  amountPaise: number;
  description?: string;
  createdAt: string;
}

/** A credit reads positive, a debit negative — never a bare number. */
function isCredit(amountPaise: number): boolean {
  return amountPaise > 0;
}

export function Ledger({ entries }: { entries: LedgerEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-ink-muted text-sm">{t('wallet.ledgerEmpty')}</p>;
  }

  return (
    <ul className="divide-line-subtle border-line-subtle divide-y border-y">
      {entries.map((entry) => (
        <li key={entry._id} className="flex items-center gap-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-ink truncate text-sm">
              {entry.description ?? entry.type.replace(/_/gu, ' ')}
            </p>
            <p className="text-ink-muted mt-0.5 text-xs">
              {formatDayAndTime(entry.createdAt)} · {entry.bucket}
            </p>
          </div>

          <MoneyText
            paise={entry.amountPaise}
            tone={isCredit(entry.amountPaise) ? 'credit' : 'debit'}
            className="shrink-0 text-sm font-medium"
          />
        </li>
      ))}
    </ul>
  );
}
