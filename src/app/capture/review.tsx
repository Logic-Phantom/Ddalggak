import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, View } from 'react-native';

import { ItemEditor } from '@/components/items/ItemEditor';
import { AppText, EmptyState, InlineMessage, spacing } from '@/design-system';
import { normalizeUrl } from '@/features/extraction/url-utils';
import { findByUrlKey, getItem } from '@/features/items/item-repository';
import { discardDraft } from '@/features/items/item-service';
import { useAppState } from '@/hooks/app-state';
import { useLoader } from '@/hooks/use-loader';

/** Review of a fresh capture: the user checks the suggested category and values, then saves. */
export default function ReviewScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id, ocr, skipped } = useLocalSearchParams<{ id: string; ocr?: string; skipped?: string }>();
  const { notifyDataChanged } = useAppState();
  const { data, reload } = useLoader(async () => {
    const item = await getItem(id);
    const key = item?.sourceUrl ? normalizeUrl(item.sourceUrl) : null;
    const duplicates = key ? await findByUrlKey(key, id) : [];
    return { item, duplicates };
  }, [id]);

  useEffect(() => {
    navigation.setOptions({ headerBackVisible: false });
  }, [navigation]);

  if (data && !data.item) return <EmptyState title="항목을 찾을 수 없어요" message="이미 버렸거나 저장된 항목이에요." actionLabel="인박스로" onAction={() => router.replace('/')} />;
  if (!data?.item) return null;
  const item = data.item;

  const discard = () =>
    Alert.alert('이 내용을 버릴까요?', '복사된 첨부 파일도 함께 지워져요.', [
      { text: '계속 확인', style: 'cancel' },
      {
        text: '버리기',
        style: 'destructive',
        onPress: async () => {
          await discardDraft(item.id);
          notifyDataChanged();
          router.replace('/');
        },
      },
    ]);

  return (
    <ItemEditor
      item={item}
      mode="review"
      reload={reload}
      onCancel={discard}
      onSaved={() => {
        notifyDataChanged();
        router.replace({ pathname: '/item/[id]', params: { id: item.id, saved: '1' } });
      }}
      notices={
        <View style={{ gap: spacing.xs }}>
          {ocr ? <InlineMessage tone={ocr.includes('읽었어요') ? 'info' : 'warning'} message={ocr} /> : null}
          {skipped ? <InlineMessage tone="warning" message={skipped} /> : null}
          {data.duplicates.length ? (
            <InlineMessage
              tone="info"
              title="같은 링크를 저장한 적이 있어요"
              message={`‘${data.duplicates[0].title}’과 같은 링크예요. 그래도 따로 저장할 수 있어요.`}
            />
          ) : null}
          <AppText variant="caption" tone="tertiary">자동 분류와 값은 기기 안의 규칙으로 찾은 후보예요. 틀릴 수 있어요.</AppText>
        </View>
      }
    />
  );
}
