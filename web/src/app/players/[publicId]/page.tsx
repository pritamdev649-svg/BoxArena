import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { apiFetchSafe } from '@/shared/lib/api';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { PlayerProfile, type PlayerProfileData } from '@/features/players';
import { t } from '@/shared/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const player = await apiFetchSafe<PlayerProfileData>(API_ENDPOINTS.publicPlayer(publicId));

  return player
    ? {
      title: player.fullName,
      description: `${player.fullName}'s record on BoxArena${player.homeAreaName ? `, ${player.homeAreaName}` : ''}.`,
    }
    : { title: t('player.metaTitle') };
}

/**
 * A player's public record (task F3.5).
 *
 * Public and unauthenticated on purpose — it is what a leaderboard row links
 * to and what gets shared, so gating it behind sign-in would make the ladder a
 * dead end. `GET /users/:publicId` returns only what is safe to publish: no
 * phone number, no wallet, no KYC.
 */
export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const player = await apiFetchSafe<PlayerProfileData>(API_ENDPOINTS.publicPlayer(publicId));
  if (!player) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <PlayerProfile player={player} />
    </main>
  );
}
