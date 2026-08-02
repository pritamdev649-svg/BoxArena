import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPartnerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { Badge } from '@/shared/ui/badge';
import { formatDate } from '@/shared/lib/datetime';
import {
  SettlementBreakdown,
  StatementDownload,
  settlementTone,
  settlementLabelKey,
  type SettlementDetail,
} from '@/features/partner';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('partnerSettlements.metaTitle') };
export const dynamic = 'force-dynamic';

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const token = await getPartnerToken();

  const settlement = await apiFetchSafe<SettlementDetail>(
    API_ENDPOINTS.ownerSettlement(publicId),
    { token },
  );
  if (!settlement) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/partner/settlements"
        className="text-ink-secondary hover:text-ink mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('partnerSettlements.back')}
      </Link>

      <header className="border-line-subtle flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="font-display text-display-md uppercase">
            {formatDate(settlement.periodStart)} – {formatDate(settlement.periodEnd)}
          </h1>
          <p className="text-ink-muted tabular mt-1 text-xs">{settlement.publicId}</p>
          {settlement.paidAt ? (
            <p className="text-ink-secondary mt-2 text-sm">
              {t('partnerSettlements.paidOn')} {formatDate(settlement.paidAt)}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Badge tone={settlementTone(settlement.status)}>
            {t(settlementLabelKey(settlement.status))}
          </Badge>
          <StatementDownload settlement={settlement} />
        </div>
      </header>

      <div className="mt-6">
        <SettlementBreakdown settlement={settlement} />
      </div>
    </main>
  );
}
