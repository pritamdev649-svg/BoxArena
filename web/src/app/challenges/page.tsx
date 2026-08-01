import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, MapPin, Users } from 'lucide-react';
import { PageHero } from '@/shared/ui/page-hero';
import { Button } from '@/shared/ui/button';
import { MoneyText, PrizeBadge } from '@/shared/ui/money-text';
import { SEED_TEAMS } from '@/mocks/seed/players';
import { SEED_ARENAS } from '@/mocks/seed/arenas';
import { t } from '@/shared/i18n';

export const metadata: Metadata = {
  title: t('challenges.metaTitle'),
  description: t('challenges.metaDescription'),
};

/** Task F3.2. Feed of open challenges, soonest first. */
export default function ChallengesPage() {
  const challenges = SEED_TEAMS.slice(0, 4).map((team, index) => ({
    team,
    arena: SEED_ARENAS[index % SEED_ARENAS.length]!,
    entryFeePaise: [0, 25000, 50000, 15000][index] ?? 0,
    startsIn: ['Today · 7:00 PM', 'Today · 9:00 PM', 'Tomorrow · 6:00 AM', 'Sat · 8:00 PM'][index]!,
  }));

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
        <div className="space-y-3">
          {challenges.map((challenge) => (
            <ChallengeRow key={challenge.team.publicId} {...challenge} />
          ))}
        </div>
      </section>
    </main>
  );
}

interface ChallengeRowProps {
  team: (typeof SEED_TEAMS)[number];
  arena: (typeof SEED_ARENAS)[number];
  entryFeePaise: number;
  startsIn: string;
}

function ChallengeRow({ team, arena, entryFeePaise, startsIn }: ChallengeRowProps) {
  return (
    <article className="border-line-subtle bg-surface flex flex-wrap items-center gap-4 border p-5">
      <div className="min-w-0 flex-1">
        <h2 className="text-ink truncate font-medium">{team.name}</h2>
        <div className="text-ink-muted mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {team.sport} · {t('common.playerCount', { count: team.memberCount })}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {arena.name}, {arena.areaName}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {startsIn}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-ink-muted label-caps">{t('common.rating')}</p>
          <p className="tabular text-ink text-sm font-semibold">{team.eloRating}</p>
        </div>

        {/* A free friendly is a legitimate challenge — never imply money is required. */}
        {entryFeePaise > 0 ? (
          <PrizeBadge paise={entryFeePaise * 2 - Math.floor(entryFeePaise * 0.2)} />
        ) : (
          <span className="border-line-subtle text-ink-secondary label-caps rounded-chip border px-2 py-1">
            {t('common.friendly')}
          </span>
        )}

        <Button size="sm" variant="secondary">
          {entryFeePaise > 0 ? (
            <>
              {t('common.accept')} · <MoneyText paise={entryFeePaise} />
            </>
          ) : (
            t('common.accept')
          )}
        </Button>
      </div>
    </article>
  );
}
