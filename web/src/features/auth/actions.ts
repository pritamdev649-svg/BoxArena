'use server';

import { cookies } from 'next/headers';
import { apiFetch, ApiError } from '@/shared/lib/api';
import { PANEL_COOKIES, cookieOptionsFor, type PanelKind } from '@/shared/lib/session-cookie';
import { signOut } from '@/shared/lib/sign-out';

/**
 * Server actions for the phone + OTP flow (api_contract.md §1).
 *
 * Tokens are written to httpOnly, path-scoped cookies and never returned to the
 * browser — the access token must not be readable from client JS
 * (technical_spec.md §4.3). That is why these are actions rather than fetches
 * from a client component.
 *
 * In dev the backend returns the code in the response body (`OTP_DEV_MODE`), so
 * we surface it on screen and prefill it. Gated on NODE_ENV here as well as in
 * the API: two independent guards, because a leaked code is a full takeover.
 */

const PHONE_PATTERN = /^\+91[6-9]\d{9}$/u;

function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Try again.';
}

/** The panel a landing path belongs to. */
function panelFor(landingPath: string): PanelKind {
  if (landingPath.startsWith('/admin')) return 'admin';
  if (landingPath.startsWith('/partner')) return 'partner';
  return 'player';
}

function toE164(phoneNumber: string): string {
  return `+91${phoneNumber.replace(/\D/gu, '').slice(-10)}`;
}

async function writeSession(panel: PanelKind, accessToken: string): Promise<void> {
  const store = await cookies();
  store.set(PANEL_COOKIES[panel], accessToken, cookieOptionsFor(panel));
}

interface VerifyResponse {
  accessToken: string;
  user: { fullName?: string; role: string; publicId: string };
  isNewUser: boolean;
}

/** Roles allowed through each entrance. */
const ALLOWED_ROLES: Record<PanelKind, readonly string[]> = {
  player: ['player', 'arena_owner', 'arena_staff', 'admin', 'super_admin'],
  partner: ['arena_owner', 'arena_staff', 'admin', 'super_admin'],
  admin: ['admin', 'super_admin'],
};

export interface RequestOtpResult {
  success: boolean;
  error?: string;
  /** Dev only — no SMS gateway needed to sign in locally. */
  devCode?: string;
}

/**
 * Step 1 — send the code.
 *
 * Without this call no OTP row exists, so verification could only ever fail
 * with "that code has expired". The API always returns 200 even for an unknown
 * number: it must never reveal whether a phone is registered.
 */
export async function requestOtpAction(phoneNumber: string): Promise<RequestOtpResult> {
  const formatted = toE164(phoneNumber);
  if (!PHONE_PATTERN.test(formatted)) {
    return { success: false, error: 'Enter a 10-digit Indian mobile number' };
  }

  try {
    const result = await apiFetch<{ devCode?: string }>('/auth/otp/request', {
      method: 'POST',
      body: { phoneNumber: formatted },
    });

    return { success: true, ...(isDev() && result.devCode ? { devCode: result.devCode } : {}) };
  } catch (err) {
    return { success: false, error: messageFor(err) };
  }
}

export interface LoginResult {
  success: boolean;
  error?: string;
}

/** Step 2 — verify the code and open the session for the panel `landingPath` implies. */
export async function loginAction(
  phoneNumber: string,
  code: string,
  landingPath: string,
): Promise<LoginResult> {
  if (!phoneNumber || !code) {
    return { success: false, error: 'Phone number and verification code are required' };
  }

  const panel = panelFor(landingPath);

  try {
    const result = await apiFetch<VerifyResponse>('/auth/otp/verify', {
      method: 'POST',
      body: { phoneNumber: toE164(phoneNumber), code, deviceId: 'web-panel' },
    });

    /**
     * A wrong-panel sign-in is a dead end, not a security boundary — the API
     * scopes every response by role regardless. Saying so here beats dropping
     * someone into a dashboard that renders empty.
     */
    if (!ALLOWED_ROLES[panel].includes(result.user.role)) {
      return { success: false, error: 'That account does not have access to this panel.' };
    }

    await writeSession(panel, result.accessToken);
    return { success: true };
  } catch (err) {
    return { success: false, error: messageFor(err) };
  }
}

export interface VenueDetails {
  ownerName: string;
  phoneNumber: string;
  venueName: string;
  areaName: string;
  sports: string[];
  courtCount: number;
}

export interface RegisterVenueResult extends RequestOtpResult {
  applicationPublicId?: string;
}

/**
 * Venue registration — creates an `ArenaApplication` and sends the OTP that
 * turns it into a pending `arena_owner`. Never creates a live arena: nothing
 * goes live without human verification (arena_onboarding.md §5).
 *
 * NOTE the path: api_contract.md §12a specifies `/partner/apply`, but the
 * server mounts this router at `/owner`. Calling the contract path 404s. Drift
 * recorded in docs/mvp/featuredoc/09-partner-panel.md — resolve by changing one
 * side, not by adding a second alias.
 */
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export async function registerVenueAction(details: VenueDetails): Promise<RegisterVenueResult> {
  try {
    const result = await apiFetch<{ application: { publicId: string }; devCode?: string }>(
      API_ENDPOINTS.ownerApply,
      {
        method: 'POST',
        body: { ...details, phoneNumber: toE164(details.phoneNumber), source: 'web' },
      },
    );

    return {
      success: true,
      applicationPublicId: result.application.publicId,
      ...(isDev() && result.devCode ? { devCode: result.devCode } : {}),
    };
  } catch (err) {
    return { success: false, error: messageFor(err) };
  }
}

/** Confirms a venue applicant's phone and signs them straight into the panel. */
export async function verifyVenueAction(
  applicationPublicId: string,
  otpCode: string,
): Promise<LoginResult> {
  try {
    const result = await apiFetch<VerifyResponse>(
      API_ENDPOINTS.ownerVerifyPhone(applicationPublicId),
      { method: 'POST', body: { otpCode, deviceId: 'web-panel' } },
    );
    await writeSession('partner', result.accessToken);
    return { success: true };
  } catch (err) {
    return { success: false, error: messageFor(err) };
  }
}

/** Re-exported from shared/ so the site header can sign out without importing a feature. */
export async function logoutAction(): Promise<void> {
  return signOut();
}
