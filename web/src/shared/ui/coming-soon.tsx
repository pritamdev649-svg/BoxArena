import Link from 'next/link';
import { Button } from './button';

/**
 * Honest placeholder for a route that exists in navigation but is not built.
 *
 * Deliberately NOT a blank page or a 404: the link is real and the feature is
 * planned, so the page states what it will do and where the work stands. An
 * undesigned dead end is the fastest way to make a product feel abandoned
 * (design_system.md §8.5).
 */
export function ComingSoon({
  title,
  description,
  covers,
  backHref,
  backLabel,
}: {
  title: string;
  description: string;
  covers: string[];
  backHref: string;
  backLabel: string;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="font-display text-display-md uppercase">{title}</h1>
      <p className="text-ink-secondary mt-3">{description}</p>

      <h2 className="label-caps text-ink-muted mt-10 mb-3">This screen will let you</h2>
      <ul className="divide-line-subtle border-line-subtle divide-y border-y">
        {covers.map((item) => (
          <li key={item} className="text-ink-secondary py-3 text-sm">
            {item}
          </li>
        ))}
      </ul>

      <Button variant="secondary" className="mt-8" asChild>
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </main>
  );
}
