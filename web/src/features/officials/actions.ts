'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

/**
 * Officials marketplace actions (featuredoc/11 §OF1, §OF3).
 *
 * Registration and assignment both sit behind the player session, because an
 * official IS a user — the role is something a person holds, not a separate
 * identity with its own login.
 */
export interface OfficialResult {
  success: boolean;
  error?: string;
}

async function call<T>(path: string, body: unknown, fallback: string) {
  const token = await getPlayerToken();
  if (!token) return { ok: false as const, error: 'Sign in first' };

  try {
    return { ok: true as const, data: await apiFetch<T>(path, { method: 'POST', token, body }) };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false as const, error: err.message };
    return { ok: false as const, error: fallback };
  }
}

export async function registerOfficialAction(input: {
  type: 'independent' | 'venue_staff' | 'team_added';
  displayName: string;
  sports: string[];
  pricePerMatchPaise: number;
  experienceYears?: number;
  bio?: string;
  arenaPublicId?: string;
}): Promise<OfficialResult> {
  const result = await call(API_ENDPOINTS.officials, input, 'Could not register you as an official');
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath('/officials/register');
  return { success: true };
}

/**
 * A captain accepts — or contests — the result the official recorded.
 *
 * Only reachable when the official could not trigger payout themselves;
 * otherwise the match settled the moment they signed off.
 */
export async function confirmResultAction(input: {
  matchPublicId: string;
  agree: boolean;
}): Promise<OfficialResult & { settled?: boolean; disputed?: boolean; awaiting?: string | null }> {
  const result = await call<{ settled: boolean; disputed: boolean; awaiting: string | null }>(
    API_ENDPOINTS.matchConfirmResult(input.matchPublicId),
    { agree: input.agree },
    'Could not record your answer',
  );
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/matches/${input.matchPublicId}/confirm`);
  return { success: true, ...result.data };
}
