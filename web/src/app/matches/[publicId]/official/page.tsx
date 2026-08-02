import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { OfficialPicker, type AssignmentState, type OfficialSummary } from '@/features/officials';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('officials.pickMetaTitle') };
export const dynamic = 'force-dynamic';

interface LiveState {
  status: string;
  sport?: string;
  official?: {
    officialId: string | null;
    canTriggerPayout: boolean;
    confirmedByCreator: boolean;
    confirmedByOpponent: boolean;
    locked: boolean;
  };
}

interface FeeQuote {
  totalPaise: number;
  creatorSharePaise: number;
  opponentSharePaise: number;
  collected: boolean;
}

/**
 * Where captains choose who officiates (featuredoc/11 §OF3).
 *
 * A page rather than a step inside challenge creation, because the decision
 * outlives that moment: an official can be proposed, rejected and re-proposed
 * right up until the match starts, and both captains need a link they can
 * return to.
 */
const NO_OFFICIAL: AssignmentState = {
  officialId: null,
  canTriggerPayout: false,
  confirmedByCreator: false,
  confirmedByOpponent: false,
  locked: false,
};

function assignmentOf(live: LiveState): AssignmentState {
  return live.official ?? NO_OFFICIAL;
}

export default async function ChooseOfficialPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  const token = await getPlayerToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(`/matches/${publicId}/official`)}`);

  const live = await apiFetchSafe<LiveState>(API_ENDPOINTS.matchLive(publicId), { token });
  if (!live) notFound();

  /** The fee quote doubles as the assignment probe — it 400s with no official. */
  const [officials, fee] = await Promise.all([
    apiFetchSafe<OfficialSummary[]>(
      `${API_ENDPOINTS.officials}?sport=${live.sport ?? 'badminton'}`,
      { token },
    ),
    apiFetchSafe<FeeQuote>(API_ENDPOINTS.matchOfficialFee(publicId), { token }),
  ]);

  const assignment = assignmentOf(live);
  /** The picker highlights by publicId; the match stores the Mongo id. */
  const chosen =
    (officials ?? []).find((official) => official.publicId === assignment.officialId)?.publicId ??
    null;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6">
        <h1 className="font-display text-display-md uppercase">{t('officials.pickTitle')}</h1>
        <p className="text-ink-secondary mt-2 max-w-2xl text-sm">{t('officials.pickBody')}</p>
      </header>

      <OfficialPicker
        matchPublicId={publicId}
        officials={officials ?? []}
        assignment={assignment}
        chosenPublicId={chosen}
        feeCollected={fee?.collected ?? false}
      />
    </main>
  );
}
