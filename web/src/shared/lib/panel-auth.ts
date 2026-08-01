import { cookies } from 'next/headers';
import { apiFetch } from '@/shared/lib/api';

/**
 * Resolves the panel's access token.
 *
 * Real sessions live in an httpOnly, path-scoped cookie (technical_spec.md
 * §4.3). Until the login flow is wired, a dev fallback logs in as a seeded
 * account so the panels render against real data — gated to non-production so
 * it can never become a backdoor.
 */
export async function getPartnerToken(): Promise<string | undefined> {
  return getPanelToken('boxarena_partner_session', process.env['DEV_PARTNER_PHONE']);
}

export async function getAdminToken(): Promise<string | undefined> {
  return getPanelToken('boxarena_admin_session', process.env['DEV_ADMIN_PHONE']);
}

export async function getPlayerToken(): Promise<string | undefined> {
  return getPanelToken('boxarena_player_session', undefined);
}

export async function getAnyToken(): Promise<string | undefined> {
  const store = await cookies();
  const playerToken = store.get('boxarena_player_session')?.value;
  if (playerToken) return playerToken;
  const partnerToken = store.get('boxarena_partner_session')?.value;
  if (partnerToken) return partnerToken;
  const adminToken = store.get('boxarena_admin_session')?.value;
  if (adminToken) return adminToken;
  return undefined;
}


/**
 * Opt-in, because the real login flow now exists.
 *
 * When this is on, a missing cookie silently becomes a valid session — which
 * means the panel layouts never redirect and the login screens are unreachable
 * locally. Leave it off unless you are specifically skipping the sign-in step.
 */
function isAutoLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env['DEV_PANEL_AUTOLOGIN'] === 'true';
}

async function getPanelToken(
  cookieName: string,
  devPhone: string | undefined,
): Promise<string | undefined> {
  const store = await cookies();
  const session = store.get(cookieName)?.value;
  if (session) return session;

  if (!devPhone || !isAutoLoginEnabled()) return undefined;
  return devLogin(devPhone);
}

/** Dev only. OTP_DEV_MODE makes the code deterministic. */
async function devLogin(phoneNumber: string): Promise<string | undefined> {
  try {
    await apiFetch('/auth/otp/request', { method: 'POST', body: { phoneNumber } });
    const result = await apiFetch<{ accessToken: string }>('/auth/otp/verify', {
      method: 'POST',
      body: { phoneNumber, code: process.env['DEV_OTP_CODE'] ?? '123456' },
    });
    return result.accessToken;
  } catch {
    return undefined;
  }
}
