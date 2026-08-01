import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes so later ones win, without specificity fights. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
