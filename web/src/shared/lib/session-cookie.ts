/**
 * Session cookie shape, shared by the actions that write them and the panel
 * helpers that read them.
 *
 * **All cookies are path `/`.** They were briefly scoped per panel (the ops
 * cookie only sent to /admin, the venue cookie only to /partner) as defence in
 * depth per technical_spec.md §4.3. That broke identity on the public site: a
 * venue owner who signed in at /partner/login still saw "Sign in" on /arenas,
 * because the browser never sent their cookie there.
 *
 * The scoping also bought less than it looked like. The value in every one of
 * these cookies is the same JWT, so the moment any of them is readable at `/`
 * the isolation is notional. The real protections are unchanged: the cookies
 * stay httpOnly (client JS cannot read them), and the API re-checks role and
 * status from the database on every request.
 *
 * Separate NAMES are still worth keeping — signing out of the ops console
 * should not end your player session, and one person can hold both.
 */

export type PanelKind = 'player' | 'partner' | 'admin';

export const PANEL_COOKIES: Record<PanelKind, string> = {
  player: 'boxarena_player_session',
  partner: 'boxarena_partner_session',
  admin: 'boxarena_admin_session',
};

/** Access tokens live 15 minutes (api_contract.md §1). */
const MAX_AGE_SECONDS = 15 * 60;

export interface SessionCookieOptions {
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
}

export function cookieOptionsFor(_panel: PanelKind): SessionCookieOptions {
  return {
    httpOnly: true,
    /** 'lax' not 'strict': a link from an email into the panel should work. */
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    /** Site-wide, so the header knows who you are on every page. */
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  };
}
