import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, MapPin, Users } from 'lucide-react';
import { PageHero } from '@/shared/ui/page-hero';
import { Button } from '@/shared/ui/button';
import { MoneyText, PrizeBadge } from '@/shared/ui/money-text';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { formatDayAndTime } from '@/shared/lib/datetime';
import { t } from '@/shared/i18n';

export const metadata: Metadata = {
  title: t('challenges.metaTitle'),
  description: t('challenges.metaDescription'),
};

export const dynamic = 'force-dynamic';

/**
 * Feed of open challenges (task F3.2), read from `GET /challenges`.
 *
 * Replaces a fixture-backed version that paired seed teams with seed arenas by
 * array index — which is why it happily showed a football team at a
 * badminton-only venue, and an Accept button with no challenge behind it.
 */
interface FeedChallenge {
  publicId: string;
  sport: string;
  format: string;
  startAt: string;
  entryFeePaise: number;
  creatorTeamId?: { name?: string; eloRating?: number } | string;
  arenaId?: { name?: string; address?: { areaName?: string } } | string;
}

function teamOf(challenge: FeedChallenge) {
  return typeof challenge.creatorTeamId === 'object' ? challenge.creatorTeamId : undefined;
}

function arenaOf(challenge: FeedChallenge) {
  return typeof challenge.arenaId === 'object' ? challenge.arenaId : undefined;
}

export default async function ChallengesPage() {
  /** The feed is participant-scoped, so it needs the player's session. */
  const token = await getPlayerToken();
  const challenges =
    (await apiFetchSafe<FeedChallenge[]>(API_ENDPOINTS.challenges(), { token })) ?? [];

  return (
    <main>
      <PageHero
        eyebrow={t('challenges.eyebrow')}
        title={t('challenges.title')}
        description={t('challenges.description')}
      >
        <Button asChild>
          <Link href="/challenges/new">{t('challenges.postCta')}</Link>
        </Button>
      </PageHero>

      <section className="mx-auto max-w-5xl px-6 py-10">
        {challenges.length === 0 ? (
          <Empty signedIn={Boolean(token)} />
        ) : (
          <div className="space-y-3">
            {challenges.map((challenge) => (
              <ChallengeRow key={challenge.publicId} challenge={challenge} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function ChallengeRow({ challenge }: { challenge: FeedChallenge }) {
  const team = teamOf(challenge);
  const arena = arenaOf(challenge);

  return (
    <Link
      href={`/challenges/${challenge.publicId}`}
      className="border-line-subtle bg-surface hover:border-line-strong group flex flex-wrap items-center gap-5 border p-5 transition-colors duration-150"
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-ink group-hover:text-volt-ink truncate font-medium transition-colors duration-150">
          {team?.name ?? t('challenges.aTeam')}
        </h2>
        <p className="text-ink-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {challenge.sport} · {challenge.format}
          </span>
          {arena?.name ? (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {arena.name}
              {arena.address?.areaName ? `, ${arena.address.areaName}` : ''}
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDayAndTime(challenge.startAt)}
          </span>
        </p>
      </div>

      {team?.eloRating ? (
        <div className="text-right">
          <p className="label-caps text-ink-muted">{t('common.rating')}</p>
          <p className="tabular text-ink text-sm font-semibold">{team.eloRating}</p>
        </div>
      ) : null}

      <Stake entryFeePaise={challenge.entryFeePaise} />
    </Link>
  );
}

/** A free match and a staked one are different products — label them so. */
function Stake({ entryFeePaise }: { entryFeePaise: number }) {
  if (entryFeePaise <= 0) {
    return (
      <span className="border-line-subtle text-ink-secondary rounded-chip border px-2.5 py-1 text-xs">
        {t('common.friendly')}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Prize is the pool both sides create, not what one team pays. */}
      <PrizeBadge paise={entryFeePaise * 2} />
      <div className="text-right">
        <p className="label-caps text-ink-muted">{t('challenges.entry')}</p>
        <MoneyText paise={entryFeePaise} className="text-sm font-semibold" />
      </div>
    </div>
  );
}

function Empty({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="border-line-subtle border border-dashed p-10 text-center">
      <p className="text-ink text-sm font-medium">{t('challenges.emptyTitle')}</p>
      <p className="text-ink-secondary mx-auto mt-2 max-w-md text-sm">
        {signedIn ? t('challenges.emptyBody') : t('challenges.emptySignedOut')}
      </p>
    </div>
  );
}
