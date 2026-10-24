import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { InboxItemRow } from '@/components/inbox/InboxItemRow';
import { EmptyState, ScreenScroll, spacing } from '@/design-system';
import { CATEGORY_INFO } from '@/domain/categories';
import { CATEGORIES, type Category } from '@/domain/models';
import { listItems, upcomingDates } from '@/features/items/item-repository';
import { useLoader } from '@/hooks/use-loader';
import { toYmd } from '@/utils/dates';

export default function CategoryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ category: string }>();
  const category = (CATEGORIES as readonly string[]).includes(params.category) ? (params.category as Category) : 'other';
  const info = CATEGORY_INFO[category];

  useEffect(() => navigation.setOptions({ title: info.label }), [navigation, info.label]);

  const { data } = useLoader(async () => {
    const items = await listItems({ statuses: ['active'], category });
    return { items, dates: await upcomingDates(items.map((i) => i.id), toYmd(new Date())) };
  }, [category]);

  return (
    <ScreenScroll>
      {data && !data.items.length ? <EmptyState title={`${info.label} 항목이 없어요`} message="저장할 때 분류를 바꾸면 여기에 모여요." /> : null}
      <View style={{ gap: spacing.sm }}>
        {data?.items.map((item) => (
          <InboxItemRow key={item.id} item={item} nextDate={data.dates.get(item.id)} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} />
        ))}
      </View>
    </ScreenScroll>
  );
}
