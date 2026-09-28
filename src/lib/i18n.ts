// Tiny i18n: English source strings are the keys; ko.ts holds Korean. Missing keys fall back to English.
// The device language comes from Intl (Hermes uses the phone's locale), so no native module is needed.
// tests/unit/i18n.test.ts fails if a t()/tn() string in src has no Korean entry.
import { ko } from '@/i18n/ko';

export type Lang = 'en' | 'ko';

let lang: Lang = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith('ko') ? 'ko' : 'en';

export const getLang = () => lang;
export const setLang = (next: Lang) => (lang = next); // tests only

type Params = Record<string, string | number>;

export function t(text: string, params?: Params): string {
  const s = (lang === 'ko' && ko[text]) || text;
  return params ? s.replace(/\{(\w+)\}/g, (m: string, k: string) => (k in params ? String(params[k]) : m)) : s;
}

// English needs a plural form; Korean uses the `many` entry for every count.
export function tn(n: number, one: string, many: string, params?: Params): string {
  return t(n === 1 ? one : many, { n, ...params });
}
