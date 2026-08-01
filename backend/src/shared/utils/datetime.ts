import { TZDate } from '@date-fns/tz';
import { addDays, addMinutes, format, startOfDay } from 'date-fns';

/**
 * India has no DST, so timezone bugs here are latent rather than loud — which
 * makes them worse. Instants are UTC; IST is a display/derivation concern only
 * (edge_cases.md §17).
 */
export const IST = 'Asia/Kolkata';

/** The IST calendar day an instant falls on: "2026-08-14". */
export function toLocalDate(instant: Date): string {
  return format(new TZDate(instant, IST), 'yyyy-MM-dd');
}

/** IST day-of-week, 0=Sunday. Slot templates are keyed on this. */
export function istDayOfWeek(instant: Date): number {
  return new TZDate(instant, IST).getDay();
}

/**
 * Builds a UTC instant from an IST calendar date and "HH:mm".
 * NEVER build times by string concatenation.
 */
export function istDateTimeToUtc(localDate: string, time: string): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Invalid localDate: ${localDate}`);
  }
  if (hh === undefined || mm === undefined) throw new Error(`Invalid time: ${time}`);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, IST).getTime());
}

/** The IST wall-clock time an instant falls on: "18:00". */
export function istTimeOfDay(instant: Date): string {
  return format(new TZDate(instant, IST), 'HH:mm');
}

/** Start of an IST calendar day, as a UTC instant. */
export function istStartOfDay(instant: Date): Date {
  return new Date(startOfDay(new TZDate(instant, IST)).getTime());
}

export function minutesFromNow(minutes: number, from: Date = new Date()): Date {
  return addMinutes(from, minutes);
}

export function daysFromNow(days: number, from: Date = new Date()): Date {
  return addDays(from, days);
}

export function parseTimeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number);
  if (hh === undefined || mm === undefined) throw new Error(`Invalid time: ${time}`);
  return hh * 60 + mm;
}
