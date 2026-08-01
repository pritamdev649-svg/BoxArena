import type { Metadata } from 'next';
import { AuthCard, OtpForm } from '@/features/auth';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('auth.metaTitle') };

/** Task B3 client. Phone + OTP is the only auth path (api_contract.md §1). */
export default function LoginPage() {
  return (
    <AuthCard
      title={t('auth.title')}
      description={t('auth.description')}
      footnote={t('auth.terms')}
    >
      <OtpForm action="/" />
    </AuthCard>
  );
}

