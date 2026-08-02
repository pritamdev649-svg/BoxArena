'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

/**
 * Wallet top-up.
 *
 * Two steps by design: the server creates a payment order, the gateway
 * charges, then the server credits against that order id. The credit is keyed
 * to the order, so the client callback and the Razorpay webhook converge on
 * one ledger row — whichever lands first credits, the other is a no-op
 * (edge_cases.md §32).
 */
export interface TopupOrder {
  orderId: string;
  amountPaise: number;
  keyId: string;
  isMock: boolean;
}

export interface TopupResult {
  success: boolean;
  error?: string;
  order?: TopupOrder;
  credited?: boolean;
}

export async function createTopupAction(amountPaise: number): Promise<TopupResult> {
  const token = await getPlayerToken();
  if (!token) return { success: false, error: 'Sign in to top up' };

  try {
    const order = await apiFetch<TopupOrder>(API_ENDPOINTS.walletTopupOrder, {
      method: 'POST',
      token,
      body: { amountPaise },
    });
    return { success: true, order };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Could not start the top-up' };
  }
}

/**
 * Confirms a paid order.
 *
 * In mock mode the server accepts any signature, so this completes the flow
 * end to end with no gateway. Against real Razorpay the three values come from
 * its checkout callback and the signature is verified server-side — the client
 * can never talk its own top-up into existence.
 */
export async function verifyTopupAction(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<TopupResult> {
  const token = await getPlayerToken();
  if (!token) return { success: false, error: 'Sign in to top up' };

  try {
    await apiFetch(API_ENDPOINTS.walletTopupVerify, { method: 'POST', token, body: input });
    revalidatePath('/wallet');
    return { success: true, credited: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Could not confirm the payment' };
  }
}
