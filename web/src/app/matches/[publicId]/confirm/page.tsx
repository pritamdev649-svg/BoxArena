import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { ConfirmResultPanel } from '@/features/officials';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('officials.confirmMetaTitle') };
export const dynamic = 'force-dynamic';

interface LiveState {
  status: string;
  creatorNames?: string[];
  opponentNames?: string[];
  state: {
    games: { creator: number; opponent: number }[];
    winner: 'creator' | 'opponent' | null;
    isComplete: boolean;
  };
}

/**
 * Where a captain answers the official's scorecard.
 *
 * Deliberately its own page rather than a banner somewhere: this is a money
 * decision, and it should be a link you can send someone in a notification.
 */
export default async function ConfirmResultPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;

  const token = await getPlayerToken();
  if (!token) redirect(`/login?next=${encodeURIComponent(`/matches/${publicId}/confirm`)}`);

  const live = await apiFetchSafe<LiveState>(API_ENDPOINTS.matchLive(publicId), { token });
  if (!live) notFound();

  const tally = live.state.games.reduce(
    (acc, game) => {
      if (game.creator > game.opponent) acc.creator += 1;
      else acc.opponent += 1;
      return acc;
    },
    { creator: 0, opponent: 0 },
  );

  const winnerName =
    live.state.winner === 'creator'
      ? (live.creatorNames ?? ['Team A']).join(' / ')
      : (live.opponentNames ?? ['Team B']).join(' / ');

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <h1 className="font-display text-display-md mb-6 uppercase">
        {t('officials.confirmMetaTitle')}
      </h1>

      {live.state.isComplete ? (
        <ConfirmResultPanel
          matchPublicId={publicId}
          summary={`${winnerName} — ${String(tally.creator)}–${String(tally.opponent)}`}
        />
      ) : (
        <p className="text-ink-secondary text-sm">{t('officials.notFinished')}</p>
      )}
    </main>
  );
}
