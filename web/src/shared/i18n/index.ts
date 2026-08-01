import { en, type Messages } from './messages/en';

/**
 * Minimal, dependency-free translation accessor.
 *
 * Deliberately NOT a hook: most of this app is Server Components, and a plain
 * function works in both without a provider. When Hindi lands (prd.md §6) this
 * swaps for next-intl with no call-site changes — the `t('ns.key')` shape and
 * the message file structure already match its convention.
 */

export type Locale = 'en';

const DICTIONARIES: Record<Locale, Messages> = { en };

export const DEFAULT_LOCALE: Locale = 'en';

/** A plural entry resolved by Intl.PluralRules, not by appending "s". */
interface PluralMessage {
  one: string;
  other: string;
}

function isPlural(value: unknown): value is PluralMessage {
  return typeof value === 'object' && value !== null && 'other' in value;
}

/**
 * Every dot-path that resolves to a leaf. Makes `t('auth.titl')` a compile
 * error rather than a blank string discovered in production.
 */
type Leaf = string | PluralMessage;
type DotPaths<T> = T extends Leaf
  ? ''
  : {
      [K in keyof T & string]: T[K] extends Leaf ? K : `${K}.${DotPaths<T[K]>}`;
    }[keyof T & string];

export type MessageKey = DotPaths<Messages>;

export interface TranslateValues {
  count?: number;
  [key: string]: string | number | undefined;
}

function resolve(locale: Locale, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        typeof node === 'object' && node !== null
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      DICTIONARIES[locale],
    );
}

/** Replaces {name} placeholders. Unknown placeholders are left intact. */
function interpolate(template: string, values?: TranslateValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/gu, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(
  key: MessageKey,
  values?: TranslateValues,
  locale: Locale = DEFAULT_LOCALE,
): string {
  const entry = resolve(locale, key);

  if (isPlural(entry)) {
    const count = values?.count ?? 0;
    /** Hindi pluralises differently from English — let Intl decide. */
    const rule = new Intl.PluralRules(locale).select(count);
    const template = rule === 'one' ? entry.one : entry.other;
    return interpolate(template, values);
  }

  if (typeof entry === 'string') return interpolate(entry, values);

  /** Loud in development, harmless in production. */
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[i18n] Missing message for key: ${key}`);
  }
  return key;
}

export const t = translate;
