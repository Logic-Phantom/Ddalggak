import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ExtractedFieldRow } from '@/components/items/ExtractedFieldRow';
import { ReminderSheet } from '@/components/items/ReminderSheet';
import { AppText, Card, DangerButton, Divider, EmptyState, GhostButton, IconButton, InlineMessage, PrimaryButton, Row, ScreenScroll, SecondaryButton, SectionHeader, StatusBadge, TagList, radius, spacing, useColors } from '@/design-system';
import { CATEGORY_INFO } from '@/domain/categories';
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

export default function ItemScreen() {
  const router = useRouter();
  const c = useColors();
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const { settings, notifyDataChanged } = useAppState();
  const { data: item, reload } = useLoader(() => getItem(id), [id]);
  const [sheet, setSheet] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(saved ? { tone: 'success', text: '저장했어요. 필요하면 알림을 만들어 보세요.' } : null);

  if (item === null) return <EmptyState title="항목을 찾을 수 없어요" message="삭제된 항목일 수 있어요." actionLabel="인박스로" onAction={() => router.replace('/')} />;
  if (!item) return null;

  const cat = CATEGORY_INFO[item.category];
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

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll>
        {message ? <InlineMessage tone={message.tone} message={message.text} /> : null}

        <View style={{ gap: spacing.xs }}>
          <Row wrap gap={spacing.xs}>
            <StatusBadge label={cat.label} tone="accent" />
            {item.status !== 'active' ? <StatusBadge label={STATUS_LABEL[item.status]} /> : null}
            {item.needsReview ? <StatusBadge label="검토 필요" icon="alert-circle-outline" tone="warning" /> : null}
          </Row>
          <Row gap={spacing.xs} style={{ alignItems: 'flex-start' }}>
            <AppText variant="title" style={{ flex: 1 }} selectable>{item.title}</AppText>
            <IconButton icon={item.pinned ? 'pin' : 'pin-outline'} label={item.pinned ? '고정 해제' : '인박스 맨 위에 고정'} active={item.pinned} onPress={() => act(() => updateItem(item.id, { pinned: !item.pinned }))} />
          </Row>
          <AppText variant="caption" tone="tertiary">{formatIsoDate(item.capturedAt)} 저장{item.domain ? ` · ${item.domain}` : ''}</AppText>
          <TagList tags={item.tags.map((t) => ({ label: `#${t}` }))} />
        </View>

        {item.sourceUrl ? (
          <Pressable onPress={openLink} accessibilityRole="link" accessibilityLabel={`링크 열기, ${item.domain ?? item.sourceUrl}`} style={[styles.link, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Ionicons name="open-outline" size={18} color={c.accentText} />
            <AppText variant="secondary" numberOfLines={2} style={{ flex: 1, color: c.accentText }}>{item.sourceUrl}</AppText>
          </Pressable>
        ) : null}

        {item.userNote ? (
          <Card>
            <AppText variant="caption" tone="secondary">메모</AppText>
            <AppText variant="body" selectable>{item.userNote}</AppText>
          </Card>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="정보" subtitle={fields.length ? '‘이 값이 맞아요’를 누른 날짜만 알림에 쓸 수 있어요.' : '찾은 값이 없어요. 수정에서 직접 추가할 수 있어요.'} />
          {fields.map((f) => (
            <ExtractedFieldRow key={f.id} field={f} maskByDefault onConfirm={(v) => act(() => updateField(f.id, { userConfirmed: v }))} />
          ))}
        </View>

        <View style={{ gap: spacing.xs }}>
          <SectionHeader title="알림" right={item.status === 'active' ? <GhostButton compact icon="add" label="만들기" onPress={() => setSheet(true)} testID="add-reminder" /> : undefined} />
          {item.reminders.length ? (
            <Card padded={false}>
              {item.reminders.map((r, i) => (
                <View key={r.id}>
                  {i ? <Divider inset={spacing.md} /> : null}
                  <Row gap={spacing.sm} style={{ padding: spacing.md }}>
                    <Ionicons name={r.enabled ? 'notifications-outline' : 'notifications-off-outline'} size={20} color={c.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="body">{formatLocal(r.scheduledAt)}</AppText>
                      <AppText variant="caption" tone="tertiary">
                        {r.title} · {!r.enabled ? '꺼짐 (보관·완료된 항목)' : r.notificationId ? '기기 알림 예약됨' : '앱 안에서만 표시 (알림 권한 없음)'}
                      </AppText>
                    </View>
                    <IconButton icon="trash-outline" label="알림 삭제" onPress={() => act(() => deleteReminder(r.id), '알림을 삭제했어요.')} />
                  </Row>
                </View>
              ))}
            </Card>
          ) : (
            <AppText variant="secondary" tone="secondary">아직 알림이 없어요. 알림은 자동으로 만들지 않아요.</AppText>
          )}
        </View>

        {item.attachments.length ? (
          <View style={{ gap: spacing.xs }}>
            <SectionHeader title="첨부" />
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

        <View style={{ gap: spacing.xs }}>
          <PrimaryButton icon="create-outline" label="수정" onPress={() => router.push({ pathname: '/item/edit/[id]', params: { id: item.id } })} />
          <Row gap={spacing.xs}>
            {item.status === 'active' ? (
              <>
                <SecondaryButton label="완료" icon="checkmark-done-outline" onPress={() => act(() => setStatus(item.id, 'completed'), '완료로 옮겼어요. 알림은 꺼졌어요.')} style={{ flex: 1 }} />
                <SecondaryButton label="보관" icon="archive-outline" onPress={() => act(() => setStatus(item.id, 'archived'), '보관함으로 옮겼어요. 알림은 꺼졌어요.')} style={{ flex: 1 }} />
              </>
            ) : (
              <SecondaryButton label="인박스로 되돌리기" icon="arrow-undo-outline" onPress={() => act(() => setStatus(item.id, 'active'), '인박스로 되돌렸어요. 필요하면 알림을 다시 만들어 주세요.')} style={{ flex: 1 }} />
            )}
          </Row>
          <DangerButton label="삭제" icon="trash-outline" onPress={confirmDelete} />
        </View>
      </ScreenScroll>
      {sheet ? <ReminderSheet item={item} visible={sheet} onClose={() => setSheet(false)} defaultHour={settings.defaultReminderHour} onCreated={(text) => { setMessage({ tone: 'success', text }); notifyDataChanged(); reload(); }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radius.button, padding: spacing.sm, minHeight: 44 },
  expandHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  textBox: { borderRadius: radius.button, padding: spacing.sm },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.tile, padding: spacing.xs },
  thumb: { width: 56, height: 56, borderRadius: radius.photo },
});
