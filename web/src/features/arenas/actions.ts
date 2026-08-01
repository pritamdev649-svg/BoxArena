'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

/**
 * Review submission runs through a server action, not a browser fetch.
 *
 * The player's access token lives in an httpOnly cookie (session-cookie.ts), so
 * client JS cannot read it to set an Authorization header. The action reads the
 * cookie server-side, which also means the rating rules stay enforced by the
 * API rather than by a form the browser owns.
 */
export interface SubmitReviewResult {
  success: boolean;
  error?: string;
}

export async function submitArenaReviewAction(input: {
  arenaPublicId: string;
  arenaSlug: string;
  bookingPublicId: string;
  rating: number;
  comment?: string;
}): Promise<SubmitReviewResult> {
  const token = await getPlayerToken();
  if (!token) return { success: false, error: 'Sign in to rate this venue' };

  try {
    await apiFetch(API_ENDPOINTS.arenaCreateReview(input.arenaPublicId), {
      method: 'POST',
      token,
      body: {
        bookingPublicId: input.bookingPublicId,
        rating: input.rating,
        ...(input.comment ? { comment: input.comment } : {}),
      },
    });

    /** The venue's average and review list both change — re-render the page. */
    revalidatePath(`/arenas/${input.arenaSlug}`);
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Could not save your rating' };
  }
}
