import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPartnerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { MoneyText } from '@/shared/ui/money-text';
import { Badge } from '@/shared/ui/badge';
import { formatDate } from '@/shared/lib/datetime';
import { settlementTone, settlementLabelKey } from '@/features/partner';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('partnerSettlements.metaTitle') };
export const dynamic = 'force-dynamic';

interface SettlementSummary {
  publicId: string;
  periodStart: string;
  periodEnd: string;
  grossPaise: number;
  netPayablePaise: number;
  status: string;
  paidAt?: string;
}

export default async function SettlementsPage() {
  const token = await getPartnerToken();
  const settlements =
    (await apiFetchSafe<SettlementSummary[]>(API_ENDPOINTS.ownerSettlements, { token })) ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-display-md uppercase">{t('partnerSettlements.title')}</h1>
        <p className="text-ink-secondary mt-2 max-w-2xl text-sm">
          {t('partnerSettlements.description')}
        </p>
      </header>

      {settlements.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-line-subtle border-line-subtle divide-y border">
          {settlements.map((settlement) => (
            <SettlementRow key={settlement.publicId} settlement={settlement} />
          ))}
        </ul>
      )}
    </main>
  );
}

function SettlementRow({ settlement }: { settlement: SettlementSummary }) {
  return (
    <li>
      <Link
        href={`/partner/settlements/${settlement.publicId}`}
        className="hover:bg-elevated flex flex-wrap items-center gap-4 p-4 transition-colors duration-150"
      >
        <div className="min-w-0 flex-1">
          <p className="text-ink text-sm font-medium">
            {formatDate(settlement.periodStart)} – {formatDate(settlement.periodEnd)}
          </p>
          <p className="text-ink-muted tabular mt-0.5 text-xs">{settlement.publicId}</p>
        </div>

        <Badge tone={settlementTone(settlement.status)}>
          {t(settlementLabelKey(settlement.status))}
        </Badge>

        <div className="text-right">
          <MoneyText paise={settlement.netPayablePaise} className="text-sm font-semibold" />
          <p className="text-ink-muted text-xs">{t('partnerSettlements.netPayable')}</p>
        </div>

        <ArrowRight className="text-ink-muted size-4" />
      </Link>
    </li>
  );
}

/**
 * Empty is the normal state for a venue that has not completed a payout week
 * yet, so it explains the schedule rather than implying something is broken.
 */
function Empty() {
  return (
    <div className="border-line-subtle border p-8">
      <h2 className="font-display text-lg uppercase">{t('partnerSettlements.emptyTitle')}</h2>
      <p className="text-ink-secondary mt-2 max-w-lg text-sm">
        {t('partnerSettlements.emptyBody')}
      </p>
    </div>
  );
}
