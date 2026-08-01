import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

/**
 * Legal pages. Placeholders with the correct SCOPE, so nobody mistakes them
 * for finished policy — these must be written by a lawyer before real money
 * moves (compliance.md §9).
 *
 * The refund policy in particular MUST match Arena.cancellationPolicy in code;
 * that is the one most likely to drift.
 */
const PAGES = {
  terms: {
    title: 'Terms of Service',
    intro: 'The agreement between you and BoxArena when you book, play, or compete.',
    sections: [
      'Who can use BoxArena and account eligibility',
      'Booking, cancellation and no-show rules',
      'Match results, dual confirmation, and the finality of admin dispute decisions',
      'Wallet balances: deposits, winnings and bonus money',
      'Fair play: collusion, multi-accounting and score manipulation',
      'Limitation of liability and governing law (Lucknow jurisdiction)',
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'What we collect, why, and what you can ask us to delete. DPDP Act 2023 compliant.',
    sections: [
      'Data we collect: phone number, name, location, match history',
      'How we use it, and who we share it with (payment and SMS providers)',
      'Data stored in India (ap-south-1)',
      'Your right to access, correct and erase',
      'Why financial records are retained after account deletion',
      'Grievance Officer contact',
    ],
  },
  refunds: {
    title: 'Refunds & Cancellation',
    intro: 'When you get your money back, and how much.',
    sections: [
      'Free cancellation window, set per venue',
      'Partial refunds inside the window',
      'No refund once the slot has started',
      'Venue-initiated cancellations are always refunded in full',
      'How escrowed entry fees are returned if a match is voided',
      'Refund timelines to wallet and to bank',
    ],
  },
  'responsible-gaming': {
    title: 'Responsible Gaming',
    intro: 'Play should stay play. Tools to keep it that way.',
    sections: [
      'Monthly deposit limits you can set yourself',
      'Self-exclusion, and why it cannot be reversed early',
      'Seeing your true net position: deposits versus winnings',
      'Age verification: paid play is 18+',
      'Where to get help',
    ],
  },
  grievance: {
    title: 'Grievance Officer',
    intro: 'Statutory contact for complaints that our support team could not resolve.',
    sections: [
      'Name and designation of the Grievance Officer',
      'Email address and postal address',
      'Acknowledgement within 24 hours, resolution within 15 days',
      'Escalation path if you remain dissatisfied',
    ],
  },
} as const;

type LegalSlug = keyof typeof PAGES;

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = PAGES[slug as LegalSlug];
  return { title: page?.title ?? 'Legal' };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug as LegalSlug];
  if (!page) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="font-display text-display-md uppercase">{page.title}</h1>
      <p className="text-ink-secondary mt-3 text-base">{page.intro}</p>

      <div className="border-dispute/50 bg-dispute/10 mt-8 border p-4">
        <p className="text-dispute label-caps mb-1">Not yet drafted</p>
        <p className="text-ink-secondary text-sm">
          This policy must be written and reviewed by a lawyer before BoxArena handles real money.
          The scope below is what it needs to cover.
        </p>
      </div>

      <h2 className="font-display mt-10 mb-4 text-lg uppercase">What this will cover</h2>
      <ol className="divide-line-subtle border-line-subtle divide-y border-y">
        {page.sections.map((section, index) => (
          <li key={section} className="flex gap-4 py-3">
            <span className="tabular text-ink-muted w-6 shrink-0 text-sm">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="text-ink-secondary text-sm">{section}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
