import type { Metadata } from 'next';
import { PageHero } from '@/shared/ui/page-hero';
import { LeaderboardRow } from '@/shared/ui/leaderboard-row';
import { SEED_PLAYERS } from '@/mocks/seed/players';
import { t } from '@/shared/i18n';

export const metadata: Metadata = {
  title: t('leaderboard.metaTitle'),
  description: t('leaderboard.metaDescription'),
};

/**
 * Task F3.5. Deliberately card-free: a league table needs a heading, tabular
 * numerals, aligned columns and a hairline rule (design_system.md §8.3).
 */
export default function LeaderboardPage() {
  const ranked = [...SEED_PLAYERS].sort((a, b) => b.eloRating - a.eloRating);

  return (
    <main>
      <PageHero
        eyebrow={t('leaderboard.eyebrow')}
        title={t('leaderboard.title')}
        description={t('leaderboard.description')}
        sport="badminton"
      />

      <section className="mx-auto max-w-3xl px-6 py-10">
        <div className="text-ink-muted label-caps border-line-subtle flex items-center gap-3 border-b pb-2">
          <span className="w-7 text-right">{t('leaderboard.columnRank')}</span>
          <span className="flex-1">{t('leaderboard.columnPlayer')}</span>
          <span className="hidden sm:block">{t('leaderboard.columnForm')}</span>
          <span className="w-16 text-right">{t('leaderboard.columnRating')}</span>
        </div>

        <div className="divide-line-subtle divide-y">
          {ranked.map((player, index) => (
            <LeaderboardRow
              key={player.publicId}
              rank={index + 1}
              name={player.fullName}
              areaName={player.areaName}
              eloRating={player.eloRating}
              form={player.form}
            />
          ))}
        </div>

        <p className="text-ink-muted mt-6 text-xs">
          {t('leaderboard.unrankedNote')}
        </p>
      </section>
    </main>
  );
}
