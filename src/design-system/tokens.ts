/**
 * 딸깍 design tokens — "Calm Personal Inbox", deep-green edition (2026-10-24 redesign).
 * Near-white mint background, white rounded cards, deep green for primary actions,
 * pastel circles per category. Status always pairs color with an icon and text.
 * Rules: docs/DESIGN_SYSTEM.md. Screens must not define their own colors/spacings.
 */

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  /** Accent used as text on light surfaces (≥ 4.5:1). */
  accentText: string;
  selected: string;
  selectedText: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  error: string;
  errorSoft: string;
  scrim: string;
}

export const lightColors: ColorTokens = {
  background: '#F5F8F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#EDF2F0',
  textPrimary: '#16201D',
  textSecondary: '#55605C',
  textTertiary: '#7E8884',
  textOnAccent: '#FFFFFF',
  border: '#E2E8E5',
  borderStrong: '#CBD4D0',
  // Deep green: white text on it ≈ 11:1.
  accent: '#1F3D36',
  accentPressed: '#152C27',
  accentSoft: '#E4F1EB',
  accentText: '#1E6B4E',
  selected: '#1F3D36',
  selectedText: '#FFFFFF',
  success: '#1E7A4C',
  successSoft: '#E4F3EA',
  warning: '#8A5A00',
  warningSoft: '#FBF1DC',
  error: '#C0352B',
  errorSoft: '#FCE8E6',
  scrim: 'rgba(0,0,0,0.45)',
};

export const darkColors: ColorTokens = {
  background: '#0E1311',
  surface: '#18201D',
  surfaceElevated: '#202A26',
  surfaceSunken: '#090D0B',
  textPrimary: '#EEF3F1',
  textSecondary: '#A9B5B0',
  textTertiary: '#83908B',
  textOnAccent: '#0B1A15',
  border: '#28322E',
  borderStrong: '#3A4641',
  accent: '#8FD3B4',
  accentPressed: '#7AC3A3',
  accentSoft: '#183028',
  accentText: '#9FDCC0',
  selected: '#8FD3B4',
  selectedText: '#0B1A15',
  success: '#5CC58F',
  successSoft: '#13291C',
  warning: '#E8B54A',
  warningSoft: '#2E240E',
  error: '#FF8A80',
  errorSoft: '#3A1715',
  scrim: 'rgba(0,0,0,0.65)',
};

/** Pastel circle tones for category icons (bg = circle, fg = icon). Icon + label, never color alone. */
export type CategoryToneName = 'green' | 'orange' | 'blue' | 'purple' | 'pink' | 'teal' | 'yellow' | 'gray' | 'indigo';
export const categoryTones: Record<'light' | 'dark', Record<CategoryToneName, { bg: string; fg: string }>> = {
  light: {
    green: { bg: '#E3F4EA', fg: '#1F8A55' },
    orange: { bg: '#FDEEE2', fg: '#C2581C' },
    blue: { bg: '#E4EEFB', fg: '#2B63B8' },
    purple: { bg: '#EFE8FB', fg: '#6B47B8' },
    pink: { bg: '#FBE7EE', fg: '#B83A67' },
    teal: { bg: '#E1F3F3', fg: '#1E7F7F' },
    yellow: { bg: '#FBF3DC', fg: '#8F6500' },
    gray: { bg: '#ECEFEE', fg: '#55605C' },
    indigo: { bg: '#E8EAFB', fg: '#4048B0' },
  },
  dark: {
    green: { bg: '#163225', fg: '#7FD3A6' },
    orange: { bg: '#3A2416', fg: '#F2A877' },
    blue: { bg: '#172A42', fg: '#8DB6F2' },
    purple: { bg: '#2A2140', fg: '#BBA2F2' },
    pink: { bg: '#3A1A27', fg: '#F29BBB' },
    teal: { bg: '#143232', fg: '#7FD3D3' },
    yellow: { bg: '#352B10', fg: '#E8C55A' },
    gray: { bg: '#232B28', fg: '#A9B5B0' },
    indigo: { bg: '#1E2142', fg: '#A3A9F2' },
  },
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  photo: 10,
  tile: 14,
  chip: 999,
  /** Text fields, inline messages, buttons. */
  button: 14,
  card: 18,
  sheet: 24,
} as const;

export const elevation = {
  raised: { shadowColor: '#0F1A33', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  card: { shadowColor: '#0F1A33', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
} as const;

/**
 * Pretendard (SIL OFL 1.1) for all text. Each weight is its own family so Android never fakes
 * bold on top of a bold file — set `fontFamily`, not `fontWeight`.
 */
export const fonts = {
  regular: 'Pretendard-Regular',
  medium: 'Pretendard-Medium',
  semibold: 'Pretendard-SemiBold',
  bold: 'Pretendard-Bold',
} as const;

export function fontForWeight(weight: string | number | undefined): string {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

export const typography = {
  screenTitle: { fontSize: 26, lineHeight: 34, fontFamily: fonts.bold, letterSpacing: -0.4 },
  title: { fontSize: 21, lineHeight: 29, fontFamily: fonts.bold, letterSpacing: -0.3 },
  sectionTitle: { fontSize: 17, lineHeight: 24, fontFamily: fonts.bold, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fonts.regular },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: fonts.semibold },
  secondary: { fontSize: 14, lineHeight: 21, fontFamily: fonts.regular },
  label: { fontSize: 14, lineHeight: 20, fontFamily: fonts.semibold },
  /** Dates, deadlines, metadata. */
  meta: { fontSize: 13, lineHeight: 18, fontFamily: fonts.medium },
  caption: { fontSize: 12, lineHeight: 17, fontFamily: fonts.medium },
  /** Dates and amounts that must line up. */
  numeric: { fontSize: 15, lineHeight: 21, fontFamily: fonts.semibold, fontVariant: ['tabular-nums'] },
} as const;

/** Minimum touch target (pt). */
export const touchTarget = 44;

/** Bottom action bar height cap. */
export const bottomBarMaxHeight = 96;
export const bottomBarSummaryHeight = 28;

/** Content column cap so cards don't grow huge on tablets / the web preview. */
export const contentMaxWidth = 640;
