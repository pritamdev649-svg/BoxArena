'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';
import { t } from '@/shared/i18n';

/**
 * Requesting a withdrawal.
 *
 * The balance is debited the moment this succeeds, not when ops approves —
 * otherwise a player could request the same rupees twice while the queue is
 * being worked. So the confirmation text says the money has already left.
 */
export interface WithdrawResult {
  success: boolean;
  error?: string;
}

export async function requestWithdrawalAction(amountPaise: number): Promise<WithdrawResult> {
  const token = await getPlayerToken();
  if (!token) return { success: false, error: 'Sign in to withdraw' };

  try {
    await apiFetch(API_ENDPOINTS.walletWithdraw, {
      method: 'POST',
      token,
      body: { amountPaise },
    });
    revalidatePath('/wallet');
    return { success: true };
  } catch (err) {
    /** The API's own message is more useful than ours — it names the reason. */
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: t('wallet.withdrawFailed') };
  }
}
