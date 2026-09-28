// Design tokens (masterplan §22). Soft peach and mint pastels (owner's choice, 2026-09-27).
// Pastels are used as fills only; text always uses the deep tones so it stays readable at 3 AM.
export const Palette = {
  cream: '#FFF8F3',
  peach: '#FDEBE1',
  peachDeep: '#F5D9CB',
  apricot: '#F7B8A1',
  apricotInk: '#4A2418',
  mint: '#BFE3D0',
  mintInk: '#1F4436',
  mintDeep: '#2F6B54',
  cocoa: '#3B2F2A',
  cocoaSoft: '#6B5750',
  night: '#1E1A19',
  nightSurface: '#2B2523',
  nightBorder: '#3D3431',
  mist: '#F7EDE7',
  mistSoft: '#C2B2AA',
  mintNight: '#8FC7AE',
  mintNightInk: '#10271E',
  mintNightLink: '#9FD8BE',
  apricotNight: '#F2A98E',
  apricotNightInk: '#2A120A',
} as const;

export const Colors = {
  light: {
    background: Palette.cream,
    surface: Palette.peach,
    border: Palette.peachDeep,
    text: Palette.cocoa,
    textSecondary: Palette.cocoaSoft,
    primary: Palette.mint, // button fill
    onPrimary: Palette.mintInk,
    link: Palette.mintDeep, // text-weight buttons, active tab, links
    accent: Palette.apricot,
    onAccent: Palette.apricotInk,
  },
  dark: {
    background: Palette.night,
    surface: Palette.nightSurface,
    border: Palette.nightBorder,
    text: Palette.mist,
    textSecondary: Palette.mistSoft,
    primary: Palette.mintNight,
    onPrimary: Palette.mintNightInk,
    link: Palette.mintNightLink,
    accent: Palette.apricotNight,
    onAccent: Palette.apricotNightInk,
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const Radius = { sm: 8, md: 16, lg: 24, pill: 999 } as const;

// Minimum touch target for one-handed, 3 AM use (§9, §24).
export const TouchTarget = 56;

export const Type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const;
