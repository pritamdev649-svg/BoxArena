/**
 * Date/time. India has no DST, so timezone bugs here are latent rather than
 * loud — which makes them worse, not better.
 *
 * Rules (edge_cases.md §17):
 *  - Instants are stored and transported as UTC ISO strings.
 *  - Display is always IST, regardless of the viewer's device timezone.
 *    Someone browsing Lucknow arenas from Dubai must see IST slot times.
 *  - Never build a time by string concatenation.
 */

import { TZDate } from '@date-fns/tz';
import { differenceInSeconds, format, isSameDay, isToday, isTomorrow } from 'date-fns';

export const IST = 'Asia/Kolkata';

/** Reinterprets an instant in IST for display. */
export function toIST(instant: Date | string): TZDate {
  return new TZDate(typeof instant === 'string' ? new Date(instant) : instant, IST);
}

/** The IST calendar day an instant falls on: "2026-08-14". */
export function localDate(instant: Date | string): string {
  return format(toIST(instant), 'yyyy-MM-dd');
}

/** "6:00 PM" */
export function formatTime(instant: Date | string): string {
  return format(toIST(instant), 'h:mm a');
}

/** "6:00 PM – 7:00 PM" — en-dash, not a hyphen (§8.5). */
export function formatSlotRange(startAt: Date | string, endAt: Date | string): string {
  return `${formatTime(startAt)} – ${formatTime(endAt)}`;
}

/** "Thu, 14 Aug" */
export function formatDate(instant: Date | string): string {
  return format(toIST(instant), 'EEE, d MMM');
}

/** "Thursday, 14 August 2026" */
export function formatDateLong(instant: Date | string): string {
  return format(toIST(instant), 'EEEE, d MMMM yyyy');
}

/**
 * Human day label for fixture-list headers.
 * Specific beats clever: "Today" and "Tomorrow" are genuinely useful,
 * "in 3 days" is not — people want the date.
 */
export function formatDayLabel(instant: Date | string): string {
  const d = toIST(instant);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return formatDate(d);
}

/** "Today · 6:00 PM" — the standard match/booking timestamp. */
export function formatDayAndTime(instant: Date | string): string {
  return `${formatDayLabel(instant)} · ${formatTime(instant)}`;
}

export function isSameISTDay(a: Date | string, b: Date | string): boolean {
  return isSameDay(toIST(a), toIST(b));
}

/**
 * Countdown for slot holds. Returns "4:32" — a hold is always under 15
 * minutes, so hours are never needed. Clamps at zero rather than going
 * negative, because an expired hold should read 0:00, not -0:03.
 */
export function formatCountdown(secondsRemaining: number): string {
  const clamped = Math.max(0, Math.floor(secondsRemaining));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function secondsUntil(instant: Date | string, now: Date = new Date()): number {
  const target = typeof instant === 'string' ? new Date(instant) : instant;
  return differenceInSeconds(target, now);
}

/** Slot grids are built from IST hour boundaries, never from "18:00" strings. */
export function istHourLabel(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

/** "2026-08-14" for an instant, in IST. Used to query a day's slots. */
export function toLocalDateString(instant: Date): string {
  return localDate(instant);
}
