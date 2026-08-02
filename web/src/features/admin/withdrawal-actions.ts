'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/shared/lib/api';
import { getAdminToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

/**
 * Ops decision on a withdrawal.
 *
 * Approving does NOT move money a second time — the balance was debited when
 * the player asked. Rejecting refunds it, which is why a reason is mandatory:
 * the player sees that string and it is the only explanation they get.
 */
export interface ReviewResult {
  success: boolean;
  error?: string;
}

export async function reviewWithdrawalAction(
  publicId: string,
  decision: 'approve' | 'reject',
  reason?: string,
): Promise<ReviewResult> {
  const token = await getAdminToken();
  if (!token) return { success: false, error: 'Sign in again' };

  try {
    await apiFetch(API_ENDPOINTS.adminReviewWithdrawal(publicId), {
      method: 'POST',
      token,
      body: { decision, ...(reason ? { reason } : {}) },
    });
    revalidatePath('/admin/withdrawals');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'That decision did not go through' };
  }
}
