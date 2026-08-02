import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import {
  PostChallengeForm,
  type OwnTeam,
  type PostableBooking,
} from '@/features/challenges';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('postChallenge.metaTitle') };
export const dynamic = 'force-dynamic';

interface ApiBooking {
  publicId: string;
  sport: string;
  startAt: string;
  status: string;
  totalPaise: number;
  arenaId?: string;
}

interface ApiArena {
  publicId: string;
  name: string;
}

interface Me {
  fullName: string;
}

/**
 * Only future, confirmed bookings can carry a challenge.
 *
 * Module scope rather than inline, because reading the clock during render is
 * exactly the impurity that makes a server render and a re-render disagree.
 */
function postableBookings(
  bookings: ApiBooking[],
  arenaName: Map<string, string>,
): PostableBooking[] {
  const now = Date.now();

  return bookings
    .filter(
      (booking) =>
        booking.status === 'confirmed' && new Date(booking.startAt).getTime() > now,
    )
    .map((booking) => ({
      publicId: booking.publicId,
      sport: booking.sport,
      startAt: booking.startAt,
      totalPaise: booking.totalPaise,
      arenaName: booking.arenaId ? (arenaName.get(booking.arenaId) ?? null) : null,
    }));
}

/**
 * Posting a challenge on a slot you already hold.
 *
 * Only future, confirmed bookings are offered — a challenge on a slot that has
 * already been played, or on one still awaiting payment, cannot be accepted by
 * anybody. Filtering here rather than letting the API refuse means the list
 * never contains a choice that will fail.
 */
export default async function NewChallengePage() {
  const token = await getPlayerToken();
  if (!token) redirect(`/login?next=${encodeURIComponent('/challenges/new')}`);

  const [bookings, teams, me, arenas] = await Promise.all([
    apiFetchSafe<ApiBooking[]>(API_ENDPOINTS.myBookings, { token }),
    apiFetchSafe<OwnTeam[]>(API_ENDPOINTS.teamsMine, { token }),
    apiFetchSafe<Me>(API_ENDPOINTS.usersMe, { token }),
    apiFetchSafe<ApiArena[]>(API_ENDPOINTS.arenas),
  ]);

  const arenaName = new Map((arenas ?? []).map((arena) => [arena.publicId, arena.name]));

  const postable = postableBookings(bookings ?? [], arenaName);

  /** Challenges are badminton-only for now, so only offer badminton teams. */
  const badmintonTeams = (teams ?? []).filter((team) => team.sport === 'badminton');

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-display-md uppercase">{t('postChallenge.title')}</h1>
        <p className="text-ink-secondary mt-2 text-sm">{t('postChallenge.description')}</p>
      </header>

      <PostChallengeForm
        bookings={postable}
        teams={badmintonTeams}
        suggestedTeamName={me?.fullName ?? ''}
      />
    </main>
  );
}
