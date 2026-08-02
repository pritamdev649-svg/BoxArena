import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/shared/ui/page-hero';
import { LeaderboardRow, type FormResult } from '@/shared/ui/leaderboard-row';
import { apiFetchSafe } from '@/shared/lib/api';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { t } from '@/shared/i18n';

export const metadata: Metadata = {
  title: t('leaderboard.metaTitle'),
  description: t('leaderboard.metaDescription'),
};

export const dynamic = 'force-dynamic';

/**
 * The city table (task F3.5), read from `GET /leaderboards`.
 *
 * Two things this page must not do, both of which the fixture version did:
 * invent a form string, and hand a rank to somebody who has never played. The
 * API returns `rank: null` for an unplayed row and derives form from settled
 * matches, so the page can render honestly without deciding anything itself.
 */
export interface LeaderboardEntry {
  rank: number | null;
  publicId: string;
  fullName: string;
  areaName: string | null;
  eloRating: number;
  matchesPlayed: number;
  form: FormResult[];
  isUnranked: boolean;
}

export default async function LeaderboardPage() {
  const rows =
    (await apiFetchSafe<LeaderboardEntry[]>(API_ENDPOINTS.leaderboard())) ?? [];

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

        {rows.length === 0 ? (
          <p className="text-ink-muted py-10 text-center text-sm">{t('leaderboard.empty')}</p>
        ) : (
          <div className="divide-line-subtle divide-y">
            {rows.map((row) => (
              /* The ladder is the main route into a player's record. */
              <Link
                key={row.publicId}
                href={`/players/${row.publicId}`}
                className="hover:bg-elevated block transition-colors duration-150"
              >
                <LeaderboardRow
                  rank={row.rank}
                  name={row.fullName}
                  areaName={row.areaName ?? ''}
                  eloRating={row.eloRating}
                  form={row.form}
                />
              </Link>
            ))}
          </div>
        )}

        <p className="text-ink-muted mt-6 text-xs">{t('leaderboard.unrankedNote')}</p>
      </section>
    </main>
  );
}
