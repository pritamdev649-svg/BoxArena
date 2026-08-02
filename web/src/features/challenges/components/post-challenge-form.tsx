'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { MoneyText } from '@/shared/ui/money-text';
import { formatDayAndTime } from '@/shared/lib/datetime';
import { t } from '@/shared/i18n';
import { createChallengeAction, quoteAction, type QuoteResult } from '../actions';

/**
 * Posting a challenge (task F3.2).
 *
 * The screen that closed the loop: every challenge before this existed because
 * someone ran a script. Four decisions, in the order a player makes them —
 * which booking, which team, how much, then confirm against a live quote.
 */
export interface PostableBooking {
  publicId: string;
  sport: string;
  startAt: string;
  totalPaise: number;
  arenaName: string | null;
}

export interface OwnTeam {
  publicId: string;
  name: string;
  sport: string;
  format: string;
}

export function PostChallengeForm({
  bookings,
  teams,
  suggestedTeamName,
}: {
  bookings: PostableBooking[];
  teams: OwnTeam[];
  suggestedTeamName: string;
}) {
  const form = useChallengeForm({ bookings, teams, suggestedTeamName });

  if (bookings.length === 0) return <NoBookings />;

  const { bookingId, setBookingId, teamId, setTeamId, newTeamName, setNewTeamName } = form;
  const { rupees, setRupees, pending, error, quote, submit } = form;

  return (
    <form onSubmit={submit} className="space-y-8">
      <BookingPicker bookings={bookings} value={bookingId} onChange={setBookingId} />

      <TeamPicker
        teams={teams}
        value={teamId}
        onChange={setTeamId}
        newTeamName={newTeamName}
        onNewTeamName={setNewTeamName}
      />

      <section>
        <h2 className="label-caps text-ink-muted mb-2">{t('postChallenge.feeHeading')}</h2>
        <Input
          label={t('postChallenge.feeLabel')}
          type="number"
          min={0}
          step={50}
          value={rupees}
          onChange={(event) => setRupees(event.target.value)}
          className="tabular"
        />
        <p className="text-ink-muted mt-2 text-xs">{t('postChallenge.feeHint')}</p>
      </section>

      {quote ? <QuotePanel quote={quote} onUseMinimum={(paise) => setRupees(String(paise / 100))} /> : null}

      {error ? <p className="text-loss text-sm">{error}</p> : null}

      <Button type="submit" size="lg" disabled={pending || !bookingId}>
        {pending ? t('postChallenge.posting') : t('postChallenge.post')}
      </Button>
    </form>
  );
}

/** All the form's state and its submit, so the component stays markup. */
function useChallengeForm(input: {
  bookings: PostableBooking[];
  teams: OwnTeam[];
  suggestedTeamName: string;
}) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState(input.bookings[0]?.publicId ?? '');
  const [teamId, setTeamId] = useState<string>(input.teams[0]?.publicId ?? '');
  const [newTeamName, setNewTeamName] = useState(input.suggestedTeamName);
  const [rupees, setRupees] = useState('0');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const booking = input.bookings.find((row) => row.publicId === bookingId);
  const entryFeePaise = Math.max(0, Math.round(Number(rupees) * 100));
  const quote = useQuote(booking?.totalPaise ?? 0, entryFeePaise);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(undefined);

    const result = await createChallengeAction({
      bookingPublicId: bookingId,
      teamPublicId: teamId || null,
      newTeamName,
      sport: booking?.sport ?? 'badminton',
      /** Singles is the only competitive format open today. */
      format: 'singles',
      entryFeePaise,
    });

    setPending(false);
    if (!result.success) {
      setError(result.error ?? t('postChallenge.failed'));
      return;
    }
    router.push(`/challenges/${result.challengePublicId ?? ''}`);
  };

  return {
    bookingId, setBookingId, teamId, setTeamId, newTeamName, setNewTeamName,
    rupees, setRupees, pending, error, quote, submit,
  };
}

/** Re-quotes as the fee changes. Debounced — this fires on every keystroke. */
function useQuote(venueFeePaise: number, entryFeePaise: number): QuoteResult | null {
  const [quote, setQuote] = useState<QuoteResult | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      void quoteAction({ venueFeePaise, officialFeePaise: 0, entryFeePaise }).then(setQuote);
    }, 300);
    return () => clearTimeout(timer);
  }, [venueFeePaise, entryFeePaise]);

  return quote;
}

