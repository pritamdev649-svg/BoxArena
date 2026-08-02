import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { ShieldCheck, Info } from 'lucide-react';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { formatDayAndTime } from '@/shared/lib/datetime';
import { MoneyBreakdown, AcceptPanel, type MoneyBreakdownData } from '@/features/challenges';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('challengeMoney.metaTitle') };
export const dynamic = 'force-dynamic';

interface ChallengeDetail {
  publicId: string;
  sport: string;
  startAt: string;
  entryFeePaise: number;
  venueFeePaise: number;
  officialFeePaise: number;
  money: MoneyBreakdownData;
  status: string;
  arenaId?: { name?: string; address?: { areaName?: string } };
  creatorTeamId?: { name?: string; publicId?: string };
  match?: { hasOfficial: boolean; officialCanTriggerPayout: boolean } | null;
}

/**
 * The pre-accept screen (money spec MM3).
 *
 * Everything a player needs in order to stake money knowingly: what it costs,
 * what the pool is worth, what each outcome nets them, who verifies the
 * result, and what happens if they disagree with it.
 */
export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  const token = await getPlayerToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(`/challenges/${publicId}`)}`);

  const challenge = await apiFetchSafe<ChallengeDetail>(
    API_ENDPOINTS.challengeDetail(publicId),
    { token },
  );
  if (!challenge) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Header challenge={challenge} />

      <div className="mt-8">
        <MoneyBreakdown
          money={challenge.money}
          venueFeePaise={challenge.venueFeePaise}
          officialFeePaise={challenge.officialFeePaise}
          entryFeePaise={challenge.entryFeePaise}
        />
      </div>

      <VerificationNote match={challenge.match ?? null} />

      <section className="border-line-subtle mt-8 border-t pt-6">
        <h2 className="label-caps text-ink-muted mb-2">{t('challengeMoney.disputeWindow')}</h2>
        <p className="text-ink-secondary text-sm">{t('challengeMoney.disputeWindowBody')}</p>
      </section>

      <div className="mt-8">
        <AcceptPanel
          challengePublicId={publicId}
          teamPublicId={challenge.creatorTeamId?.publicId ?? null}
        />
      </div>
    </main>
  );
}

function Header({ challenge }: { challenge: ChallengeDetail }) {
  const area = challenge.arenaId?.address?.areaName;

  return (
    <header className="border-line-subtle border-b pb-6">
      <h1 className="font-display text-display-md uppercase">
        {challenge.arenaId?.name ?? t('challengeMoney.metaTitle')}
      </h1>
      <p className="text-ink-secondary mt-2 text-sm">
        {challenge.sport} · {formatDayAndTime(challenge.startAt)}
        {area ? ` · ${area}` : ''}
      </p>
    </header>
  );
}

/** Which of the three verification states this match is in. */
function verificationText(
  match: { hasOfficial: boolean; officialCanTriggerPayout: boolean } | null,
): string {
  if (match?.hasOfficial && match.officialCanTriggerPayout) {
    return t('challengeMoney.officialVerified');
  }
  if (match?.hasOfficial) return t('challengeMoney.officialUnverified');
  return t('challengeMoney.officialNone');
}

/**
 * Who can settle this result is a money fact, not a detail — it decides
 * whether the winner is paid automatically or waits on the loser to agree.
 */
function VerificationNote({
  match,
}: {
  match: { hasOfficial: boolean; officialCanTriggerPayout: boolean } | null;
}) {
  const verified = match?.hasOfficial && match.officialCanTriggerPayout;

  return (
    <p
      className={
        verified
          ? 'border-win/40 bg-win/10 text-win rounded-control mt-8 flex items-center gap-2 border p-4 text-sm'
          : 'border-line-subtle text-ink-secondary rounded-control mt-8 flex items-center gap-2 border border-dashed p-4 text-sm'
      }
    >
      {verified ? <ShieldCheck className="size-4 shrink-0" /> : <Info className="size-4 shrink-0" />}
      {verificationText(match)}
    </p>
  );
}
