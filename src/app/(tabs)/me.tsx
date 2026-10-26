import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { AppText, BrandMark, Card, Divider, ListRow, ScreenScroll, elevation, radius, spacing, useColors } from '@/design-system';
import { confirmedDatesBetween, countByStatus } from '@/features/items/item-repository';
import { currentOcrProviderId } from '@/features/ocr/ocr-service';
import { useLoader } from '@/hooks/use-loader';
import { APP_VERSION, SUPPORT_EMAIL } from '@/utils/app-info';
import { addDays, toYmd } from '@/utils/dates';

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'error' }) {
  const c = useColors();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <AppText variant="caption" tone="tertiary">{label}</AppText>
      <AppText variant="title" style={{ color: tone === 'error' ? c.error : c.textPrimary }}>{value}</AppText>
    </View>
  );
}

/** 마이페이지: local-only profile (no account), stats and settings menu. */
export default function MeScreen() {
  const router = useRouter();
  const c = useColors();
  const { data } = useLoader(async () => {
    const today = toYmd(new Date());
    const [counts, soon] = await Promise.all([countByStatus(), confirmedDatesBetween(today, addDays(today, 8))]);
    return { counts, soon: new Set(soon.map((s) => s.item.id)).size };
  });
  const saved = data ? data.counts.active + data.counts.completed + data.counts.archived : '-';

  return (
    <ScreenScroll topInset>
      <View style={styles.profile}>
        <View style={[styles.avatar, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="person" size={28} color={c.accentText} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="sectionTitle">내 KeepOn</AppText>
          <AppText variant="caption" tone="tertiary">로그인 없이 이 기기에만 저장 중이에요</AppText>
        </View>
        <BrandMark size={30} />
      </View>

      <View style={[styles.stats, elevation.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Stat label="저장한 정보" value={saved} />
        <View style={[styles.sep, { backgroundColor: c.border }]} />
        <Stat label="완료한 할 일" value={data ? data.counts.completed : '-'} />
        <View style={[styles.sep, { backgroundColor: c.border }]} />
        <Stat label="7일 내 기한" value={data ? data.soon : '-'} tone={data?.soon ? 'error' : undefined} />
      </View>

      <Card padded={false}>
        <ListRow icon="notifications-outline" label="알림·기한" onPress={() => router.push('/reminders')} />
        <Divider inset={spacing.md} />
        <ListRow icon="folder-open-outline" label="완료·보관한 항목" value={data ? `${data.counts.completed + data.counts.archived}개` : undefined} onPress={() => router.push('/library')} />
        <Divider inset={spacing.md} />
        <ListRow icon="settings-outline" label="저장·데이터 설정" onPress={() => router.push('/settings')} />
        <Divider inset={spacing.md} />
        <ListRow icon="shield-checkmark-outline" label="개인정보 처리방침" onPress={() => router.push('/privacy')} />
        <Divider inset={spacing.md} />
        <ListRow icon="code-slash-outline" label="오픈소스 라이선스" onPress={() => router.push('/licenses')} />
        {SUPPORT_EMAIL ? (
          <>
            <Divider inset={spacing.md} />
            <ListRow icon="mail-outline" label="문의하기" value={SUPPORT_EMAIL} role="button" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`[KeepOn ${APP_VERSION}] 문의`)}`).catch(() => {})} />
          </>
        ) : null}
      </Card>

      <Card>
        <View style={{ gap: spacing.xxs }}>
          <AppText variant="label">도움말</AppText>
          <AppText variant="secondary" tone="secondary">
            다른 앱에서 공유 버튼 → ‘KeepOn’을 고르세요. 처음에는 목록 끝의 ‘더보기’ 안에 있을 수 있어요.
          </AppText>
        </View>
      </Card>

      <AppText variant="caption" tone="tertiary" align="center">
        KeepOn {APP_VERSION} · 이미지 글자 인식 {currentOcrProviderId() === 'unavailable' ? '준비 중' : currentOcrProviderId()}
      </AppText>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.card, paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  sep: { width: StyleSheet.hairlineWidth },
});
