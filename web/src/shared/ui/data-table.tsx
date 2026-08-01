import { cn } from '@/shared/lib/cn';

/**
 * Table shell used by both panels.
 *
 * Hairline rules and aligned columns rather than a bordered card per row —
 * an ops table is read by scanning down a column, and card chrome actively
 * fights that (design_system.md §8.3).
 *
 * Scrolls inside its own container so the page body never scrolls sideways.
 */
export function DataTable({
  headings,
  children,
  className,
}: {
  headings: { label: string; className?: string }[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-line-subtle border-b">
            {headings.map((heading) => (
              <th
                key={heading.label}
                scope="col"
                className={cn(
                  'label-caps text-ink-muted px-3 py-2 text-left font-semibold',
                  heading.className,
                )}
              >
                {heading.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-line-subtle divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-ink-muted px-3 py-10 text-center text-sm">
        {message}
      </td>
    </tr>
  );
}
