import { cn } from '@/shared/lib/cn';
import { HeroCourtBackdrop, SportCourt, type SportKey } from './court-graphics';

/**
 * Shared hero for interior pages. Keeps every page's top edge consistent so
 * the site reads as one product, and carries the sport court graphics.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  sport,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  /** Renders a single sport's court instead of the mixed backdrop. */
  sport?: SportKey;
  children?: React.ReactNode;
}) {
  return (
    <section className="border-line-subtle relative overflow-hidden border-b px-6 py-14 md:py-20">
      {sport ? <SingleCourtBackdrop sport={sport} /> : <HeroCourtBackdrop />}

      <div className="relative mx-auto max-w-5xl">
        <p className="label-caps text-volt-ink mb-4">{eyebrow}</p>
        <h1 className="font-display text-display-lg uppercase">{title}</h1>
        {description ? (
          <p className="text-ink-secondary mt-4 max-w-xl text-base">{description}</p>
        ) : null}
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}

function SingleCourtBackdrop({ sport }: { sport: SportKey }) {
  const accent = {
    cricket: 'text-cricket',
    football: 'text-football',
    badminton: 'text-badminton',
  }[sport];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <SportCourt
        sport={sport}
        strokeWidth={0.7}
        className={cn(
          'absolute -top-10 -right-10 w-56 rotate-12 opacity-[0.14] sm:w-72',
          accent,
        )}
      />
    </div>
  );
}
