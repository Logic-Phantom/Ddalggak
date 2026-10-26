import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomBar, Card, CategoryIcon, GhostButton, IconButton, InlineMessage, PrimaryButton, Row, ScreenScroll, SecondaryButton, SectionHeader, StatusBadge, TextField, elevation, radius, spacing, useColors } from '@/design-system';
import { CATEGORY_INFO } from '@/domain/categories';
import { messageFor, toUserMessage } from '@/domain/errors';
import { categoryHint, classify } from '@/features/extraction/category-classifier';
import { pickDocuments, pickImages } from '@/features/capture/attachment-import-service';
import { createDraft, OCR_SUMMARY_TEXT } from '@/features/capture/capture-service';
import { domainOf, extractUrls } from '@/features/extraction/url-utils';
import { MAX_ITEMS_PER_SHARE, MAX_TEXT_LENGTH } from '@/features/incoming-share/mime-validation';
import { normalizeSharePayloads } from '@/features/incoming-share/share-payload-normalizer';
import type { CaptureInput } from '@/features/incoming-share/types';
import { useSharedPayloads } from '@/features/incoming-share/use-shared-payloads';
import { useAppState } from '@/hooks/app-state';

/** Preview card for one received input. Text is rendered as plain text only (never HTML). */
function InputPreview({ input, onRemove }: { input: CaptureInput; onRemove: () => void }) {
  const c = useColors();
  const isImage = input.kind === 'file' && input.mimeType.startsWith('image/');
  const icon = input.kind === 'url' ? 'link-outline' : input.kind === 'text' ? 'document-text-outline' : input.mimeType === 'application/pdf' ? 'document-outline' : 'image-outline';
  const head = input.kind === 'url' ? input.url : input.kind === 'text' ? '텍스트' : (input.name ?? (isImage ? '이미지' : 'PDF 문서'));
  const body = input.kind === 'url' ? input.text : input.kind === 'text' ? input.text : null;
  return (
    <View style={[styles.preview, elevation.card, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.previewHead}>
        <Ionicons name={icon} size={18} color={c.textSecondary} />
        <AppText variant="meta" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>{head}</AppText>
        <IconButton icon="close" label="이 항목 빼기" onPress={onRemove} size={18} />
      </View>
      {body ? <AppText variant="bodyStrong" numberOfLines={4}>{body}</AppText> : null}
      {isImage && input.kind === 'file' ? (
        <Image source={{ uri: input.uri }} style={styles.previewImage} contentFit="cover" accessibilityLabel="공유받은 이미지" accessibilityIgnoresInvertColors />
      ) : null}
      {input.kind === 'url' && !body ? <AppText variant="caption" tone="tertiary">{domainOf(input.url)} · 링크만 저장하고 페이지를 불러오지 않아요</AppText> : null}
    </View>
  );
}

/**
 * Capture: receives OS share payloads (`?source=share`) or manual input (paste / text / pickers).
 * Creates a draft and moves to the review screen. Nothing is fetched from the network.
 */
export default function CaptureScreen() {
  const c = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string }>();
  const { settings, notifyDataChanged } = useAppState();
  const share = useSharedPayloads();
  const normalized = useMemo(() => normalizeSharePayloads(share.payloads), [share.payloads]);
  const [inputs, setInputs] = useState<CaptureInput[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'warning' | 'error' | 'info'; text: string } | null>(null);

  // Adopt each new shared payload once (state derived during render, React's "previous value" pattern).
  const payloadKey = share.payloads.length ? JSON.stringify(share.payloads) : null;
  const [adopted, setAdopted] = useState<{ key: string; rejected: number; reason: string | null } | null>(null);
  if (payloadKey && payloadKey !== adopted?.key) {
    setAdopted({ key: payloadKey, rejected: normalized.rejected.length, reason: normalized.rejected[0] ? messageFor(normalized.rejected[0].reason) : null });
    setInputs((cur) => [...normalized.inputs, ...cur].slice(0, MAX_ITEMS_PER_SHARE));
  }
  // Then clear it in the OS module so a later app open does not import it again.
  const { clear } = share;
  useEffect(() => {
    if (adopted) clear();
  }, [adopted, clear]);

  const shareNotice = adopted?.rejected
    ? { tone: 'warning' as const, text: `${adopted.rejected}개는 가져오지 못했어요. ${adopted.reason ?? ''}` }
    : params.source === 'share' && !adopted
      ? { tone: 'info' as const, text: '공유된 내용을 찾지 못했어요. 아래에서 링크·텍스트를 붙여 넣거나 파일을 선택해 주세요.' }
      : null;

  const typedInputs = (): CaptureInput[] => {
    const t = text.trim().slice(0, MAX_TEXT_LENGTH);
    if (!t) return [];
    const urls = extractUrls(t);
    return urls.length ? [{ kind: 'url', url: urls[0], text: t === urls[0] ? null : t, sourceType: 'manual' }] : [{ kind: 'text', text: t, sourceType: 'manual' }];
  };
  const all = [...inputs, ...typedInputs()];
  // Instant, real preview of the category rule (same classifier the draft will use; text inputs only).
  const previewText = all.map((i) => (i.kind === 'text' ? i.text : i.kind === 'url' ? `${i.text ?? ''} ${i.url}` : '')).join('\n');
  const previewDomain = all.find((i) => i.kind === 'url') as Extract<CaptureInput, { kind: 'url' }> | undefined;
  const candidates = previewText.trim() ? classify({ text: previewText, domain: previewDomain ? domainOf(previewDomain.url) : null }).filter((x) => x.score > 0).slice(0, 3) : [];

  const addFiles = async (picker: () => Promise<CaptureInput[]>) => {
    try {
      const picked = await picker();
      setInputs((cur) => [...cur, ...picked].slice(0, MAX_ITEMS_PER_SHARE));
    } catch (e) {
      setNotice({ tone: 'error', text: toUserMessage(e) });
    }
  };

  const paste = async () => {
    // Clipboard is read only on this explicit tap.
    const t = await Clipboard.getStringAsync().catch(() => '');
    if (t) setText((cur) => (cur ? `${cur}\n${t}` : t));
    else setNotice({ tone: 'info', text: '클립보드가 비어 있어요.' });
  };

  const analyze = async () => {
    if (!all.length) return setNotice({ tone: 'info', text: '링크·텍스트를 입력하거나 파일을 추가해 주세요.' });
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await createDraft(all, settings);
      notifyDataChanged();
      router.replace({
        pathname: '/capture/review',
        params: { id: outcome.itemId, ocr: OCR_SUMMARY_TEXT[outcome.ocr] ?? '', skipped: outcome.skipped.length ? `${outcome.skipped.length}개 파일은 가져오지 못했어요. ${messageFor(outcome.skipped[0])}` : '' },
      });
    } catch (e) {
      setNotice({ tone: 'error', text: toUserMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: adopted || params.source === 'share' ? '공유받은 정보' : '새 정보 추가' }} />
      <ScreenScroll withBottomBar>
        {shareNotice ? <InlineMessage tone={shareNotice.tone} message={shareNotice.text} /> : null}
        {notice ? <InlineMessage tone={notice.tone} message={notice.text} /> : null}

        {inputs.length ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="받은 내용" subtitle={`${inputs.length}개 · 기기 안에서만 처리해요`} />
            {inputs.map((input, i) => (
              <InputPreview key={`${input.kind}-${i}`} input={input} onRemove={() => setInputs((cur) => cur.filter((_, j) => j !== i))} />
            ))}
          </View>
        ) : null}

        {candidates.length ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">자동 분류 미리보기</AppText>
            <Row wrap gap={spacing.xs}>
              {candidates.map((cand) => (
                <View key={cand.category} style={[styles.candidate, { backgroundColor: c.surface, borderColor: c.border }]}>
                  <CategoryIcon category={cand.category} size={24} />
                  <AppText variant="label">{CATEGORY_INFO[cand.category].short}</AppText>
                </View>
              ))}
            </Row>
            <StatusBadge label={categoryHint(candidates[0])} icon="sparkles-outline" tone="accent" />
          </View>
        ) : null}

        <View style={{ gap: spacing.xs }}>
          <TextField
            label={inputs.length ? '메모나 텍스트 더하기' : '링크나 텍스트'}
            value={text}
            onChangeText={setText}
            multiline
            placeholder="예) https://map.naver.com/... 또는 '11월 2일 저녁 7시 예약, 예약번호 R1234'"
            autoCapitalize="none"
            testID="capture-text"
          />
          <Row gap={spacing.xs} wrap>
            <GhostButton compact icon="clipboard-outline" label="붙여넣기" onPress={paste} />
            <GhostButton compact icon="image-outline" label="사진 선택" onPress={() => addFiles(pickImages)} />
            <GhostButton compact icon="document-outline" label="파일 선택 (PDF·이미지)" onPress={() => addFiles(pickDocuments)} />
          </Row>
        </View>

        <Card>
          <View style={{ gap: spacing.xxs }}>
            <AppText variant="label">다른 앱에서 바로 보내기</AppText>
            <AppText variant="secondary" tone="secondary">카카오톡·브라우저·사진 앱에서 공유 버튼을 누르고 ‘KeepOn’을 고르면 이 화면으로 와요. 앱마다 보내 주는 형식이 달라서 일부는 링크나 텍스트만 전달될 수 있어요.</AppText>
          </View>
        </Card>
        <AppText variant="caption" tone="tertiary">
          {settings.retainAttachments ? '이미지·PDF 원본은 앱 안에 복사해 보관해요. 설정에서 끌 수 있어요.' : '첨부 보관이 꺼져 있어 이미지·PDF 원본은 저장하지 않아요.'}
        </AppText>
      </ScreenScroll>
      <BottomBar>
        <SecondaryButton label="취소" onPress={() => router.back()} style={{ flex: 1 }} />
        <PrimaryButton label="정리하기" icon="sparkles-outline" onPress={analyze} loading={busy} disabled={!all.length} style={{ flex: 2 }} testID="analyze" />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { gap: spacing.xs, borderWidth: 1, borderRadius: radius.card, padding: spacing.sm },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  previewImage: { width: '100%', height: 180, borderRadius: radius.tile },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radius.chip, paddingVertical: 6, paddingHorizontal: spacing.sm },
});
