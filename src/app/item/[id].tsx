import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ExtractedFieldRow } from '@/components/items/ExtractedFieldRow';
import { ReminderSheet } from '@/components/items/ReminderSheet';
import { AppText, BottomBar, Card, CategoryBadge, CategoryIcon, Divider, EmptyState, GhostButton, IconButton, InlineMessage, PrimaryButton, Row, ScreenScroll, SecondaryButton, StatusBadge, elevation, radius, spacing, useColors } from '@/design-system';
import { toUserMessage } from '@/domain/errors';
import { isOpenableUrl, isPrivateHost } from '@/features/extraction/url-utils';
import { STATUS_LABEL } from '@/features/items/item-lifecycle';
import { getItem, updateField, updateItem } from '@/features/items/item-repository';
import { deleteItem, removeAttachment, setStatus } from '@/features/items/item-service';
import { deleteReminder } from '@/features/reminders/reminder-service';
import { useAppState } from '@/hooks/app-state';
import { useLoader } from '@/hooks/use-loader';
import { formatBytes, formatIsoDate, formatLocal } from '@/utils/dates';

function Expandable({ title, text }: { title: string; text: string }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.expandHead}>
        <AppText variant="label" style={{ flex: 1 }}>{title}</AppText>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.textSecondary} />
      </Pressable>
      {open ? (
        <View style={[styles.textBox, { backgroundColor: c.surfaceSunken }]}>
          <AppText variant="secondary" selectable>{text}</AppText>
        </View>
      ) : null}
    </View>
  );
}

/** Small caption above a card's content, as in "출처", "메모". */
function CardLabel({ children }: { children: string }) {
  return <AppText variant="caption" tone="tertiary">{children}</AppText>;
}

