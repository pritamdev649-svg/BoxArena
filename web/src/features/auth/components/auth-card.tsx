import Link from 'next/link';
import { HeroCourtBackdrop } from '@/shared/ui/court-graphics';
import { Logo } from '@/shared/ui/logo';

/**
 * The frame every sign-in surface sits in. One component so the player,
 * venue and ops entrances stay visually identical — three different login
 * screens is how a product starts feeling assembled rather than designed.
 */
export interface AuthCardProps {
  eyebrow?: string;
  title: string;
  description: string;
  footnote?: string;
  /** Secondary path out of this screen, e.g. register vs sign in. */
  alternate?: { prompt: string; label: string; href: string };
  children: React.ReactNode;
}

export function AuthCard({
  eyebrow,
  title,
  description,
  footnote,
  alternate,
  children,
}: AuthCardProps) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <HeroCourtBackdrop />

      <div className="border-line-subtle bg-surface relative w-full max-w-md border p-8">
        <Logo className="text-xl" />

        {eyebrow ? <p className="label-caps text-volt-ink mt-6">{eyebrow}</p> : null}

        <h1 className="font-display mt-2 text-2xl uppercase">{title}</h1>
        <p className="text-ink-secondary mt-2 text-sm">{description}</p>

        {children}

        {alternate ? (
          <p className="text-ink-secondary mt-6 text-sm">
            {alternate.prompt}{' '}
            <Link href={alternate.href} className="text-volt-ink font-medium hover:underline">
              {alternate.label}
            </Link>
          </p>
        ) : null}

        {footnote ? <p className="text-ink-muted mt-6 text-xs">{footnote}</p> : null}
      </div>
    </main>
  );
}
