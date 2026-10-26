import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, BRAND_NAME, BRAND_TAGLINE, BrandMark, PrimaryButton, fonts, spacing, useColors } from '@/design-system';
import { useAppState } from '@/hooks/app-state';

const POINTS = [
  { title: '공유하면 모여요', body: '카카오톡·브라우저·갤러리의 공유 메뉴에서 ‘KeepOn’을 고르세요.' },
  { title: '날짜·금액은 후보로', body: '기기 안의 규칙으로 찾아 보여 드리고, 직접 확인한 값만 알림에 써요.' },
  { title: '기기 안에만 저장', body: '로그인·서버 없이 동작해요. 앱이 사진첩이나 대화를 스스로 읽지 않아요.' },
];

/** First-run screen (splash style): logo, tagline, three short promises, start. */
export default function OnboardingScreen() {
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { updateSettings } = useAppState();

  const start = async () => {
    await updateSettings({ onboardingSeenAt: new Date().toISOString() });
    router.replace('/');
  };

  return (
    <View style={[styles.wrap, { backgroundColor: c.accentSoft, paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.center}>
        <BrandMark size={84} />
        <AppText accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 40, lineHeight: 48, letterSpacing: -1, color: c.textPrimary }} maxFontSizeMultiplier={1.3}>
          {BRAND_NAME}
        </AppText>
        <AppText variant="body" tone="secondary" align="center">{BRAND_TAGLINE}</AppText>
      </View>
      <View style={{ gap: spacing.md }}>
        {POINTS.map((p) => (
          <View key={p.title} style={{ gap: 2 }}>
            <AppText variant="label">{p.title}</AppText>
            <AppText variant="secondary" tone="secondary">{p.body}</AppText>
          </View>
        ))}
      </View>
      <PrimaryButton label="시작하기" onPress={start} testID="onboarding-start" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: 'space-between', gap: spacing.xl },
  center: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl },
});
