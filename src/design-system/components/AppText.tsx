import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { useColors } from '../theme';
import { fontForWeight, typography } from '../tokens';

export type TextVariant = keyof typeof typography;
export type TextTone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'error' | 'success' | 'warning' | 'onAccent';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
}

export function AppText({ variant = 'body', tone = 'primary', align, style, ...rest }: AppTextProps) {
  const c = useColors();
  const color = {
    primary: c.textPrimary,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    accent: c.accent,
    error: c.error,
    success: c.success,
    warning: c.warning,
    onAccent: c.textOnAccent,
  }[tone];
  const role = variant === 'screenTitle' || variant === 'sectionTitle' ? 'header' : undefined;
  // Each Pretendard weight is its own family: turn an inline fontWeight into that family.
  const weight = (StyleSheet.flatten(style) as TextStyle | undefined)?.fontWeight;
  const weightStyle: TextStyle | null = weight != null ? { fontFamily: fontForWeight(weight), fontWeight: 'normal' } : null;
  return <Text accessibilityRole={role} maxFontSizeMultiplier={2} style={[typography[variant] as TextStyle, { color, textAlign: align }, style, weightStyle]} {...rest} />;
}
