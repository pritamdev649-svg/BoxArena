import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { ScoreStrip } from '@/shared/ui/score-strip';
import { LeaderboardRow } from '@/shared/ui/leaderboard-row';
import { MatchStatusChip } from '@/shared/ui/match-status-chip';
import { PrizeBadge } from '@/shared/ui/money-text';
import { HeroCourtBackdrop } from '@/shared/ui/court-graphics';
import { TonightPanel } from '@/features/arenas';
import { SEED_PLAYERS } from '@/mocks/seed/players';
import { t } from '@/shared/i18n';

/**
 * Landing page (task F2.1).
 *
 * The five-step loop IS the marketing: PlaySpots and Playo sell
 * "Search -> Book -> Play". Ours continues into Score -> Rank -> Win, which
 * is the part neither of them has (competitive_analysis.md §3).
 */
export default function HomePage() {
  return (
    <main>
      <Hero />
      <TheLoop />
      <ProofSection />
    </main>
  );
}

function Hero() {
  return (
    <section className="border-line-subtle relative overflow-hidden border-b px-6 py-20 md:py-28">
      <HeroCourtBackdrop />

      {/* Asymmetric 3:2 — the claim leads, live inventory supports it. */}
      <div className="relative mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <p className="label-caps text-volt-ink mb-6">
            {t('home.eyebrow')}
          </p>

          {/* Sized to fit two lines inside the 3-of-5 column. display-xl
              overflowed to a third line with an orphaned "IT." — text-balance
              keeps it honest at every width in between. */}
          <h1 className="font-display text-display-md sm:text-display-lg text-balance uppercase">
            {/* The line break is part of the copy, so translators control it —
                a hardcoded <br /> would not survive a Hindi rewrite. */}
            {t('home.title')
              .split('\n')
              .map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
          </h1>

          <p className="text-ink-secondary text-body-lg mt-6 max-w-lg">
            {t('home.description')}
          </p>

          {/* Dual CTA: player path and venue path, the way the market expects. */}
          <div className="mt-10 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/arenas">
                {t('home.bookCta')} <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/partner">{t('home.listVenueCta')}</Link>
            </Button>
          </div>
        </div>

        <TonightPanel className="lg:col-span-2" />
      </div>
    </section>
  );
}

const LOOP_STEPS = [
  { n: '01', key: 'book' },
  { n: '02', key: 'play' },
  { n: '03', key: 'score' },
  { n: '04', key: 'rank' },
  { n: '05', key: 'win' },
] as const;

function TheLoop() {
  return (
    <section className="border-line-subtle border-b px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-display-md uppercase">
          {t('home.loopTitlePrefix')}{' '}
          <span className="text-ink-muted">{t('home.loopTitleAccent')}</span>.
        </h2>

        {/* A numbered list, not icon-in-a-rounded-square cards (§8.1). */}
        <ol className="divide-line-subtle mt-10 divide-y">
          {LOOP_STEPS.map((step) => (
            <li key={step.n} className="flex gap-6 py-5">
              <span className="tabular font-display text-ink-muted w-10 shrink-0 text-xl">
                {step.n}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-ink text-lg uppercase">
                  {t(`home.steps.${step.key}.title`)}
                </h3>
                <p className="text-ink-secondary mt-1 text-sm">
                  {t(`home.steps.${step.key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ProofSection() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2">
        <div>
          <h2 className="font-display text-display-md mb-6 uppercase">{t('home.lastNight')}</h2>
          <ScoreStrip
            meta="Yesterday · 8:00 PM · Smash Point, Aliganj"
            home={{ name: 'Smash Bros', score: '21 · 19 · 21', isWinner: true }}
            away={{ name: 'Net Ninjas', score: '18 · 21 · 15', isWinner: false }}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <MatchStatusChip status="verified" />
            <PrizeBadge paise={90000} />
          </div>
        </div>

        <div>
          <h2 className="font-display text-display-md mb-6 uppercase">{t('home.cityTable')}</h2>
          <div className="divide-line-subtle divide-y">
            {SEED_PLAYERS.slice(0, 5).map((player, index) => (
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
          <Button variant="ghost" size="sm" className="mt-4" asChild>
            <Link href="/leaderboard">
              {t('common.fullTable')} <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
