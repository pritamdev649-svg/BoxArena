import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { RegisterOfficialForm } from '@/features/officials';
import { t } from '@/shared/i18n';

export const metadata: Metadata = { title: t('officials.metaTitle') };
export const dynamic = 'force-dynamic';

/** Public-facing sign-up for officials (featuredoc/11 §OF1). */
export default async function RegisterOfficialPage() {
  const token = await getPlayerToken();
  if (!token) redirect(`/login?next=${encodeURIComponent('/officials/register')}`);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-display text-display-md uppercase">{t('officials.title')}</h1>
        <p className="text-ink-secondary mt-2 text-sm">{t('officials.description')}</p>
      </header>

      <RegisterOfficialForm />
    </main>
  );
}
