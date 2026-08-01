import type { Metadata } from 'next';
import { AuthCard, OtpForm } from '@/features/auth';
import { t } from '@/shared/i18n';

export const metadata: Metadata = {
  title: t('adminAuth.metaTitle'),
  /** Ops surfaces must never be indexed. */
  robots: { index: false, follow: false },
};

/**
 * Ops entrance. Same OTP path, but the copy sets the expectation up front that
 * actions here are attributable — the audit trail is not a surprise you
 * discover later.
 */
export default function AdminLoginPage() {
  return (
    <AuthCard
      eyebrow={t('panel.adminTitle')}
      title={t('adminAuth.title')}
      description={t('adminAuth.description')}
      footnote={t('adminAuth.restricted')}
    >
      <OtpForm action="/admin" />
    </AuthCard>
  );
}
