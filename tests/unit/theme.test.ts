import { Colors } from '@/constants/theme';

// WCAG 2.1 relative luminance / contrast ratio.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each(['light', 'dark'] as const)('%s theme contrast (AA 4.5:1)', (scheme) => {
  const c = Colors[scheme];
  test.each([
    ['text', c.text, c.background],
    ['text on surface', c.text, c.surface],
    ['textSecondary', c.textSecondary, c.background],
    ['textSecondary on surface', c.textSecondary, c.surface],
    ['onPrimary', c.onPrimary, c.primary],
    ['onAccent', c.onAccent, c.accent],
    ['link', c.link, c.background],
    ['link on surface', c.link, c.surface],
  ])('%s', (_, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
