/**
 * Which routes are operator surfaces rather than public pages.
 *
 * Panels render their own sidebar shell, so the marketing header and footer are
 * suppressed there — a venue owner looking at today's bookings does not need a
 * "Sign in" button and a link tree.
 *
 * `/partner`, `/partner/apply` and `/partner/pricing` are deliberately NOT here:
 * those are the public pitch, the lead form and the payouts explainer, and they
 * keep full site chrome.
 */
const PARTNER_PANEL_ROUTES = [
  '/partner/dashboard',
  '/partner/bookings',
  '/partner/courts',
  '/partner/settlements',
  '/partner/settings',
  '/partner/login',
  '/partner/register',
] as const;

export function isPanelRoute(pathname: string): boolean {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return true;
  return PARTNER_PANEL_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
