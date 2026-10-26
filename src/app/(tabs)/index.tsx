import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { InboxItemRow } from '@/components/inbox/InboxItemRow';
import { AppText, BrandMark, BrandWordmark, CategoryIcon, CategoryTile, EmptyState, ErrorState, InlineMessage, ScreenScroll, SectionLink, elevation, radius, spacing, useColors } from '@/design-system';
import { PRIMARY_CATEGORIES, fieldLabel } from '@/domain/categories';
import type { ExtractedField, InboxItem } from '@/domain/models';
import { firstImages, listItems, upcomingDates } from '@/features/items/item-repository';
import { useAppState } from '@/hooks/app-state';
import { useLoader } from '@/hooks/use-loader';
import { dDayLabel, diffDays, formatLocal, toYmd } from '@/utils/dates';

/** "다음 일정" card: category tile, date, title, date meaning and D-day. */
function DueRow({ item, date, onPress }: { item: InboxItem; date: ExtractedField; onPress: () => void }) {
  const c = useColors();
  const d = date.normalizedValue!;
  const soon = diffDays(toYmd(new Date()), d) <= 3;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${fieldLabel('date', date.role)} ${formatLocal(d)}, ${dDayLabel(d)}`}
      style={({ pressed }) => [styles.due, elevation.card, { backgroundColor: pressed ? c.surfaceSunken : c.surface, borderColor: c.border }]}>
      <CategoryIcon category={item.category} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="meta" tone="secondary">{formatLocal(d)}</AppText>
        <AppText variant="bodyStrong" numberOfLines={1}>{item.title}</AppText>
        <AppText variant="caption" tone="tertiary" numberOfLines={1}>{fieldLabel('date', date.role)}</AppText>
      </View>
      <AppText variant="caption" style={{ color: soon ? c.error : c.accentText, fontWeight: '700' }}>{dDayLabel(d)}</AppText>
      <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const c = useColors();
  const { ready, dbError, retry } = useAppState();

  const { data, error } = useLoader(async () => {
    const items = await listItems({ statuses: ['active'] });
    const ids = items.map((i) => i.id);
    const [dates, thumbs] = await Promise.all([upcomingDates(ids, toYmd(new Date())), firstImages(ids)]);
    return { items, dates, thumbs };
  });

  if (dbError) return <ErrorState title="데이터를 열지 못했어요" message="기기 저장 공간을 확인한 뒤 다시 시도해 주세요. 저장된 데이터는 지워지지 않았어요." onRetry={retry} />;

  const items = data?.items ?? [];
  const dates = data?.dates ?? new Map<string, ExtractedField>();
  const thumbs = data?.thumbs ?? new Map<string, string>();
  const today = toYmd(new Date());
  const due = items
    .filter((i) => {
      const d = dates.get(i.id);
      if (!d?.userConfirmed || !d.normalizedValue) return false;
      const n = diffDays(today, d.normalizedValue);
      return n >= 0 && n <= 14;
    })
    .sort((a, b) => dates.get(a.id)!.normalizedValue!.localeCompare(dates.get(b.id)!.normalizedValue!));
  const reviewCount = items.filter((i) => i.needsReview).length;
  const openItem = (id: string) => router.push({ pathname: '/item/[id]', params: { id } });
  const openCategory = (category?: string) => router.push({ pathname: '/library', params: category ? { category } : {} });

  return (
    <ScreenScroll topInset>
      <View style={styles.header}>
        <BrandWordmark size={26} />
        <View style={styles.headerIcons}>
          <Pressable onPress={() => router.push('/search')} accessibilityRole="button" accessibilityLabel="검색" hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="search-outline" size={23} color={c.textPrimary} />
          </Pressable>
          <Pressable onPress={() => router.push('/reminders')} accessibilityRole="button" accessibilityLabel="알림·기한" hitSlop={8} style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={23} color={c.textPrimary} />
          </Pressable>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <BrandMark size={36} />
        <AppText variant="screenTitle" accessibilityRole="header">필요한 정보,{'\n'}놓치지 않게 킵온.</AppText>
      </View>

      <Pressable
        onPress={() => router.push('/search')}
        accessibilityRole="search"
        accessibilityLabel="저장한 정보 검색하기"
        style={[styles.searchPill, elevation.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Ionicons name="search-outline" size={18} color={c.textTertiary} />
        <AppText variant="secondary" tone="tertiary">저장한 정보 검색하기</AppText>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingVertical: spacing.xxs }}>
        <CategoryTile category="all" onPress={() => openCategory()} />
        {PRIMARY_CATEGORIES.map((id) => (
          <CategoryTile key={id} category={id} onPress={() => openCategory(id)} />
        ))}
      </ScrollView>

      {error ? <InlineMessage tone="error" message="목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." /> : null}

      {reviewCount ? (
        <Pressable
          onPress={() => router.push({ pathname: '/library', params: { filter: 'review' } })}
          accessibilityRole="button"
          style={[styles.banner, { backgroundColor: c.warningSoft }]}>
          <Ionicons name="alert-circle" size={20} color={c.warning} />
          <AppText variant="label" style={{ flex: 1, color: c.warning }}>확인이 필요한 항목이 {reviewCount}개 있어요</AppText>
          <Ionicons name="chevron-forward" size={18} color={c.warning} />
        </Pressable>
      ) : null}

      {due.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionLink title="다음 일정" onPress={() => router.push('/reminders')} />
          {due.slice(0, 3).map((item) => (
            <DueRow key={item.id} item={item} date={dates.get(item.id)!} onPress={() => openItem(item.id)} />
          ))}
        </View>
      ) : null}

      {ready && data && !items.length ? (
        <EmptyState
          title="아직 저장한 정보가 없어요"
          message="카카오톡·브라우저·갤러리의 공유 메뉴에서 '킵온'을 고르거나(목록에 없으면 '더보기'), 링크·텍스트를 직접 추가해 보세요."
          actionLabel="직접 추가하기"
          onAction={() => router.push('/capture')}
        />
      ) : null}

      {items.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionLink title="최근 저장한 정보" onPress={() => openCategory()} />
          {items.slice(0, 5).map((item) => (
            <InboxItemRow key={item.id} item={item} nextDate={dates.get(item.id)} thumbnail={thumbs.get(item.id)} onPress={() => openItem(item.id)} />
          ))}
        </View>
      ) : null}

      <AppText variant="caption" tone="tertiary" align="center">모든 정보는 이 기기 안에만 저장돼요.</AppText>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 50, borderRadius: radius.chip, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.button, minHeight: 48 },
  due: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
});
