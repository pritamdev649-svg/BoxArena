import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { Scoreboard, type RallyState } from '@/features/scoring';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('scoring.metaTitle') };
export const dynamic = 'force-dynamic';

interface LiveState {
  matchPublicId: string;
  status: string;
  startedAt?: string;
  bestOf: number;
  state: RallyState;
  creatorNames?: string[];
  opponentNames?: string[];
}

interface AssignedMatch {
  publicId: string;
  creatorTeamId?: { name?: string } | string;
  opponentTeamId?: { name?: string } | string;
}

/**
 * The official's scoring surface.
 *
 * Deliberately its own route rather than a tab inside a panel: this is opened
 * once, held in one hand for an hour, and nothing else on it should compete
 * for the thumb.
 */
export default async function ScorePage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  const token = await getPlayerToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(`/score/${publicId}`)}`);

  const live = await apiFetchSafe<LiveState>(API_ENDPOINTS.matchLive(publicId), { token });
  if (!live) notFound();

  /**
   * Whether THIS user may score is the API's call, not ours — it re-checks on
   * every command. We ask only so the finished screen can show the confirm
   * button rather than a button that always fails.
   */
  const assigned = await apiFetchSafe<AssignedMatch[]>(API_ENDPOINTS.officialMyMatches, { token });
  const canConfirm = (assigned ?? []).some((match) => match.publicId === publicId);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Scoreboard
        matchPublicId={publicId}
        creatorNames={live.creatorNames ?? [t('scoring.sideA')]}
        opponentNames={live.opponentNames ?? [t('scoring.sideB')]}
        initialState={live.state}
        status={live.status}
        startedAt={live.startedAt}
        canConfirm={canConfirm}
      />
    </main>
  );
}
