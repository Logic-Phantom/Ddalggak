import { useLocalSearchParams, useRouter } from 'expo-router';

import { ItemEditor } from '@/components/items/ItemEditor';
import { EmptyState } from '@/design-system';
import { getItem } from '@/features/items/item-repository';
import { useAppState } from '@/hooks/app-state';
import { useLoader } from '@/hooks/use-loader';

export default function EditItemScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { notifyDataChanged } = useAppState();
  const { data, reload } = useLoader(() => getItem(id), [id]);

  if (data === null) return <EmptyState title="항목을 찾을 수 없어요" message="삭제된 항목일 수 있어요." actionLabel="돌아가기" onAction={() => router.back()} />;
  if (!data) return null;
  return (
    <ItemEditor
      item={data}
      mode="edit"
      reload={reload}
      onCancel={() => router.back()}
      onSaved={() => {
        notifyDataChanged();
        router.back();
      }}
    />
  );
}
