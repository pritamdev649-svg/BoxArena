import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiFetchSafe } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { MoneyText } from '@/shared/ui/money-text';
import { Button } from '@/shared/ui/button';
import { PlayerProfile, type SportStats } from '@/features/players';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('player.yourProfile') };
export const dynamic = 'force-dynamic';

interface Me {
  publicId: string;
  fullName: string;
  avatarUrl?: string;
  primarySport?: string;
  skillLevel?: string;
  homeAreaName?: string;
  wallet: {
    depositPaise: number;
    winningsPaise: number;
    bonusPaise: number;
    lockedPaise: number;
  };
}

/**
 * Your own profile.
 *
 * Shares the public record component, then adds the things only you may see —
 * the wallet buckets. Separate from `/players/[publicId]` rather than
 * branching inside it, so there is no path where private balances could leak
 * onto a page someone shared.
 */
export default async function ProfilePage() {
  const token = await getPlayerToken();
  if (!token) redirect(`/login?next=${encodeURIComponent('/profile')}`);

  const [me, stats] = await Promise.all([
    apiFetchSafe<Me>(API_ENDPOINTS.usersMe, { token }),
    apiFetchSafe<SportStats[]>('/users/me/stats', { token }),
  ]);
  if (!me) redirect('/login');

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <PlayerProfile player={{ ...me, stats: stats ?? [] }} />

      <Wallet wallet={me.wallet} />

      <Button variant="ghost" size="sm" className="mt-8" asChild>
        <Link href={`/players/${me.publicId}`}>{t('player.publicView')}</Link>
      </Button>
    </main>
  );
}

function Wallet({ wallet }: { wallet: Me['wallet'] }) {
  return (
    <section className="border-line-subtle mt-10 border-t pt-6">
      <h2 className="label-caps text-ink-muted mb-3">{t('player.walletHeading')}</h2>

      <dl className="divide-line-subtle border-line-subtle divide-y border-y text-sm">
        <Line label={t('player.deposit')} paise={wallet.depositPaise} />
        <Line label={t('player.winnings')} paise={wallet.winningsPaise} />
        <Line label={t('player.bonus')} paise={wallet.bonusPaise} />
        {wallet.lockedPaise > 0 ? (
          <Line label={t('player.locked')} paise={wallet.lockedPaise} muted />
        ) : null}
      </dl>

      {/* Stated plainly: bonus money is playable but never withdrawable. */}
      <p className="text-ink-muted mt-3 text-xs">{t('player.bonusNote')}</p>
    </section>
  );
}

function Line({ label, paise, muted }: { label: string; paise: number; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <dt className={muted ? 'text-ink-muted' : 'text-ink-secondary'}>{label}</dt>
      <dd>
        <MoneyText paise={paise} tone={muted ? 'muted' : 'default'} className="font-medium" />
      </dd>
    </div>
  );
}
