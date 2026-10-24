import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { InboxItemRow } from '@/components/inbox/InboxItemRow';
import { EmptyState, ScreenScroll, SegmentTabs, spacing } from '@/design-system';
import { listItems } from '@/features/items/item-repository';
import { useLoader } from '@/hooks/use-loader';

export default function ArchiveScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'archived' | 'completed'>('archived');
  const { data } = useLoader(() => listItems({ statuses: [tab] }), [tab]);

  return (
    <ScreenScroll>
      <SegmentTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'archived', label: '보관됨' },
          { id: 'completed', label: '완료' },
        ]}
      />
      {data && !data.length ? <EmptyState icon="archive-outline" title={tab === 'archived' ? '보관한 항목이 없어요' : '완료한 항목이 없어요'} message="항목 상세에서 보관하거나 완료로 옮길 수 있어요." /> : null}
      <View style={{ gap: spacing.sm }}>
        {data?.map((item) => <InboxItemRow key={item.id} item={item} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} />)}
      </View>
    </ScreenScroll>
  );
}
