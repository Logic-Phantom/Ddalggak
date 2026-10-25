import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ExtractedFieldRow } from '@/components/items/ExtractedFieldRow';
import { ReminderSheet } from '@/components/items/ReminderSheet';
import { AppText, Card, CategoryIcon, DangerButton, Divider, EmptyState, GhostButton, IconButton, InlineMessage, PrimaryButton, Row, ScreenScroll, SecondaryButton, SectionHeader, StatusBadge, TagList, radius, spacing, useColors } from '@/design-system';
import { CATEGORY_INFO } from '@/domain/categories';
import { toUserMessage } from '@/domain/errors';
import { isOpenableUrl, isPrivateHost } from '@/features/extraction/url-utils';
import { STATUS_LABEL } from '@/features/items/item-lifecycle';
import { getItem, updateItem } from '@/features/items/item-repository';
import { deleteItem, editField, removeAttachment, setStatus } from '@/features/items/item-service';
import { canRetryDelivery, DELIVERY_TEXT, deliveryState } from '@/features/reminders/reminder-policy';
import { deleteReminder, nowLocal, rescheduleReminder } from '@/features/reminders/reminder-service';
import * as notifications from '@/infrastructure/notifications/local-notifications';
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
  const { id, saved, quick, skipped } = useLocalSearchParams<{ id: string; saved?: string; quick?: string; skipped?: string }>();
  const { settings, notifyDataChanged } = useAppState();
  const { data, reload } = useLoader(async () => {
    const [found, permission, scheduled] = await Promise.all([
      getItem(id),
      notifications.getPermission().catch(() => 'unavailable' as const),
      notifications.scheduledIds().catch(() => [] as string[]),
    ]);
    return { item: found, permission, scheduledIds: new Set(scheduled) };
  }, [id]);
  const item = data === undefined ? undefined : data.item;
  const [sheet, setSheet] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(
    saved
      ? { tone: 'success', text: '저장했어요. 필요하면 알림도 만들어 보세요.' }
      : quick
        ? { tone: 'success', text: '임시 저장했어요. 시간 날 때 ‘이어서 저장하기’로 마무리해 주세요.' }
        : null,
  );

  if (item === null) return <EmptyState title="항목을 찾을 수 없어요" message="삭제된 항목일 수 있어요." actionLabel="홈으로" onAction={() => router.replace('/')} />;
  if (!item) return null;

  const cat = CATEGORY_INFO[item.category];
  const pending = item.status === 'pending';
  const review = () => router.push({ pathname: '/capture/review', params: { id: item.id } });
  const act =async (fn: () => Promise<void>, done?: string) => {
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
  const delivery = { scheduledIds: data!.scheduledIds, permission: data!.permission, nowLocal: nowLocal() };

  const reschedule = (reminderId: string) =>
    act(async () => {
      const r = await rescheduleReminder(reminderId);
      setMessage(
        r.scheduled
          ? { tone: 'success', text: '기기 알림을 다시 예약했어요.' }
          : r.failed
            ? { tone: 'error', text: '기기 알림을 예약하지 못했어요. 잠시 후 다시 시도해 주세요. 일정은 알림 탭에서 계속 볼 수 있어요.' }
            : { tone: 'info', text: r.permission === 'unavailable' ? DELIVERY_TEXT.unavailable : '알림 권한이 꺼져 있어요. 기기 설정 > 딸깍에서 알림을 허용한 뒤 다시 시도해 주세요.' },
      );
    });

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll>
        {message ? <InlineMessage tone={message.tone} message={message.text} /> : null}
        {skipped ? <InlineMessage tone="warning" message={skipped} /> : null}
        {pending ? (
          <InlineMessage
            tone="info"
            title="임시 저장된 항목이에요"
            message="찾은 날짜·금액은 아직 확인 전이에요. 저장을 마치면 알림을 만들 수 있어요."
            action={<GhostButton compact icon="checkmark" label="이어서 저장하기" onPress={review} testID="review-pending" />}
          />
        ) : null}

        {item.attachments.find((a) => a.mimeType.startsWith('image/')) ? (
          <Image
            source={{ uri: item.attachments.find((a) => a.mimeType.startsWith('image/'))!.localUri }}
            style={styles.hero}
            contentFit="cover"
            accessibilityLabel="첨부 이미지"
            accessibilityIgnoresInvertColors
          />
        ) : null}

        <View style={{ gap: spacing.xs }}>
          <Row wrap gap={spacing.xs}>
            <CategoryIcon category={item.category} size={28} />
            <StatusBadge label={cat.label} tone="accent" />
            {item.status !== 'active' ? <StatusBadge label={STATUS_LABEL[item.status]} /> : null}
            {item.needsReview && !pending ? <StatusBadge label="검토 필요" icon="alert-circle-outline" tone="warning" /> : null}
          </Row>
          <Row gap={spacing.xs} style={{ alignItems: 'flex-start' }}>
            <AppText variant="title" style={{ flex: 1 }} selectable>{item.title}</AppText>
            <IconButton icon={item.pinned ? 'pin' : 'pin-outline'} label={item.pinned ? '고정 해제' : '목록 맨 위에 고정'} active={item.pinned} onPress={() => act(() => updateItem(item.id, { pinned: !item.pinned }))} />
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
            <ExtractedFieldRow
              key={f.id}
              field={f}
              maskByDefault
              onConfirm={(v) =>
                act(async () => {
                  const m = await editField(f.id, { userConfirmed: v }, settings.defaultReminderHour);
                  if (m) setMessage({ tone: 'info', text: m });
                })
              }
            />
          ))}
        </View>

        <View style={{ gap: spacing.xs }}>
          <SectionHeader title="알림" right={item.status === 'active' ? <GhostButton compact icon="add" label="만들기" onPress={() => setSheet(true)} testID="add-reminder" /> : undefined} />
          {item.reminders.length ? (
            <Card padded={false}>
              {item.reminders.map((r, i) => {
                const state = deliveryState(r, delivery);
                const canReenable = state === 'off' && item.status === 'active';
                return (
                  <View key={r.id}>
                    {i ? <Divider inset={spacing.md} /> : null}
                    <Row gap={spacing.sm} style={{ padding: spacing.md }}>
                      <Ionicons name={state === 'scheduled' ? 'notifications-outline' : 'notifications-off-outline'} size={20} color={state === 'scheduled' ? c.textSecondary : c.warning} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="body">{formatLocal(r.scheduledAt)}</AppText>
                        <AppText variant="caption" tone={state === 'scheduled' || state === 'off' || state === 'past' ? 'tertiary' : 'warning'}>
                          {r.title} · {DELIVERY_TEXT[state]}
                        </AppText>
                        {canRetryDelivery(state) || canReenable ? (
                          <View style={{ alignSelf: 'flex-start' }}>
                            <GhostButton compact icon="refresh" label={canReenable ? '다시 켜기' : '다시 예약'} onPress={() => reschedule(r.id)} />
                          </View>
                        ) : null}
                      </View>
                      <IconButton icon="trash-outline" label="알림 삭제" onPress={() => act(() => deleteReminder(r.id), '알림을 삭제했어요.')} />
                    </Row>
                  </View>
                );
              })}
            </Card>
          ) : (
            <AppText variant="secondary" tone="secondary">아직 알림이 없어요.</AppText>
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
          {pending ? (
            <PrimaryButton icon="checkmark" label="이어서 저장하기" onPress={review} />
          ) : (
            <PrimaryButton icon="create-outline" label="수정" onPress={() => router.push({ pathname: '/item/edit/[id]', params: { id: item.id } })} />
          )}
          <Row gap={spacing.xs}>
            {pending ? null : item.status === 'active' ? (
              <>
                <SecondaryButton label="완료" icon="checkmark-done-outline" onPress={() => act(() => setStatus(item.id, 'completed'), '완료했어요. 알림은 꺼졌어요.')} style={{ flex: 1 }} />
                <SecondaryButton label="보관" icon="archive-outline" onPress={() => act(() => setStatus(item.id, 'archived'), '보관했어요. 알림은 꺼졌어요.')} style={{ flex: 1 }} />
              </>
            ) : (
              <SecondaryButton label="진행 중으로 되돌리기" icon="arrow-undo-outline" onPress={() => act(() => setStatus(item.id, 'active'), item.reminders.length ? '다시 진행 중이에요. 알림은 ‘다시 켜기’로 켤 수 있어요.' : '다시 진행 중이에요.')} style={{ flex: 1 }} />
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
  hero: { width: '100%', height: 200, borderRadius: radius.card },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderWidth: 1, borderRadius: radius.button, padding: spacing.sm, minHeight: 44 },
  expandHead: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  textBox: { borderRadius: radius.button, padding: spacing.sm },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.tile, padding: spacing.xs },
  thumb: { width: 56, height: 56, borderRadius: radius.photo },
});
