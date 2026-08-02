'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/shared/lib/api';
import { getPlayerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

/**
 * The official's scoreboard, server-side.
 *
 * The client never sends a score — only "point to this side" — so every action
 * here is a command, not a state write. The server owns the rules
 * (badminton-engine.ts) and hands back the resulting state.
 */

export interface GameScore {
  creator: number;
  opponent: number;
}

export interface RallyState {
  bestOf: number;
  games: GameScore[];
  current: GameScore;
  currentGameNumber: number;
  serving: 'creator' | 'opponent';
  decidingEndsSwapped: boolean;
  isComplete: boolean;
  winner: 'creator' | 'opponent' | null;
  /** Which service court the server delivers from, derived from their score. */
  serveCourt: 'right' | 'left';
  /** Null in singles. Which player of each pair is in the right-hand court. */
  doubles: { creatorRightIndex: number; opponentRightIndex: number } | null;
}

export type PointOutcome = 'winner' | 'unforced_error' | 'service_fault';

export interface ScoringResult {
  success: boolean;
  state?: RallyState;
  gameEnded?: boolean;
  matchEnded?: boolean;
  changeEnds?: boolean;
  error?: string;
}

async function command<T>(
  path: string,
  body: unknown,
  fallback: string,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const token = await getPlayerToken();
  if (!token) return { ok: false, error: 'Sign in to score this match' };

  try {
    return { ok: true, data: await apiFetch<T>(path, { method: 'POST', token, body }) };
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: fallback };
  }
}

export async function startMatchAction(matchPublicId: string): Promise<ScoringResult> {
  const result = await command<{ state: RallyState }>(
    API_ENDPOINTS.matchLiveStart(matchPublicId),
    {},
    'Could not start the match',
  );
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/score/${matchPublicId}`);
  return { success: true, state: result.data.state };
}

/**
 * `idempotencyKey` is generated per tap by the caller and reused on retry.
 * Minting it here would make every retry a fresh rally — which is how a phone
 * on bad signal silently adds a point nobody scored.
 */
export async function recordPointAction(input: {
  matchPublicId: string;
  side: 'creator' | 'opponent';
  idempotencyKey: string;
  /** Optional — a bare tap still records a valid rally. */
  outcome?: PointOutcome;
}): Promise<ScoringResult> {
  const result = await command<Omit<ScoringResult, 'success' | 'error'>>(
    API_ENDPOINTS.matchLivePoint(input.matchPublicId),
    {
      side: input.side,
      idempotencyKey: input.idempotencyKey,
      ...(input.outcome ? { outcome: input.outcome } : {}),
    },
    'Could not record that point',
  );
  if (!result.ok) return { success: false, error: result.error };
  return { success: true, ...result.data };
}

export async function undoPointAction(input: {
  matchPublicId: string;
  idempotencyKey: string;
}): Promise<ScoringResult> {
  const result = await command<RallyState>(
    API_ENDPOINTS.matchLiveUndo(input.matchPublicId),
    { idempotencyKey: input.idempotencyKey },
    'Could not undo that point',
  );
  if (!result.ok) return { success: false, error: result.error };
  return { success: true, state: result.data };
}

export async function recordEventAction(input: {
  matchPublicId: string;
  eventType: 'timeout' | 'injury' | 'interruption';
  side?: 'creator' | 'opponent';
}): Promise<{ success: boolean; error?: string }> {
  const result = await command(
    API_ENDPOINTS.matchLiveEvent(input.matchPublicId),
    { eventType: input.eventType, ...(input.side ? { side: input.side } : {}) },
    'Could not record that',
  );
  return result.ok ? { success: true } : { success: false, error: result.error };
}

export interface ConfirmResult {
  success: boolean;
  settled?: boolean;
  awaitingCaptains?: boolean;
  error?: string;
}

export async function confirmResultAction(matchPublicId: string): Promise<ConfirmResult> {
  const result = await command<{ settled: boolean; awaitingCaptains: boolean }>(
    API_ENDPOINTS.matchLiveConfirm(matchPublicId),
    {},
    'Could not confirm the result',
  );
  if (!result.ok) return { success: false, error: result.error };

  revalidatePath(`/score/${matchPublicId}`);
  return { success: true, ...result.data };
}

/**
 * A one-minute credential the browser may hold, purely to open the WebSocket.
 *
 * The session cookie is httpOnly so client JS cannot read it, and the socket
 * takes its credential from the URL — where an access token must never go.
 * This mints a scoped, short-lived substitute instead.
 */
export async function socketTokenAction(): Promise<string | null> {
  const token = await getPlayerToken();
  if (!token) return null;

  try {
    const result = await apiFetch<{ token: string }>(API_ENDPOINTS.socketToken, {
      method: 'POST',
      token,
      body: {},
    });
    return result.token;
  } catch {
    /** Live follow is a nicety — the scoreboard works without it. */
    return null;
  }
}
