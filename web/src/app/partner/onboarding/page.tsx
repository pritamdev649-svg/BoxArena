import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHero } from '@/shared/ui/page-hero';
import { getPartnerToken } from '@/shared/lib/panel-auth';
import { OnboardingWizard, getApplication } from '@/features/onboarding';

export const metadata: Metadata = { title: 'Finish listing your venue' };
export const dynamic = 'force-dynamic';

/**
 * Stage 2 of arena_onboarding.md — the resumable 7-step wizard.
 *
 * Before this existed, a venue went from "applied" to "live" entirely by ops
 * action: someone rang the owner and typed their courts, hours and bank
 * details in by hand. That works for the first ten venues and for no more
 * than that.
 */
export default async function PartnerOnboardingPage() {
  const token = await getPartnerToken();
  if (!token) redirect(`/partner/login?next=${encodeURIComponent('/partner/onboarding')}`);

  const application = await getApplication();

  return (
    <main>
      <PageHero
        eyebrow="Step by step, saved as you go"
        title="Finish listing your venue"
        description="Seven short steps. Close the tab whenever you need to — you'll pick up where you left off."
        sport="badminton"
      />

      <section className="mx-auto w-full max-w-2xl px-6 py-12">
        {application ? <OnboardingWizard application={application} /> : <NoApplication />}
      </section>
    </main>
  );
}

/** Signed in as a partner, but with nothing in progress to finish. */
function NoApplication() {
  return (
    <div className="border-line bg-surface border p-6">
      <h2 className="font-display text-lg uppercase">Nothing in progress</h2>
      <p className="text-ink-secondary mt-2 text-sm">
        We could not find an application against this account. If you have already been approved,
        your venue is managed from the{' '}
        <Link href="/partner" className="text-volt underline">
          partner panel
        </Link>
        . If you have not applied yet,{' '}
        <Link href="/partner/apply" className="text-volt underline">
          start here
        </Link>
        .
      </p>
    </div>
  );
}
