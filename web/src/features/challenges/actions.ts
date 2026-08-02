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

export interface QuoteResult {
  perTeamCostPaise: number;
  creatorTotalCostPaise: number;
  totalEntryPoolPaise: number;
  entryCommissionPaise: number;
  netPrizePoolPaise: number;
  winnerNetProfitPaise: number;
  loserNetPaise: number;
  suggestedMinimumEntryFeePaise: number;
  winnerProfitIsLow: boolean;
  exceedsCap: boolean;
  capPaise: number;
}

/**
 * The live prize-pool preview (money spec MM1).
 *
 * Server-computed on every keystroke rather than mirrored in the browser —
 * the figure a creator sets a price against must be the figure the server
 * will actually use.
 */
export async function quoteAction(input: {
  venueFeePaise: number;
  officialFeePaise: number;
  entryFeePaise: number;
}): Promise<QuoteResult | null> {
  const token = await getPlayerToken();
  if (!token) return null;

  try {
    return await apiFetch<QuoteResult>('/challenges/quote', {
      method: 'POST',
      token,
      body: { ...input, teamCount: 2 },
    });
  } catch {
    return null;
  }
}

export interface CreateResult {
  success: boolean;
  error?: string;
  challengePublicId?: string;
}

/**
 * Creates the team first when the player has none.
 *
 * For badminton singles a "team" is one person, so demanding a separate
 * team-building step before anyone can post a challenge is ceremony that
 * blocks the whole loop. One call, done inline.
 */
export async function createChallengeAction(input: {
  bookingPublicId: string;
  teamPublicId: string | null;
  newTeamName?: string;
  sport: string;
  format: string;
  entryFeePaise: number;
}): Promise<CreateResult> {
  const token = await getPlayerToken();
  if (!token) return { success: false, error: 'Sign in to post a challenge' };

  try {
    let teamId = input.teamPublicId;

    if (!teamId) {
      if (!input.newTeamName?.trim()) {
        return { success: false, error: 'Give your team a name' };
      }
      const team = await apiFetch<{ publicId: string }>('/teams', {
        method: 'POST',
        token,
        body: { name: input.newTeamName.trim(), sport: input.sport, format: input.format },
      });
      teamId = team.publicId;
    }

    const challenge = await apiFetch<{ publicId: string }>('/challenges', {
      method: 'POST',
      token,
      body: {
        bookingId: input.bookingPublicId,
        teamId,
        entryFeePaise: input.entryFeePaise,
      },
    });

    revalidatePath('/challenges');
    return { success: true, challengePublicId: challenge.publicId };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Could not post the challenge' };
  }
}
