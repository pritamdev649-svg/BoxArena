import { cn } from '@/shared/lib/cn';

/**
 * Sport graphics as COURT MARKINGS, not clip art.
 *
 * The design system bans mascots and cartoon illustration — they undercut a
 * product people stake money on (design_system.md §1, §8.1). Real court
 * geometry is the honest alternative: it is sport-specific, instantly
 * recognisable to a player, and is literally the thing being booked.
 *
 * All strokes use `currentColor` so a parent sets the sport accent and the
 * whole diagram follows. Pure SVG — no external assets, no CSP issues.
 */

interface CourtProps {
  className?: string;
  /** Line weight relative to the viewBox. */
  strokeWidth?: number;
}

/** BWF singles/doubles court, viewed from above. 6.1m x 13.4m ≈ 61:134. */
export function BadmintonCourt({ className, strokeWidth = 1.2 }: CourtProps) {
  return (
    <svg
      viewBox="0 0 61 134"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={cn('h-auto w-full', className)}
      aria-hidden
      focusable="false"
    >
      {/* Outer doubles boundary */}
      <rect x="0.6" y="0.6" width="59.8" height="132.8" />
      {/* Singles side lines */}
      <line x1="4.6" y1="0.6" x2="4.6" y2="133.4" />
      <line x1="56.4" y1="0.6" x2="56.4" y2="133.4" />
      {/* Net */}
      <line x1="0.6" y1="67" x2="60.4" y2="67" strokeDasharray="2 2" />
      {/* Short service lines */}
      <line x1="0.6" y1="52" x2="60.4" y2="52" />
      <line x1="0.6" y1="82" x2="60.4" y2="82" />
      {/* Long service line, doubles */}
      <line x1="0.6" y1="8" x2="60.4" y2="8" />
      <line x1="0.6" y1="126" x2="60.4" y2="126" />
      {/* Centre line, splitting the service courts */}
      <line x1="30.5" y1="0.6" x2="30.5" y2="52" />
      <line x1="30.5" y1="82" x2="30.5" y2="133.4" />
    </svg>
  );
}

/** Five-a-side turf, viewed from above. */
export function FootballPitch({ className, strokeWidth = 1.2 }: CourtProps) {
  return (
    <svg
      viewBox="0 0 100 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={cn('h-auto w-full', className)}
      aria-hidden
      focusable="false"
    >
      <rect x="0.6" y="0.6" width="98.8" height="62.8" />
      {/* Halfway line and centre circle */}
      <line x1="50" y1="0.6" x2="50" y2="63.4" />
      <circle cx="50" cy="32" r="9" />
      <circle cx="50" cy="32" r="1" fill="currentColor" stroke="none" />
      {/* Penalty areas */}
      <rect x="0.6" y="18" width="14" height="28" />
      <rect x="85.4" y="18" width="14" height="28" />
      {/* Six-yard boxes */}
      <rect x="0.6" y="26" width="5" height="12" />
      <rect x="94.4" y="26" width="5" height="12" />
      {/* Corner arcs */}
      <path d="M0.6 4.6 A4 4 0 0 0 4.6 0.6" />
      <path d="M95.4 0.6 A4 4 0 0 0 99.4 4.6" />
      <path d="M4.6 63.4 A4 4 0 0 0 0.6 59.4" />
      <path d="M99.4 59.4 A4 4 0 0 0 95.4 63.4" />
    </svg>
  );
}

/** Box cricket cage: netted enclosure with the pitch strip and creases. */
export function CricketPitch({ className, strokeWidth = 1.2 }: CourtProps) {
  return (
    <svg
      viewBox="0 0 64 110"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={cn('h-auto w-full', className)}
      aria-hidden
      focusable="false"
    >
      {/* Cage boundary */}
      <rect x="0.6" y="0.6" width="62.8" height="108.8" />
      {/* Pitch strip */}
      <rect x="24" y="14" width="16" height="82" />
      {/* Batting and bowling creases */}
      <line x1="18" y1="24" x2="46" y2="24" />
      <line x1="18" y1="86" x2="46" y2="86" />
      <line x1="20" y1="20" x2="44" y2="20" />
      <line x1="20" y1="90" x2="44" y2="90" />
      {/* Stumps */}
      <g strokeLinecap="round">
        <line x1="29" y1="20" x2="29" y2="24" />
        <line x1="32" y1="20" x2="32" y2="24" />
        <line x1="35" y1="20" x2="35" y2="24" />
        <line x1="29" y1="86" x2="29" y2="90" />
        <line x1="32" y1="86" x2="32" y2="90" />
        <line x1="35" y1="86" x2="35" y2="90" />
      </g>
      {/* Return creases */}
      <line x1="24" y1="20" x2="24" y2="28" />
      <line x1="40" y1="20" x2="40" y2="28" />
      <line x1="24" y1="82" x2="24" y2="90" />
      <line x1="40" y1="82" x2="40" y2="90" />
    </svg>
  );
}

export type SportKey = 'cricket' | 'football' | 'badminton';

const COURT_BY_SPORT = {
  cricket: CricketPitch,
  football: FootballPitch,
  badminton: BadmintonCourt,
} as const;

export function SportCourt({ sport, ...props }: CourtProps & { sport: SportKey }) {
  const Court = COURT_BY_SPORT[sport];
  return <Court {...props} />;
}

/**
 * Decorative hero backdrop: the three court types overlapped at low opacity.
 *
 * Deliberately faint. It gives the hero texture and says "sports venue"
 * without competing with the headline — decoration must never out-shout the
 * one thing the page is asking you to do (§2, rule 1).
 */
export function HeroCourtBackdrop({ className }: { className?: string }) {
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
    >
      <BadmintonCourt
        strokeWidth={0.7}
        className="text-badminton absolute -top-16 -right-8 w-44 rotate-12 opacity-[0.16] sm:w-56"
      />
      <FootballPitch
        strokeWidth={0.7}
        className="text-football absolute -bottom-14 -left-20 w-72 -rotate-6 opacity-[0.13] sm:w-96"
      />
      <CricketPitch
        strokeWidth={0.7}
        className="text-cricket absolute top-1/3 right-1/4 hidden w-40 -rotate-12 opacity-[0.10] lg:block"
      />
    </div>
  );
}
