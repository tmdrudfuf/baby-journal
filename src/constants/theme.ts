// Design tokens (masterplan §22). Warm, calm, gender-neutral.
export const Palette = {
  ivory: '#FAF6EF',
  oatmeal: '#F1E9DC',
  oatmealDeep: '#E4D8C6',
  sage: '#4F6B53',
  sageLight: '#9DB8A0',
  apricot: '#F2B48C',
  apricotDeep: '#E8A27A',
  charcoal: '#2E2A26',
  charcoalSoft: '#6B625A',
  night: '#1C1A18',
  nightSurface: '#2A2724',
  nightBorder: '#3A3632',
  mist: '#F2EDE6',
  mistSoft: '#B5ACA2',
} as const;

export const Colors = {
  light: {
    background: Palette.ivory,
    surface: Palette.oatmeal,
    border: Palette.oatmealDeep,
    text: Palette.charcoal,
    textSecondary: Palette.charcoalSoft,
    primary: Palette.sage,
    onPrimary: Palette.ivory,
    accent: Palette.apricot,
    onAccent: Palette.charcoal,
  },
  dark: {
    background: Palette.night,
    surface: Palette.nightSurface,
    border: Palette.nightBorder,
    text: Palette.mist,
    textSecondary: Palette.mistSoft,
    primary: Palette.sageLight,
    onPrimary: Palette.night,
    accent: Palette.apricotDeep,
    onAccent: Palette.night,
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
