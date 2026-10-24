import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { InboxItemRow } from '@/components/inbox/InboxItemRow';
import { AppText, FilterChip, Row, ScreenScroll, TextField, spacing } from '@/design-system';
import type { ItemStatus } from '@/domain/models';
import { searchItems } from '@/features/items/item-repository';
import { splitTerms } from '@/features/search/query-normalizer';
import { useLoader } from '@/hooks/use-loader';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const terms = splitTerms(query);
  const statuses: ItemStatus[] = includeArchived ? ['active', 'completed', 'archived'] : ['active'];

  const { data, loading } = useLoader(() => searchItems(terms, { statuses }), [terms.join(' '), includeArchived]);

  return (
    <ScreenScroll topInset>
      <AppText variant="screenTitle">검색</AppText>
      <TextField
        label="검색어"
        value={query}
        onChangeText={setQuery}
        placeholder="상호, 메모, 링크, 태그, 이미지에서 읽은 글자"
        returnKeyType="search"
        autoCapitalize="none"
        clearButtonMode="while-editing"
        testID="search-input"
      />
      <Row wrap gap={spacing.xs}>
        <FilterChip label="보관·완료 항목도 찾기" selected={includeArchived} onPress={() => setIncludeArchived((v) => !v)} />
      </Row>
      {!terms.length ? (
        <AppText variant="secondary" tone="secondary">여러 단어를 띄어 쓰면 모두 포함된 항목을 찾아요. 검색은 기기 안에서만 이루어져요.</AppText>
      ) : !loading && data && !data.length ? (
        <AppText variant="secondary" tone="secondary" accessibilityLiveRegion="polite">‘{query.trim()}’에 맞는 항목이 없어요.</AppText>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        {terms.length
          ? (data ?? []).map((item) => <InboxItemRow key={item.id} item={item} onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })} />)
          : null}
      </View>
    </ScreenScroll>
  );
}
