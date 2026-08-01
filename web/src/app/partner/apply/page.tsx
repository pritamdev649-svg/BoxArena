import type { Metadata } from 'next';
import { PageHero } from '@/shared/ui/page-hero';
import { PartnerRegisterForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'List your venue',
  description: 'Six fields to get started. We call you the same day.',
};

/**
 * Task F4.1 — Stage 1 of arena_onboarding.md.
 *
 * SIX fields, deliberately. Anything longer loses people standing in a turf
 * office, and the wizard comes after the lead is captured — half the first
 * cohort drops off here and gets converted by a phone call (§3).
 */
export default function PartnerApplyPage() {
  return (
    <main>
      <PageHero
        eyebrow="Takes about three minutes"
        title="List your venue"
        description="Tell us the basics. We'll call you the same day, visit the venue, and get you live within a week."
        sport="football"
      />

      <section className="mx-auto w-full max-w-lg px-6 py-12">
        <PartnerRegisterForm />
      </section>
    </main>
  );
}
