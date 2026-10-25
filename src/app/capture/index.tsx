import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, BottomBar, Card, CategoryIcon, GhostButton, IconButton, InlineMessage, PrimaryButton, Row, ScreenScroll, SecondaryButton, SectionHeader, StatusBadge, TextField, elevation, radius, spacing, useColors } from '@/design-system';
import { CATEGORY_INFO } from '@/domain/categories';
import { messageFor, toUserMessage } from '@/domain/errors';
import { categoryHint, classify } from '@/features/extraction/category-classifier';
import { pickDocuments, pickImages } from '@/features/capture/attachment-import-service';
import { captureItem, type CaptureMode } from '@/features/capture/capture-service';
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
  const [busy, setBusy] = useState<CaptureMode | null>(null);
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
      ? { tone: 'info' as const, text: '공유된 내용을 찾지 못했어요. 아래에 직접 붙여 넣거나 파일을 골라 주세요.' }
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

  // A ref, not only state: two taps in the same frame both see `busy === false`.
  const running = useRef(false);
  const save = async (mode: CaptureMode) => {
    if (running.current) return;
    if (!all.length) return setNotice({ tone: 'info', text: '저장할 링크·텍스트나 파일을 넣어 주세요.' });
    running.current = true;
    setBusy(mode);
    setNotice(null);
    try {
      const outcome = await captureItem(all, settings, mode);
      notifyDataChanged();
      const skipped = outcome.skipped.length ? `${outcome.skipped.length}개 파일은 가져오지 못했어요. ${messageFor(outcome.skipped[0])}` : '';
      if (mode === 'quick') {
        router.replace({ pathname: '/item/[id]', params: { id: outcome.itemId, quick: '1', skipped } });
      } else {
        router.replace({ pathname: '/capture/review', params: { id: outcome.itemId, ocr: outcome.ocr, ocrReason: outcome.ocrReason ?? '', skipped } });
      }
    } catch (e) {
      setNotice({ tone: 'error', text: toUserMessage(e) });
    } finally {
      running.current = false;
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: adopted || params.source === 'share' ? '받은 정보' : '새로 저장' }} />
      <ScreenScroll withBottomBar>
        {shareNotice ? <InlineMessage tone={shareNotice.tone} message={shareNotice.text} /> : null}
        {notice ? <InlineMessage tone={notice.tone} message={notice.text} /> : null}

        {inputs.length ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="받은 내용" subtitle={`${inputs.length}개`} />
            {inputs.map((input, i) => (
              <InputPreview key={`${input.kind}-${i}`} input={input} onRemove={() => setInputs((cur) => cur.filter((_, j) => j !== i))} />
            ))}
          </View>
        ) : null}

        {candidates.length ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">이런 정보 같아요</AppText>
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
            label={inputs.length ? '메모 추가' : '링크나 텍스트'}
            value={text}
            onChangeText={setText}
            multiline
            placeholder="링크나 메모를 붙여 넣어 주세요"
            autoCapitalize="none"
            testID="capture-text"
          />
          <Row gap={spacing.xs} wrap>
            <GhostButton compact icon="clipboard-outline" label="붙여넣기" onPress={paste} />
            <GhostButton compact icon="image-outline" label="사진" onPress={() => addFiles(pickImages)} accessibilityHint="사진을 골라 추가해요" />
            <GhostButton compact icon="document-outline" label="파일" onPress={() => addFiles(pickDocuments)} accessibilityHint="PDF나 이미지 파일을 골라 추가해요" />
          </Row>
        </View>

        <Card>
          <View style={{ gap: spacing.xxs }}>
            <AppText variant="label">다른 앱에서 바로 보내기</AppText>
            <AppText variant="secondary" tone="secondary">카카오톡·브라우저·갤러리에서 공유 → ‘딸깍’을 누르면 바로 여기로 와요.</AppText>
          </View>
        </Card>
        <AppText variant="caption" tone="tertiary">
          {settings.retainAttachments ? '이미지·PDF 원본도 앱 안에 함께 저장돼요.' : '첨부 보관이 꺼져 있어 원본 이미지·PDF는 남기지 않아요.'}
        </AppText>
      </ScreenScroll>
      <BottomBar summary={all.length ? <AppText variant="caption" tone="tertiary">바쁘면 임시 저장 — 확인은 나중에 이어서 할 수 있어요.</AppText> : undefined}>
        <SecondaryButton
          label="임시 저장"
          icon="time-outline"
          onPress={() => save('quick')}
          loading={busy === 'quick'}
          disabled={!all.length || busy === 'review'}
          accessibilityHint="확인은 나중에 하고 원본만 먼저 저장해요. 알림은 만들지 않아요."
          style={{ flex: 1 }}
          testID="quick-save"
        />
        <PrimaryButton label="저장하기" icon="checkmark" accessibilityHint="찾은 날짜·금액을 확인한 뒤 저장해요." onPress={() => save('review')} loading={busy === 'review'} disabled={!all.length || busy === 'quick'} style={{ flex: 1.4 }} testID="analyze" />
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
