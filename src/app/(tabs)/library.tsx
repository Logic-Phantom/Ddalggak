import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { InboxItemRow } from '@/components/inbox/InboxItemRow';
import { AppText, EmptyState, FilterChip, ScreenScroll, SegmentTabs, spacing, useColors } from '@/design-system';
import { CATEGORY_INFO } from '@/domain/categories';
import { CATEGORIES, type Category, type ItemStatus } from '@/domain/models';
import { firstImages, listItems, upcomingDates } from '@/features/items/item-repository';
import { useLoader } from '@/hooks/use-loader';
import { toYmd } from '@/utils/dates';

type StatusTab = 'active' | 'pending' | 'completed' | 'archived';
const STATUS_TABS: StatusTab[] = ['active', 'pending', 'completed', 'archived'];

/** 보관함: every saved item, filtered by category chip, status tab and "검토 필요". */
export default function LibraryScreen() {
  const router = useRouter();
  const c = useColors();
  const params = useLocalSearchParams<{ category?: string; filter?: string; status?: string }>();
  const paramCategory = params.category && (CATEGORIES as readonly string[]).includes(params.category) ? (params.category as Category) : null;
  const paramStatus = STATUS_TABS.includes(params.status as StatusTab) ? (params.status as StatusTab) : 'active';

  // Navigation params (from home) override the local choice until the user picks something here.
  const [picked, setPicked] = useState<{ category: Category | null; review: boolean; from: string } | null>(null);
  const [pickedStatus, setPickedStatus] = useState<{ status: StatusTab; from: string } | null>(null);
  const paramKey = `${params.category ?? ''}|${params.filter ?? ''}|${params.status ?? ''}`;
  const category = picked && picked.from === paramKey ? picked.category : paramCategory;
  const reviewOnly = picked && picked.from === paramKey ? picked.review : params.filter === 'review';
  const status = pickedStatus && pickedStatus.from === paramKey ? pickedStatus.status : paramStatus;
  const setStatus = (next: StatusTab) => setPickedStatus({ status: next, from: paramKey });

  const { data } = useLoader(async () => {
    const items = await listItems({ statuses: [status as ItemStatus], category, needsReview: reviewOnly ? true : undefined });
    const ids = items.map((i) => i.id);
    const [dates, thumbs] = await Promise.all([upcomingDates(ids, toYmd(new Date())), firstImages(ids)]);
    return { items, dates, thumbs };
  }, [status, category, reviewOnly]);

  const choose = (next: Category | null, review = false) => setPicked({ category: next, review, from: paramKey });

  return (
    <ScreenScroll topInset>
      <View style={styles.head}>
        <AppText variant="screenTitle">보관함</AppText>
        <Pressable onPress={() => router.push('/search')} accessibilityRole="button" accessibilityLabel="검색" hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="search" size={22} color={c.textPrimary} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
        <FilterChip role="radio" label="전체" selected={!category && !reviewOnly} onPress={() => choose(null)} />
        <FilterChip role="radio" label="검토 필요" icon="alert-circle-outline" selected={reviewOnly} onPress={() => choose(null, true)} />
        {CATEGORIES.map((id) => (
          <FilterChip key={id} role="radio" label={CATEGORY_INFO[id].short} selected={category === id && !reviewOnly} onPress={() => choose(id)} />
        ))}
      </ScrollView>

      <SegmentTabs<StatusTab>
        value={status}
        onChange={setStatus}
        tabs={[
          { id: 'active', label: '진행 중' },
          { id: 'pending', label: '임시 저장' },
          { id: 'completed', label: '완료' },
          { id: 'archived', label: '보관됨' },
        ]}
      />

      {data && !data.items.length ? (
        <EmptyState
          icon="folder-open-outline"
          title="아직 비어 있어요"
          message={
            status === 'active'
              ? '공유하거나 직접 추가한 정보가 여기에 모여요.'
              : status === 'pending'
                ? '‘임시 저장’한 항목이 여기에 모여요.'
                : '상세에서 완료하거나 보관하면 여기로 와요.'
          }
        />
      ) : null}

      <View style={{ gap: spacing.sm }}>
        {data?.items.map((item) => (
          <InboxItemRow
            key={item.id}
            item={item}
            nextDate={data.dates.get(item.id)}
            thumbnail={data.thumbs.get(item.id)}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
          />
        ))}
      </View>
      {data?.items.length ? <AppText variant="caption" tone="tertiary" align="center">{data.items.length}개</AppText> : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
