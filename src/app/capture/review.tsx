import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';

import { ItemEditor } from '@/components/items/ItemEditor';
import { AppText, EmptyState, GhostButton, InlineMessage, Row, spacing } from '@/design-system';
import { toUserMessage } from '@/domain/errors';
import { analyzeAttachments, canRetryOcr, isOcrCandidate, ocrSummaryText, type OcrSummary } from '@/features/capture/capture-service';
import { normalizeUrl } from '@/features/extraction/url-utils';
import { findByUrlKey, getItem } from '@/features/items/item-repository';
import { discardDraft, setStatus } from '@/features/items/item-service';
import type { OcrFailureReason } from '@/features/ocr/contracts';
import { useAppState } from '@/hooks/app-state';
import { useLoader } from '@/hooks/use-loader';

const SUMMARIES: OcrSummary[] = ['not-needed', 'done', 'partial', 'empty', 'unavailable', 'failed', 'unsupported', 'disabled', 'deferred'];

/**
 * Review of a capture: the user checks the suggested category and values, then saves.
 * Also used later for "임시 저장" (pending) items — there, leaving keeps the item.
 */
export default function ReviewScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string; ocr?: string; ocrReason?: string; skipped?: string }>();
  const { id, skipped } = params;
  const { settings, notifyDataChanged } = useAppState();
  const initialOcr = SUMMARIES.includes(params.ocr as OcrSummary) ? (params.ocr as OcrSummary) : null;
  const [ocr, setOcr] = useState<{ summary: OcrSummary; reason?: OcrFailureReason; added?: number } | null>(
    initialOcr ? { summary: initialOcr, reason: (params.ocrReason || undefined) as OcrFailureReason | undefined } : null,
  );
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data, reload } = useLoader(async () => {
    const item = await getItem(id);
    const key = item?.sourceUrl ? normalizeUrl(item.sourceUrl) : null;
    const duplicates = key ? await findByUrlKey(key, id) : [];
    return { item, duplicates };
  }, [id]);

  useEffect(() => {
    navigation.setOptions({ headerBackVisible: false });
  }, [navigation]);

  if (data && !data.item) return <EmptyState title="항목을 찾을 수 없어요" message="이미 버렸거나 저장된 항목이에요." actionLabel="홈으로" onAction={() => router.replace('/')} />;
  if (!data?.item) return null;
  const item = data.item;
  const isDraft = item.status === 'draft';
  const ocrFiles = item.attachments.filter((a) => isOcrCandidate(a.mimeType));
  const alreadyRead = !!item.ocrText || item.fields.some((f) => f.method === 'ocr');
  const offerOcr = ocrFiles.length > 0 && settings.ocrEnabled && (ocr ? canRetryOcr(ocr.summary) || ocr.summary === 'empty' : true);

  const readText = async () => {
    setReading(true);
    setError(null);
    try {
      const r = await analyzeAttachments(item.id, settings);
      setOcr({ summary: r.ocr, reason: r.reason, added: r.added });
      notifyDataChanged();
      reload();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setReading(false);
    }
  };

  const later = async () => {
    try {
      if (isDraft) await setStatus(item.id, 'pending');
      notifyDataChanged();
      router.replace({ pathname: '/item/[id]', params: { id: item.id, quick: '1' } });
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

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

  const ocrText = ocr ? ocrSummaryText(ocr.summary, ocr.reason) : null;
  const ocrTone = ocr && ['done', 'deferred', 'disabled', 'not-needed'].includes(ocr.summary) ? 'info' : 'warning';

  return (
    <ItemEditor
      item={item}
      mode="review"
      reload={reload}
      cancelLabel={isDraft ? '버리기' : '나중에'}
      onCancel={isDraft ? discard : () => (router.canGoBack() ? router.back() : router.replace('/'))}
      onSaved={() => {
        notifyDataChanged();
        router.replace({ pathname: '/item/[id]', params: { id: item.id, saved: '1' } });
      }}
      notices={
        <View style={{ gap: spacing.xs }}>
          {error ? <InlineMessage tone="error" message={error} /> : null}
          {ocrText ? (
            <InlineMessage
              tone={ocrTone}
              message={ocr?.added ? `${ocrText} 새 후보 ${ocr.added}개를 찾았어요.` : ocrText}
            />
          ) : null}
          {skipped ? <InlineMessage tone="warning" message={skipped} /> : null}
          {data.duplicates.length ? (
            <InlineMessage
              tone="info"
              title="같은 링크를 저장한 적이 있어요"
              message={`‘${data.duplicates[0].title}’과 같은 링크예요. 그래도 따로 저장할 수 있어요.`}
            />
          ) : null}
          <Row wrap gap={spacing.xs}>
            {offerOcr ? (
              <GhostButton
                compact
                icon="scan-outline"
                label={ocr?.summary === 'failed' || ocr?.summary === 'partial' ? '글자 인식 다시 시도' : alreadyRead ? '이미지 글자 다시 읽기' : '이미지 글자 읽기'}
                onPress={readText}
                loading={reading}
                accessibilityHint="기기 안에서 첨부 이미지·PDF의 글자를 읽어 후보를 찾아요. 직접 확인·수정한 값은 바뀌지 않아요."
                testID="read-ocr"
              />
            ) : null}
            {isDraft ? <GhostButton compact icon="time-outline" label="임시 저장" onPress={later} accessibilityHint="확인은 나중에 하고 지금은 임시 저장해요." testID="save-later" /> : null}
          </Row>
          <AppText variant="caption" tone="tertiary">자동으로 찾은 값이에요. 틀릴 수 있으니 한 번 확인해 주세요.</AppText>
        </View>
      }
    />
  );
}
