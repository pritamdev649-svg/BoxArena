'use server';

import { cookies } from 'next/headers';
import { PANEL_COOKIES } from './session-cookie';

/**
 * Clears every panel session.
 *
 * Lives in `shared/` rather than `features/auth` because the site header needs
 * it, and `shared/` may never import from a feature (code_standards.md §1.4
 * rule 3). Signing out is cookie mechanics, not auth domain logic — the feature
 * re-exports this rather than owning it.
 *
 * Deliberately does NOT redirect: callers are client handlers that navigate
 * themselves, and a redirect() here would throw through them.
 */
export async function signOut(): Promise<void> {
  const store = await cookies();
  for (const name of Object.values(PANEL_COOKIES)) store.delete(name);
}
