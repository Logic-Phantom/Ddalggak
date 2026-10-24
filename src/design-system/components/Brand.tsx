import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '../theme';
import { fonts, spacing } from '../tokens';
import { AppText } from './AppText';

export const BRAND_NAME = '딸깍';
/** Working slogan (see docs/BRAND_AND_TRADEMARKS.md — name and slogan are provisional). */
export const BRAND_TAGLINE = '저장한 정보를, 딸깍 한 번에.';

/** Tab-screen header: dot mark + wordmark, with an optional subtitle. */
export function BrandHeader({ subtitle = BRAND_TAGLINE, style }: { subtitle?: string | null; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, style]}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.accent }} accessible={false} />
      <View style={{ flexShrink: 1 }}>
        <AppText accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 }} maxFontSizeMultiplier={1.4}>
          {BRAND_NAME}
        </AppText>
        {subtitle ? <AppText variant="caption" tone="tertiary" numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
    </View>
  );
}
