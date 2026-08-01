import { cn } from '@/shared/lib/cn';

/**
 * One settings block: what it is on the left, the controls on the right.
 *
 * The description column is not decoration — most of these fields change what
 * players are charged or refunded, and a bare label with no consequence stated
 * is how a venue owner accidentally halves their weekend rate.
 */
export interface SettingsSectionProps {
  heading: string;
  body: string;
  /** Shown as a warning chip, e.g. "Super admin only". */
  restriction?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({
  heading,
  body,
  restriction,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section
      className={cn('border-line-subtle grid gap-6 border-b py-8 md:grid-cols-3', className)}
    >
      <div className="md:col-span-1">
        <h2 className="font-display text-base uppercase">{heading}</h2>
        <p className="text-ink-secondary mt-2 text-sm">{body}</p>
        {restriction ? (
          <p className="border-gold/40 text-gold rounded-chip mt-3 inline-block border px-2 py-1 text-xs">
            {restriction}
          </p>
        ) : null}
      </div>

      <div className="md:col-span-2">{children}</div>
    </section>
  );
}

/** A read-only key/value line for values ops changes elsewhere. */
export function SettingsRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="border-line-subtle flex items-start justify-between gap-6 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-ink text-sm">{label}</p>
        {hint ? <p className="text-ink-muted mt-0.5 text-xs">{hint}</p> : null}
      </div>
      <div className="text-ink shrink-0 text-sm tabular">{value}</div>
    </div>
  );
}
