import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/shared/lib/cn';

/**
 * Volt is for ACTION, never decoration — one primary button per view
 * (design_system.md §2). Radius is squared-off, not pill: pills read
 * consumer-casual, squared reads tool (§4).
 *
 * Active states matter as much as hover — half our users are on touch and
 * will never hover (§8.5).
 */
const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-medium transition-colors duration-150',
    'disabled:pointer-events-none disabled:opacity-40',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-volt text-ink-inverse hover:bg-volt-400 active:bg-volt-600 font-semibold',
        secondary:
          'bg-elevated text-ink border border-line hover:border-line-strong hover:bg-elevated/80 active:bg-elevated',
        ghost: 'text-ink-secondary hover:bg-elevated hover:text-ink active:bg-elevated/70',
        danger: 'bg-loss text-ink hover:bg-loss/90 active:bg-loss/80 font-semibold',
      },
      size: {
        /** 44px — the accessibility floor for touch (§9). */
        default: 'h-11 rounded-control px-5 text-sm [&_svg]:size-4',
        lg: 'h-12 rounded-control px-7 text-base [&_svg]:size-5',
        sm: 'h-9 rounded-chip px-3 text-sm [&_svg]:size-4',
        icon: 'size-11 rounded-control [&_svg]:size-5',
      },
      fullWidth: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Renders the child element instead of a <button> — for links that look like buttons. */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp className={cn(buttonVariants({ variant, size, fullWidth }), className)} {...props} />
  );
}

export { buttonVariants };
