import { AlertTriangle } from 'lucide-react';
import { MoneyText } from '@/shared/ui/money-text';
import { t } from '@/shared/i18n';

/**
 * What accepting this challenge costs, and what winning is worth.
 *
 * Shown BEFORE accepting (money spec MM3), because a player who discovers the
 * real cost after staking has been misled even if every number was technically
 * available somewhere. Every figure is computed server-side — the client is
 * never trusted with money maths it could get wrong or tamper with.
 */
export interface MoneyBreakdownData {
  perTeamCostPaise: number;
  totalEntryPoolPaise: number;
  entryCommissionPaise: number;
  netPrizePoolPaise: number;
  winnerNetProfitPaise: number;
  loserNetPaise: number;
  suggestedMinimumEntryFeePaise: number;
  winnerProfitIsLow: boolean;
  exceedsCap: boolean;
  capPaise: number;
}

export function MoneyBreakdown({
  money,
  venueFeePaise,
  officialFeePaise,
  entryFeePaise,
}: {
  money: MoneyBreakdownData;
  venueFeePaise: number;
  officialFeePaise: number;
  entryFeePaise: number;
}) {
  return (
    <div className="space-y-6">
      <Section heading={t('challengeMoney.costHeading')}>
        <Line label={t('challengeMoney.venueShare')} paise={Math.ceil(venueFeePaise / 2)} />
        {officialFeePaise > 0 ? (
          <Line
            label={t('challengeMoney.officialShare')}
            paise={Math.ceil(officialFeePaise / 2)}
          />
        ) : null}
        <Line label={t('challengeMoney.entryFee')} paise={entryFeePaise} />
        <Line label={t('challengeMoney.totalToJoin')} paise={money.perTeamCostPaise} strong />
      </Section>

      <Section heading={t('challengeMoney.poolHeading')}>
        <Line label={t('challengeMoney.totalPool')} paise={money.totalEntryPoolPaise} />
        <Line
          label={t('challengeMoney.commission')}
          paise={-money.entryCommissionPaise}
          tone="debit"
        />
        <Line label={t('challengeMoney.netPool')} paise={money.netPrizePoolPaise} strong />
      </Section>

      <Outcomes money={money} />

      {money.winnerProfitIsLow ? (
        <Warning
          text={t('challengeMoney.lowProfit')}
          hint={t('challengeMoney.suggestMinimum')}
          paise={money.suggestedMinimumEntryFeePaise}
        />
      ) : null}

      {money.exceedsCap ? (
        <Warning text={t('challengeMoney.overCap')} hint={t('challengeMoney.capHint')} paise={money.capPaise} />
      ) : null}
    </div>
  );
}

/** The whole point of the screen: what each outcome is actually worth. */
function Outcomes({ money }: { money: MoneyBreakdownData }) {
  return (
    <Section heading={t('challengeMoney.outcomeHeading')}>
      <div className="flex items-baseline justify-between py-1.5">
        <span className="text-ink-secondary text-sm">{t('challengeMoney.ifYouWin')}</span>
        <MoneyText
          paise={money.winnerNetProfitPaise}
          tone={money.winnerNetProfitPaise > 0 ? 'credit' : 'debit'}
          className="font-semibold"
        />
      </div>
      <div className="flex items-baseline justify-between py-1.5">
        <span className="text-ink-secondary text-sm">{t('challengeMoney.ifYouLose')}</span>
        <MoneyText paise={money.loserNetPaise} tone="debit" className="font-semibold" />
      </div>
    </Section>
  );
}

function Warning({ text, hint, paise }: { text: string; hint: string; paise: number }) {
  return (
    <div className="border-dispute/40 bg-dispute/10 rounded-control border p-4">
      <p className="text-dispute flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="size-4" />
        {text}
      </p>
      <p className="text-ink-secondary mt-1 text-xs">
        {hint} <MoneyText paise={paise} className="font-medium" />
      </p>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="label-caps text-ink-muted mb-2">{heading}</h2>
      <dl className="border-line-subtle divide-line-subtle divide-y border-y">{children}</dl>
    </section>
  );
}

function Line({
  label,
  paise,
  strong,
  tone,
}: {
  label: string;
  paise: number;
  strong?: boolean;
  tone?: 'debit';
}) {
  return (
    <div className="flex items-baseline justify-between py-2">
      <dt className={strong ? 'text-ink text-sm font-medium' : 'text-ink-secondary text-sm'}>
        {label}
      </dt>
      <dd>
        <MoneyText
          paise={paise}
          tone={tone === 'debit' ? 'debit' : 'default'}
          className={strong ? 'font-semibold' : ''}
        />
      </dd>
    </div>
  );
}
