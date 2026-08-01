'use server';

import { apiFetch, ApiError } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

/**
 * The two money-moving steps of booking, as server actions.
 *
 * They are actions rather than browser fetches for the same reason the review
 * form is: the player's access token lives in an httpOnly cookie, so client JS
 * cannot attach it (session-cookie.ts).
 *
 * `needsAuth` is a distinct outcome, not an error string. A signed-out visitor
 * tapping Continue has done nothing wrong — the caller sends them to sign in
 * and back, rather than showing them a red failure.
 */

export interface HoldResult {
  success: boolean;
  needsAuth?: boolean;
  /** When the hold lapses. Display only — the API re-checks on confirm. */
  holdExpiresAt?: string;
  error?: string;
  /** Set when the venue repriced the slot between render and Continue. */
  newTotalPaise?: number;
}

export async function holdSlotsAction(input: {
  slotIds: string[];
  expectedTotalPaise: number;
}): Promise<HoldResult> {
  const token = await getPlayerToken();
  if (!token) return { success: false, needsAuth: true };

  try {
    const result = await apiFetch<{ holdExpiresAt: string }>(API_ENDPOINTS.bookingHold, {
      method: 'POST',
      token,
      body: input,
    });
    return { success: true, holdExpiresAt: result.holdExpiresAt };
  } catch (err) {
    if (err instanceof ApiError) {
      /**
       * The API refuses to hold at a price different from the one on screen,
       * and hands back the real number. Surfacing it beats "request failed" —
       * the player can decide whether they still want the slot.
       */
      const details = err.details as { newTotalPaise?: number } | undefined;
      return {
        success: false,
        error: err.message,
        ...(typeof details?.newTotalPaise === 'number'
          ? { newTotalPaise: details.newTotalPaise }
          : {}),
      };
    }
    return { success: false, error: 'Could not hold those slots' };
  }
}

export interface ConfirmResult {
  success: boolean;
  needsAuth?: boolean;
  bookingPublicId?: string;
  error?: string;
}

export async function confirmBookingAction(input: {
  slotIds: string[];
  isPayAtVenue: boolean;
  /**
   * Generated once per checkout attempt by the caller and reused on retry.
   * Minting it here would make every retry a fresh key — which is exactly how
   * you double-charge someone who taps Confirm twice on a flaky connection.
   */
  idempotencyKey: string;
}): Promise<ConfirmResult> {
  const token = await getPlayerToken();
  if (!token) return { success: false, needsAuth: true };

  try {
    const booking = await apiFetch<{ publicId: string }>(API_ENDPOINTS.bookingConfirm, {
      method: 'POST',
      token,
      idempotencyKey: input.idempotencyKey,
      body: { slotIds: input.slotIds, isPayAtVenue: input.isPayAtVenue },
    });
    return { success: true, bookingPublicId: booking.publicId };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Could not confirm your booking' };
  }
}
