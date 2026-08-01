import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHero } from '@/shared/ui/page-hero';
import { Button } from '@/shared/ui/button';

export const metadata: Metadata = {
  title: 'How payouts work',
  description: 'Commission, settlement timing and what BoxArena costs a venue.',
};

const STEPS = [
  { n: '01', title: 'A player books', body: 'They pay from their BoxArena wallet, or a deposit now and the balance at your gate if you allow pay-at-venue.' },
  { n: '02', title: 'We hold the money', body: 'Funds sit with us until the slot has been played. If the booking is cancelled inside your policy window, the refund comes out of that, not out of your next payout.' },
  { n: '03', title: 'We settle weekly', body: 'Every Monday we pay out the previous week, T+3 after each slot date. Straight to your bank account or UPI.' },
  { n: '04', title: 'You see the breakdown', body: 'Gross, our commission, any refunds, and the net figure — with the exact bookings behind each number.' },
] as const;

export default function PartnerPricingPage() {
  return (
    <main>
      <PageHero
        eyebrow="For venue owners"
        title="How payouts work"
        description="No setup fee, no monthly minimum, no lock-in. We only make money when you do."
        sport="cricket"
      />

      <CostGrid />

      <section className="px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-display-md mb-8 uppercase">The money flow</h2>
          <ol className="divide-line-subtle divide-y">
            {STEPS.map((step) => (
              <li key={step.n} className="flex gap-6 py-5">
                <span className="tabular font-display text-ink-muted w-10 shrink-0 text-xl">
                  {step.n}
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-ink text-lg uppercase">{step.title}</h3>
                  <p className="text-ink-secondary mt-1 text-sm">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <Button size="lg" className="mt-10" asChild>
            <Link href="/partner/apply">List your venue</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function CostGrid() {
  return (
      <section className="border-line-subtle border-b px-6 py-14">
        <div className="mx-auto max-w-3xl">
          <dl className="grid gap-8 sm:grid-cols-3">
            <div>
              <dt className="label-caps text-ink-muted">Commission</dt>
              <dd className="font-display tabular text-ink mt-2 text-3xl">10%</dd>
              <dd className="text-ink-secondary mt-1 text-sm">
                On online bookings only. Walk-ins your desk records are free.
              </dd>
            </div>
            <div>
              <dt className="label-caps text-ink-muted">Setup</dt>
              <dd className="font-display tabular text-ink mt-2 text-3xl">₹0</dd>
              <dd className="text-ink-secondary mt-1 text-sm">
                No onboarding cost and no hardware to buy.
              </dd>
            </div>
            <div>
              <dt className="label-caps text-ink-muted">Settlement</dt>
              <dd className="font-display text-ink mt-2 text-3xl">Weekly</dd>
              <dd className="text-ink-secondary mt-1 text-sm">Every Monday, T+3 after the slot.</dd>
            </div>
          </dl>
        </div>
      </section>
  );
}
