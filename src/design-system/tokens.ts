/**
 * 딸깍 design tokens — "Calm Personal Inbox".
 * Quiet neutral background, white cards, one restrained blue accent for actions and selection.
 * Status (review needed / due soon / done) always pairs color with an icon and text.
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
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#EEF0F3',
  textPrimary: '#191B20',
  textSecondary: '#555B66',
  textTertiary: '#7C818B',
  textOnAccent: '#FFFFFF',
  border: '#E4E6EB',
  borderStrong: '#CDD1D8',
  // White text on accent ≈ 6:1.
  accent: '#2F5BD3',
  accentPressed: '#244AB3',
  accentSoft: '#EAF0FD',
  accentText: '#2449B0',
  selected: '#2F5BD3',
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
  background: '#101114',
  surface: '#1A1C20',
  surfaceElevated: '#23262B',
  surfaceSunken: '#0A0B0D',
  textPrimary: '#F2F3F5',
  textSecondary: '#AEB3BC',
  textTertiary: '#868B94',
  textOnAccent: '#0B1530',
  border: '#2A2D33',
  borderStrong: '#3C4048',
  accent: '#8FA8FF',
  accentPressed: '#7A95F2',
  accentSoft: '#1C2540',
  accentText: '#A9BDFF',
  selected: '#8FA8FF',
  selectedText: '#0B1530',
  success: '#5CC58F',
  successSoft: '#13291C',
  warning: '#E8B54A',
  warningSoft: '#2E240E',
  error: '#FF8A80',
  errorSoft: '#3A1715',
  scrim: 'rgba(0,0,0,0.65)',
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
  button: 12,
  card: 16,
  sheet: 22,
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
