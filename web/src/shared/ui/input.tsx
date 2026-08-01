import { useId } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * The single text input primitive. Screens compose this — they never hand-roll
 * a <label> + <input> pair, because that is how accessibility wiring and error
 * states drift apart across a codebase (code_standards.md §1).
 *
 * Handles: label association, hint/error wiring via aria-describedby,
 * aria-invalid, prefix/suffix slots, and the 44px touch floor.
 */

/** `prefix` is a real (RDFa) HTML attribute typed as string — ours shadows it. */
export interface InputProps extends Omit<React.ComponentProps<'input'>, 'size' | 'prefix'> {
  label: string;
  /** Helper text below the field. Replaced by `error` when one is present. */
  hint?: string;
  error?: string;
  /** Static leading content, e.g. a "+91" dial code. Not editable. */
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  /** Visually hides the label but keeps it for screen readers. */
  hideLabel?: boolean;
  containerClassName?: string;
}

export function Input({
  label,
  hint,
  error,
  prefix,
  suffix,
  hideLabel = false,
  containerClassName,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className={containerClassName}>
      <label
        htmlFor={inputId}
        className={cn('label-caps text-ink-muted mb-2 block', hideLabel && 'sr-only')}
      >
        {label}
      </label>

      <div
        className={cn(
          'flex items-center border transition-colors duration-150',
          error ? 'border-loss' : 'border-line focus-within:border-line-strong',
          className,
        )}
      >
        {prefix ? <Affix side="start">{prefix}</Affix> : null}

        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className="text-ink placeholder:text-ink-muted h-11 w-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
          {...props}
        />

        {suffix ? <Affix side="end">{suffix}</Affix> : null}
      </div>

      <FieldMessage id={messageId} message={message} isError={Boolean(error)} />
    </div>
  );
}

function Affix({ side, children }: { side: 'start' | 'end'; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'text-ink-muted tabular shrink-0 px-3 text-sm',
        side === 'start' ? 'border-line-subtle border-r py-2.5' : '',
      )}
    >
      {children}
    </span>
  );
}

function FieldMessage({
  id,
  message,
  isError,
}: {
  id: string;
  /** Explicitly `| undefined`, not optional — exactOptionalPropertyTypes
      distinguishes "absent" from "present and undefined". */
  message: string | undefined;
  isError: boolean;
}) {
  if (!message) return null;

  return (
    <p
      id={id}
      /* role=alert so a screen reader announces a validation failure. */
      {...(isError ? { role: 'alert' } : {})}
      className={cn('mt-2 text-xs', isError ? 'text-loss' : 'text-ink-muted')}
    >
      {message}
    </p>
  );
}