export default function ItemScreen() {
  const router = useRouter();
  const c = useColors();
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const { settings, notifyDataChanged } = useAppState();
  const { data: item, reload } = useLoader(() => getItem(id), [id]);
  const [sheet, setSheet] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(saved ? { tone: 'success', text: '저장했어요. 필요하면 알림을 만들어 보세요.' } : null);

  if (item === null) return <EmptyState title="항목을 찾을 수 없어요" message="삭제된 항목일 수 있어요." actionLabel="홈으로" onAction={() => router.replace('/')} />;
  if (!item) return null;

  const act = async (fn: () => Promise<void>, done?: string) => {
    try {
      await fn();
      notifyDataChanged();
      reload();
      if (done) setMessage({ tone: 'success', text: done });
    } catch (e) {
      setMessage({ tone: 'error', text: toUserMessage(e) });
    }
  };

  const openLink = () => {
    const url = item.sourceUrl;
    if (!url || !isOpenableUrl(url)) return;
    // Links open in the OS browser only after the user sees the domain; nothing is fetched by the app.
    Alert.alert('브라우저에서 열까요?', `${url}${isPrivateHost(url) ? '\n\n⚠ 내부 네트워크 주소예요. 보낸 사람을 신뢰할 때만 여세요.' : ''}`, [
      { text: '취소', style: 'cancel' },
      { text: '열기', onPress: () => Linking.openURL(url).catch(() => setMessage({ tone: 'error', text: '링크를 열 수 없어요.' })) },
    ]);
  };

  const confirmDelete = () =>
    Alert.alert('이 항목을 삭제할까요?', '첨부 파일과 예약된 알림도 함께 지워지고 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteItem(item.id);
            notifyDataChanged();
            router.back();
          } catch (e) {
            setMessage({ tone: 'error', text: toUserMessage(e) });
          }
        },
      },
    ]);

  const fields = item.fields.filter((f) => f.fieldType !== 'url');
  const heroImage = item.attachments.find((a) => a.mimeType.startsWith('image/'));
  const active = item.status === 'active';

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll withBottomBar>
        {message ? <InlineMessage tone={message.tone} message={message.text} /> : null}

        {heroImage ? <Image source={{ uri: heroImage.localUri }} style={styles.hero} contentFit="cover" accessibilityLabel="첨부 이미지" accessibilityIgnoresInvertColors /> : null}

        <View style={[styles.header, elevation.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          <CategoryIcon category={item.category} size={56} />
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="sectionTitle" selectable>{item.title}</AppText>
            <AppText variant="caption" tone="tertiary">{formatIsoDate(item.capturedAt)} 저장{item.domain ? ` · ${item.domain}` : ''}</AppText>
            <Row wrap gap={spacing.xxs} style={{ marginTop: 2 }}>
              <CategoryBadge category={item.category} />
              {item.status !== 'active' ? <StatusBadge label={STATUS_LABEL[item.status]} /> : null}
              {item.needsReview ? <StatusBadge label="검토 필요" icon="alert-circle-outline" tone="warning" /> : null}
            </Row>
          </View>
          <IconButton icon={item.pinned ? 'pin' : 'pin-outline'} label={item.pinned ? '고정 해제' : '목록 맨 위에 고정'} active={item.pinned} onPress={() => act(() => updateItem(item.id, { pinned: !item.pinned }))} />
        </View>

        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="tertiary">{fields.length ? '‘이 값이 맞아요’를 누른 날짜만 알림에 쓸 수 있어요.' : '찾은 값이 없어요. 수정에서 직접 추가할 수 있어요.'}</AppText>
          {fields.length ? (
            <Card padded={false}>
              {fields.map((f, i) => (
                <View key={f.id}>
                  {i ? <Divider inset={spacing.md} /> : null}
                  <ExtractedFieldRow field={f} maskByDefault onConfirm={(v) => act(() => updateField(f.id, { userConfirmed: v }))} />
                </View>
              ))}
            </Card>
          ) : null}
        </View>

        {item.sourceUrl || item.userNote ? (
          <Card padded={false}>
            {item.sourceUrl ? (
              <Pressable onPress={openLink} accessibilityRole="link" accessibilityLabel={`출처 링크 열기, ${item.domain ?? item.sourceUrl}`} style={styles.cardRow}>
                <CardLabel>출처</CardLabel>
                <Row gap={spacing.xs}>
                  <Ionicons name="link-outline" size={18} color={c.accentText} />
                  <AppText variant="secondary" numberOfLines={2} style={{ flex: 1, color: c.accentText }}>{item.sourceUrl}</AppText>
                  <Ionicons name="open-outline" size={18} color={c.textTertiary} />
                </Row>
              </Pressable>
            ) : null}
            {item.sourceUrl && item.userNote ? <Divider inset={spacing.md} /> : null}
            {item.userNote ? (
              <View style={styles.cardRow}>
                <CardLabel>메모</CardLabel>
                <AppText variant="body" tone="secondary" selectable>{item.userNote}</AppText>
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card padded={false}>
          <View style={[styles.cardRow, styles.reminderHead]}>
            <Ionicons name="notifications-outline" size={20} color={c.textPrimary} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>알림</AppText>
            {active ? <GhostButton compact icon="add" label="만들기" onPress={() => setSheet(true)} testID="add-reminder" /> : null}
          </View>
          {item.reminders.length ? (
            item.reminders.map((r) => (
              <View key={r.id}>
                <Divider inset={spacing.md} />
                <Row gap={spacing.sm} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="numeric">{formatLocal(r.scheduledAt)}</AppText>
                    <AppText variant="caption" tone="tertiary">
                      {r.title} · {!r.enabled ? '꺼짐 (보관·완료된 항목)' : r.notificationId ? '기기 알림 예약됨' : '앱 안에서만 표시 (기기 알림 없음)'}
                    </AppText>
                  </View>
                  <IconButton icon="trash-outline" label="알림 삭제" onPress={() => act(() => deleteReminder(r.id), '알림을 삭제했어요.')} />
                </Row>
              </View>
            ))
          ) : (
            <AppText variant="secondary" tone="tertiary" style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>아직 알림이 없어요. 알림은 자동으로 만들지 않아요.</AppText>
          )}
        </Card>

        {item.tags.length ? (
          <Row wrap gap={spacing.xs}>
            {item.tags.map((t) => (
              <View key={t} style={[styles.tag, { backgroundColor: c.accentSoft }]} accessible accessibilityRole="text" accessibilityLabel={`태그 ${t}`}>
                <AppText variant="caption" style={{ color: c.accentText, fontWeight: '700' }}>#{t}</AppText>
              </View>
            ))}
          </Row>
        ) : null}

        {item.attachments.length ? (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label">첨부</AppText>
            {item.attachments.map((a) => (
              <View key={a.id} style={[styles.attachment, { borderColor: c.border, backgroundColor: c.surface }]}>
                {a.mimeType.startsWith('image/') ? (
                  <Image source={{ uri: a.localUri }} style={styles.thumb} contentFit="cover" accessibilityLabel="첨부 이미지" accessibilityIgnoresInvertColors />
                ) : (
                  <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceSunken }]}>
                    <Ionicons name="document-outline" size={26} color={c.textSecondary} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="secondary" numberOfLines={1}>{a.originalName ?? (a.mimeType === 'application/pdf' ? 'PDF 문서' : '이미지')}</AppText>
                  <AppText variant="caption" tone="tertiary">{formatBytes(a.sizeBytes)}</AppText>
                </View>
                {process.env.EXPO_OS !== 'web' ? (
                  <IconButton icon="share-outline" label="다른 앱으로 열기" onPress={() => Sharing.shareAsync(a.localUri, { mimeType: a.mimeType }).catch(() => {})} />
                ) : null}
                <IconButton icon="trash-outline" label="첨부 삭제" onPress={() => act(() => removeAttachment(a.id, a.localUri), '첨부를 삭제했어요.')} />
              </View>
            ))}
          </View>
        ) : null}

        {item.displayText ? <Expandable title="공유된 원문" text={item.displayText} /> : null}
        {item.ocrText ? <Expandable title="이미지에서 읽은 글자" text={item.ocrText} /> : null}

        <Row gap={spacing.xs}>
          {active ? (
            <SecondaryButton compact label="완료" icon="checkmark-done-outline" onPress={() => act(() => setStatus(item.id, 'completed'), '완료했어요. 보관함의 완료 탭에서 볼 수 있고, 알림은 꺼졌어요.')} style={{ flex: 1 }} />
          ) : null}
          <SecondaryButton compact label="삭제" icon="trash-outline" onPress={confirmDelete} style={{ flex: 1 }} />
        </Row>
      </ScreenScroll>

      <BottomBar>
        {active ? (
          <SecondaryButton label="보관함으로 이동" onPress={() => act(() => setStatus(item.id, 'archived'), '보관했어요. 보관함의 보관됨 탭에서 볼 수 있고, 알림은 꺼졌어요.')} style={{ flex: 1 }} />
        ) : (
          <SecondaryButton label="진행 중으로 되돌리기" onPress={() => act(() => setStatus(item.id, 'active'), '진행 중으로 되돌렸어요. 필요하면 알림을 다시 만들어 주세요.')} style={{ flex: 1 }} />
        )}
        <PrimaryButton label="수정" onPress={() => router.push({ pathname: '/item/edit/[id]', params: { id: item.id } })} style={{ flex: 1 }} />
      </BottomBar>

      {sheet ? <ReminderSheet item={item} visible={sheet} onClose={() => setSheet(false)} defaultHour={settings.defaultReminderHour} onCreated={(text) => { setMessage({ tone: 'success', text }); notifyDataChanged(); reload(); }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 200, borderRadius: radius.card },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  cardRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xxs },
  reminderHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.chip },
  expandHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  textBox: { borderRadius: radius.button, padding: spacing.sm },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.tile, padding: spacing.xs },
  thumb: { width: 56, height: 56, borderRadius: radius.photo },
});
