import { describe, expect, it } from 'vitest';
import { t } from './index';
import { en } from './messages/en';

describe('translate', () => {
  it('resolves a nested key', () => {
    expect(t('auth.sendCode')).toBe('Send code');
  });

  it('interpolates values', () => {
    expect(t('common.courtCount', { count: 3 })).toBe('3 courts');
  });

  it('uses the singular form for one', () => {
    expect(t('common.courtCount', { count: 1 })).toBe('1 court');
  });

  it('uses the plural form for zero — English groups 0 with "other"', () => {
    expect(t('common.venueCount', { count: 0 })).toBe('0 venues');
  });

  it('returns the key itself when a message is missing, never a blank string', () => {
    // @ts-expect-error deliberately invalid key — the point is it fails loudly
    expect(t('auth.doesNotExist')).toBe('auth.doesNotExist');
  });
});

describe('message catalogue integrity', () => {
  /**
   * Guards the Hindi launch (prd.md §6): a stray placeholder or an empty
   * string here becomes a visibly broken screen after translation.
   */
  function walk(node: unknown, path: string[], visit: (p: string, v: string) => void): void {
    if (typeof node === 'string') {
      visit(path.join('.'), node);
      return;
    }
    if (typeof node === 'object' && node !== null) {
      for (const [key, value] of Object.entries(node)) {
        walk(value, [...path, key], visit);
      }
    }
  }

  it('has no empty strings', () => {
    const empty: string[] = [];
    walk(en, [], (path, value) => {
      if (value.trim() === '') empty.push(path);
    });
    expect(empty).toEqual([]);
  });

  it('uses typographic apostrophes, not straight quotes', () => {
    const straight: string[] = [];
    walk(en, [], (path, value) => {
      if (value.includes("'")) straight.push(path);
    });
    expect(straight).toEqual([]);
  });

  it('only uses {count} as an interpolation placeholder in plural entries', () => {
    const bad: string[] = [];
    walk(en, [], (path, value) => {
      const placeholders = value.match(/\{(\w+)\}/gu) ?? [];
      for (const placeholder of placeholders) {
        if (placeholder !== '{count}') bad.push(`${path}: ${placeholder}`);
      }
    });
    expect(bad).toEqual([]);
  });
});