function BookingPicker({
  bookings,
  value,
  onChange,
}: {
  bookings: PostableBooking[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <section>
      <h2 className="label-caps text-ink-muted mb-2">{t('postChallenge.bookingHeading')}</h2>
      <div className="space-y-2">
        {bookings.map((booking) => (
          <button
            key={booking.publicId}
            type="button"
            onClick={() => onChange(booking.publicId)}
            aria-pressed={value === booking.publicId}
            className={
              value === booking.publicId
                ? 'border-volt bg-volt/5 block w-full border p-3 text-left'
                : 'border-line-subtle bg-surface hover:border-line-strong block w-full border p-3 text-left'
            }
          >
            <span className="text-ink block text-sm font-medium">
              {booking.arenaName ?? t('postChallenge.aVenue')} · {booking.sport}
            </span>
            <span className="text-ink-muted block text-xs">
              {formatDayAndTime(booking.startAt)} · <MoneyText paise={booking.totalPaise} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * Team choice, with creation folded in.
 *
 * For badminton singles a team is one person, so making someone build a roster
 * before they can post is ceremony. If they have no team we pre-fill their own
 * name and create it on submit.
 */
function TeamPicker({
  teams,
  value,
  onChange,
  newTeamName,
  onNewTeamName,
}: {
  teams: OwnTeam[];
  value: string;
  onChange: (next: string) => void;
  newTeamName: string;
  onNewTeamName: (next: string) => void;
}) {
  return (
    <section>
      <h2 className="label-caps text-ink-muted mb-2">{t('postChallenge.teamHeading')}</h2>

      {teams.length > 0 ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="border-line text-ink bg-surface rounded-control h-11 w-full border px-3 text-sm outline-none"
        >
          {teams.map((team) => (
            <option key={team.publicId} value={team.publicId}>
              {team.name}
            </option>
          ))}
          <option value="">{t('postChallenge.newTeam')}</option>
        </select>
      ) : null}

      {value === '' || teams.length === 0 ? (
        <div className="mt-3">
          <Input
            label={t('postChallenge.teamNameLabel')}
            value={newTeamName}
            onChange={(event) => onNewTeamName(event.target.value)}
            maxLength={40}
            required
          />
          <p className="text-ink-muted mt-2 text-xs">{t('postChallenge.teamNameHint')}</p>
        </div>
      ) : null}
    </section>
  );
}

/** MM1/MM2: the pool, and a warning when the winner would not profit. */
function QuotePanel({
  quote,
  onUseMinimum,
}: {
  quote: QuoteResult;
  onUseMinimum: (paise: number) => void;
}) {
  return (
    <section className="border-line-subtle bg-surface border p-4">
      <dl className="space-y-2 text-sm">
        <Row label={t('postChallenge.yourCost')} paise={quote.creatorTotalCostPaise} />
        <Row label={t('postChallenge.opponentCost')} paise={quote.perTeamCostPaise} />
        <Row label={t('challengeMoney.netPool')} paise={quote.netPrizePoolPaise} strong />
        <Row label={t('challengeMoney.ifYouWin')} paise={quote.winnerNetProfitPaise} />
      </dl>

      {quote.winnerProfitIsLow && quote.suggestedMinimumEntryFeePaise > 0 ? (
        <div className="border-dispute/40 bg-dispute/10 rounded-control mt-4 border p-3">
          <p className="text-dispute text-sm font-medium">{t('challengeMoney.lowProfit')}</p>
          <button
            type="button"
            onClick={() => onUseMinimum(quote.suggestedMinimumEntryFeePaise)}
            className="text-volt-ink mt-1 text-xs underline"
          >
            {t('postChallenge.useMinimum')}{' '}
            <MoneyText paise={quote.suggestedMinimumEntryFeePaise} />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Row({ label, paise, strong }: { label: string; paise: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className={strong ? 'text-ink font-medium' : 'text-ink-secondary'}>{label}</dt>
      <dd>
        <MoneyText paise={paise} className={strong ? 'font-semibold' : ''} />
      </dd>
    </div>
  );
}

function NoBookings() {
  return (
    <div className="border-line-subtle border border-dashed p-8 text-center">
      <p className="text-ink text-sm font-medium">{t('postChallenge.noBookingsTitle')}</p>
      <p className="text-ink-secondary mx-auto mt-2 max-w-sm text-sm">
        {t('postChallenge.noBookingsBody')}
      </p>
      <Button className="mt-4" asChild>
        <Link href="/arenas">{t('checkout.browseArenas')}</Link>
      </Button>
    </div>
  );
}
