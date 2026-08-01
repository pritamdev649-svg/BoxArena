import type { Metadata } from 'next';
import { AuthCard, OtpForm } from '@/features/auth';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('partnerAuth.metaTitle') };

/**
 * Venue entrance. Same phone + OTP as players — a separate credential system
 * for owners would mean a second thing to lose. The role on the account
 * decides which panel they land in, and the API scopes every response to the
 * arenas they actually manage regardless of what the UI shows.
 */
export default function PartnerLoginPage() {
  return (
    <AuthCard
      eyebrow={t('panel.partnerTitle')}
      title={t('partnerAuth.title')}
      description={t('partnerAuth.description')}
      alternate={{
        prompt: t('partnerAuth.noAccount'),
        label: t('partnerAuth.registerLink'),
        href: '/partner/register',
      }}
      footnote={t('partnerAuth.staffNote')}
    >
      <OtpForm action="/partner/dashboard" />
    </AuthCard>
  );
}
