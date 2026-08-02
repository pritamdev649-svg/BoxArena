'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';

export interface AcceptResult {
  success: boolean;
  error?: string;
}

/**
 * Accepting stakes real money, so it runs server-side with the httpOnly
 * session — the browser never holds a credential that could do this.
 */
export async function acceptChallengeAction(input: {
  challengePublicId: string;
  teamId: string;
}): Promise<AcceptResult> {
  const token = await getPlayerToken();
  if (!token) return { success: false, error: 'Sign in to accept' };

  try {
    await apiFetch(`/challenges/${input.challengePublicId}/accept`, {
      method: 'POST',
      token,
      body: { teamId: input.teamId },
    });
    revalidatePath(`/challenges/${input.challengePublicId}`);
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Could not accept this challenge' };
  }
}
