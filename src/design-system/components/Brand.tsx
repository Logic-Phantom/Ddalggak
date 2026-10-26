import { Image } from 'expo-image';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '../theme';
import { fonts, spacing } from '../tokens';
import { AppText } from './AppText';

export const BRAND_NAME_EN = 'KeepOn';

export const BRAND_NAME = '킵온';
/** Slogan (see docs/BRAND_AND_TRADEMARKS.md). English name: KeepOn. */
export const BRAND_TAGLINE = '저장한 정보, 놓치지 않게.';

const LOGO = require('@/assets/images/splash-icon.png');

/** The app icon itself (unchanged artwork), used as the in-app logo. */
export function BrandMark({ size = 32 }: { size?: number }) {
  return <Image source={LOGO} style={{ width: size, height: size, borderRadius: size * 0.22 }} contentFit="contain" accessible={false} />;
}

/** "킵온" in the accent color, optionally followed by the mint "KeepOn". */
export function BrandWordmark({ size = 26, withEnglish = false }: { size?: number; withEnglish?: boolean }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }} accessible accessibilityRole="header" accessibilityLabel={withEnglish ? `${BRAND_NAME} ${BRAND_NAME_EN}` : BRAND_NAME}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: size, lineHeight: Math.round(size * 1.25), letterSpacing: -0.5, color: c.accent }} maxFontSizeMultiplier={1.4}>
        {BRAND_NAME}
      </AppText>
      {withEnglish ? (
        <AppText style={{ fontFamily: fonts.semibold, fontSize: Math.round(size * 0.55), color: c.brandMint }} maxFontSizeMultiplier={1.4}>
          {BRAND_NAME_EN}
        </AppText>
      ) : null}
    </View>
  );
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
