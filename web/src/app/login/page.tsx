import type { Metadata } from 'next';
import { AuthCard, OtpForm } from '@/features/auth';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('auth.metaTitle') };

/**
 * Only same-origin paths are honoured.
 *
 * `next` arrives from the query string, so it is attacker-controlled: without
 * this check a link to /login?next=https://evil.example would bounce a freshly
 * authenticated player straight off our domain. `//host` is rejected too — it
 * is protocol-relative and reads as a path but is not one.
 */
function safeNext(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return '/';
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/';
  return candidate;
}

/** Task B3 client. Phone + OTP is the only auth path (api_contract.md §1). */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <AuthCard
      title={t('auth.title')}
      description={t('auth.description')}
      footnote={t('auth.terms')}
    >
      <OtpForm action={safeNext(params['next'])} />
    </AuthCard>
  );
}
