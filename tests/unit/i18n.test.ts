/// <reference types="node" />
// Every t()/tn() string in the app has a Korean translation, and translations keep their {placeholders}.
import fs from 'node:fs';
import path from 'node:path';

import { ko } from '@/i18n/ko';
import { setLang, t, tn } from '@/lib/i18n';

const LITERAL = String.raw`('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")`;
const CALL = new RegExp(String.raw`\bt\(\s*${LITERAL}|\btn\([^,]+,\s*${LITERAL}\s*,\s*${LITERAL}`, 'g');

function sourceKeys(): Set<string> {
  const keys = new Set<string>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !p.includes(`${path.sep}i18n${path.sep}`)) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(CALL)) {
          for (const lit of [m[1], m[2], m[3]]) if (lit) keys.add(eval(lit) as string);
        }
      }
    }
  };
  walk(path.join(__dirname, '../../src'));
  return keys;
}

test('every UI string has a Korean translation', () => {
  const missing = [...sourceKeys()].filter((k) => !(k in ko));
  expect(missing).toEqual([]);
});

test('translations keep the same placeholders', () => {
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
  const broken = Object.entries(ko).filter(([en, k]) => ph(en) !== ph(k));
  expect(broken).toEqual([]);
});

test('t fills placeholders and falls back to English', () => {
  setLang('ko');
  expect(t('A string nobody translated {x}', { x: 1 })).toBe('A string nobody translated 1');
  setLang('en');
  expect(tn(1, '{n} moment', '{n} moments')).toBe('1 moment');
  expect(tn(3, '{n} moment', '{n} moments')).toBe('3 moments');
});
