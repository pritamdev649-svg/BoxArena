import type { Metadata } from 'next';
import { AuthCard, PartnerRegisterForm } from '@/features/auth';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('partnerAuth.registerMetaTitle') };

export default function PartnerRegisterPage() {
  return (
    <AuthCard
      eyebrow={t('panel.partnerTitle')}
      title={t('partnerAuth.registerTitle')}
      description={t('partnerAuth.registerDescription')}
      alternate={{
        prompt: t('partnerAuth.haveAccount'),
        label: t('partnerAuth.signInLink'),
        href: '/partner/login',
      }}
    >
      <PartnerRegisterForm />
    </AuthCard>
  );
}
