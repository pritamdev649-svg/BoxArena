import { cn } from '@/shared/lib/cn';

/**
 * Wordmark. No icon, no mascot — the name set in the display face is the
 * mark. A generic sports clip-art logo would undercut the whole positioning
 * (design_system.md §1).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('font-display text-lg tracking-tight uppercase', className)}>
      Box<span className="text-volt-ink">Arena</span>
    </span>
  );
}
