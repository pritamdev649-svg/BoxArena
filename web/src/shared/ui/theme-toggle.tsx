'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { t } from '@/shared/i18n';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'boxarena-theme';

function readTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' ? 'dark' : 'light';
}

/**
 * The DOM attribute is the source of truth — `themeInitScript` sets it before
 * first paint, so React must READ it rather than re-derive it. `useSyncExternal
 * Store` subscribes without a setState-in-effect cascade.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    readTheme,
    /** Server snapshot: light, matching the CSS default. */
    () => 'light',
  );

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Private browsing blocks writes; the toggle still works for this session. */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="text-ink-secondary hover:text-ink hover:bg-elevated rounded-control flex size-11 items-center justify-center transition-colors duration-150"
      aria-label={theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')}
    >
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

/**
 * Runs before paint to apply the stored theme, preventing a flash of the wrong
 * theme on reload. Inline by necessity — a deferred script paints first.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('${STORAGE_KEY}');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', stored || (prefersDark ? 'dark' : 'light'));
  } catch (e) {}
})();
`;
