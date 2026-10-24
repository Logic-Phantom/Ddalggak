import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, spacing } from '../tokens';
import { AppText } from './AppText';

export const BRAND_NAME = '딸깍';
/** Working slogan (see docs/BRAND_AND_TRADEMARKS.md — name and slogan are provisional). */
export const BRAND_TAGLINE = '저장한 정보를, 딸깍 한 번에.';

const LOGO = require('@/assets/images/splash-icon.png');

/** The app icon itself (unchanged artwork), used as the in-app logo. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size, borderRadius: size * 0.22 }} contentFit="contain" accessible={false} />;
}

/** Logo + wordmark, with an optional subtitle. */
export function BrandHeader({ subtitle = BRAND_TAGLINE, size = 32, style }: { subtitle?: string | null; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, style]}>
      <BrandMark size={size} />
      <View style={{ flexShrink: 1 }}>
        <AppText accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.5 }} maxFontSizeMultiplier={1.4}>
          {BRAND_NAME}
        </AppText>
        {subtitle ? <AppText variant="caption" tone="tertiary" numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
    </View>
  );
}
