import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { InboxItemRow } from '@/components/inbox/InboxItemRow';
import { AppText, BrandHeader, Card, EmptyState, ErrorState, FilterChip, GhostButton, IconButton, InlineMessage, PrimaryButton, Row, ScreenScroll, SegmentTabs, spacing, type IconName } from '@/design-system';
import { CATEGORY_INFO } from '@/domain/categories';
import { CATEGORIES, type ExtractedField, type InboxItem } from '@/domain/models';
import { listItems, upcomingDates } from '@/features/items/item-repository';
import { useAppState } from '@/hooks/app-state';
import { useLoader } from '@/hooks/use-loader';
import { diffDays, toYmd } from '@/utils/dates';

type Filter = 'recent' | 'review' | 'soon';

export default function InboxScreen() {
  const router = useRouter();
  const { ready, dbError, retry, settings, updateSettings } = useAppState();
  const [filter, setFilter] = useState<Filter>('recent');

  const { data, error } = useLoader(async () => {
    const items = await listItems({ statuses: ['active'] });
    const dates = await upcomingDates(items.map((i) => i.id), toYmd(new Date()));
    return { items, dates };
  });

  if (dbError) return <ErrorState title="데이터를 열지 못했어요" message="기기 저장 공간을 확인한 뒤 다시 시도해 주세요. 저장된 데이터는 지워지지 않았어요." onRetry={retry} />;

  const items = data?.items ?? [];
  const dates = data?.dates ?? new Map<string, ExtractedField>();
  const today = toYmd(new Date());
  const visible = items.filter((i: InboxItem) => {
    if (filter === 'review') return i.needsReview;
    if (filter === 'soon') {
      const d = dates.get(i.id)?.normalizedValue;
      const n = d ? diffDays(today, d) : NaN;
      return n >= 0 && n <= 7;
    }
    return true;
  });
  if (filter === 'soon') visible.sort((a, b) => (dates.get(a.id)?.normalizedValue ?? '').localeCompare(dates.get(b.id)?.normalizedValue ?? ''));
  const reviewCount = items.filter((i) => i.needsReview).length;

  return (
    <ScreenScroll topInset>
      <Row style={{ justifyContent: 'space-between' }}>
        <BrandHeader />
        <IconButton icon="add-circle" label="새 항목 추가" onPress={() => router.push('/capture')} size={30} testID="add-item" />
      </Row>

      {ready && !settings.onboardingSeenAt ? (
        <Card>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="sectionTitle">딸깍은 이렇게 동작해요</AppText>
            <AppText variant="secondary" tone="secondary">
              다른 앱의 공유 메뉴에서 링크·텍스트·이미지를 딸깍으로 보내거나, 여기서 직접 추가하세요. 날짜·금액은 기기 안에서 규칙으로 찾아 후보로 보여 드리고, 직접 확인한 값만 알림에 써요.
            </AppText>
            <AppText variant="caption" tone="tertiary">로그인·서버 없이 기기 안에만 저장돼요. 앱이 사진첩이나 대화를 스스로 읽지 않아요.</AppText>
            <Row gap={spacing.xs}>
              <GhostButton compact label="알겠어요" onPress={() => updateSettings({ onboardingSeenAt: new Date().toISOString() })} />
              <GhostButton compact label="개인정보 안내" onPress={() => router.push('/privacy')} />
            </Row>
          </View>
        </Card>
      ) : null}

      {error ? <InlineMessage tone="error" message="목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." /> : null}

      <SegmentTabs<Filter>
        value={filter}
        onChange={setFilter}
        tabs={[
          { id: 'recent', label: '최근 저장' },
          { id: 'review', label: reviewCount ? `검토 필요 ${reviewCount}` : '검토 필요' },
          { id: 'soon', label: '7일 안 기한' },
        ]}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
        {CATEGORIES.map((id) => (
          <FilterChip key={id} label={CATEGORY_INFO[id].label} icon={CATEGORY_INFO[id].icon as IconName} selected={false} onPress={() => router.push({ pathname: '/category/[category]', params: { category: id } })} />
        ))}
      </ScrollView>

      {ready && data && !items.length ? (
        <EmptyState
          title="아직 저장한 항목이 없어요"
          message="카카오톡·브라우저·사진 앱의 공유 메뉴에서 '딸깍'을 고르거나, 링크·텍스트를 직접 붙여 넣어 보세요."
          actionLabel="직접 추가하기"
          onAction={() => router.push('/capture')}
        />
      ) : null}
      {data && items.length > 0 && !visible.length ? (
        <AppText variant="secondary" tone="secondary" align="center">
          {filter === 'review' ? '검토할 항목이 없어요.' : '7일 안에 다가오는 날짜가 없어요.'}
        </AppText>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        {visible.map((item) => (
          <InboxItemRow key={item.id} item={item} nextDate={dates.get(item.id)} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} />
        ))}
      </View>

      {items.length ? <PrimaryButton icon="add" label="추가하기" onPress={() => router.push('/capture')} /> : null}
    </ScreenScroll>
  );
}
