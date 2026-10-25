import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Divider, EmptyState, GhostButton, InlineMessage, ScreenScroll, SectionHeader, StatusBadge, radius, spacing, useColors } from '@/design-system';
import { fieldLabel } from '@/domain/categories';
import { confirmedDatesBetween } from '@/features/items/item-repository';
import { deliveryState, MAX_SCHEDULED_REMINDERS } from '@/features/reminders/reminder-policy';
import { upcomingReminders } from '@/features/reminders/reminder-repository';
import { nowLocal, reconcileNotifications } from '@/features/reminders/reminder-service';
import { useLoader } from '@/hooks/use-loader';
import { getPermission, scheduledIds } from '@/infrastructure/notifications/local-notifications';
import { addDays, dDayLabel, formatLocal, toYmd } from '@/utils/dates';

function DueRow({ title, sub, when, onPress, badge }: { title: string; sub: string; when: string; onPress: () => void; badge?: { label: string; ok: boolean } }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, ${sub}, ${formatLocal(when)}, ${dDayLabel(when)}`} style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceSunken }]}>
      <View style={[styles.dday, { backgroundColor: c.accentSoft }]}>
        <AppText variant="caption" style={{ color: c.accentText }}>{dDayLabel(when)}</AppText>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>{title}</AppText>
        <AppText variant="meta" tone="secondary">{sub} · {formatLocal(when)}</AppText>
      </View>
      {badge ? <StatusBadge label={badge.label} icon={badge.ok ? 'notifications-outline' : 'notifications-off-outline'} tone={badge.ok ? 'accent' : 'warning'} /> : null}
      <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
    </Pressable>
  );
}

/** 기한 탭: confirmed dates and scheduled reminders. Works even when notifications are denied. */
export default function RemindersScreen() {
  const router = useRouter();
  const { data } = useLoader(async () => {
    // Compare DB and OS first (idempotent), so the badges below describe the device as it is now.
    await reconcileNotifications();
    const today = toYmd(new Date());
    const [reminders, dates, permission, scheduled] = await Promise.all([
      upcomingReminders(nowLocal()),
      confirmedDatesBetween(today, addDays(today, 61)),
      getPermission().catch(() => 'unavailable' as const),
      scheduledIds().catch(() => [] as string[]),
    ]);
    const overdue = await confirmedDatesBetween(addDays(today, -7), today);
    return { reminders, dates, overdue, permission, scheduledIds: new Set(scheduled) };
  });
  const open = (id: string) => router.push({ pathname: '/item/[id]', params: { id } });

  return (
    <ScreenScroll topInset>
      <AppText variant="screenTitle">알림·기한</AppText>
      {data?.permission === 'unavailable' ? (
        <InlineMessage tone="info" message="이 실행 환경에서는 기기 알림을 쓸 수 없어요. 아래 일정은 앱 안에서만 보여요." />
      ) : null}
      {data?.permission === 'denied' && data.reminders.length ? (
        <InlineMessage
          tone="warning"
          title="알림 권한이 꺼져 있어요"
          message="아래 일정은 앱 안에서만 보여요. 기기 알림을 받으려면 설정에서 딸깍 알림을 허용해 주세요."
          action={<GhostButton compact label="기기 설정 열기" onPress={() => Linking.openSettings().catch(() => {})} />}
        />
      ) : null}

      {data && data.reminders.length >= MAX_SCHEDULED_REMINDERS - 5 ? (
        <InlineMessage
          tone="warning"
          message={`알림은 최대 ${MAX_SCHEDULED_REMINDERS}개까지 예약할 수 있어요 (지금 ${data.reminders.length}개). 가득 차면 새 알림을 만들 수 없으니 필요 없는 알림을 정리해 주세요.`}
        />
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <SectionHeader title="예약된 알림" subtitle="‘기기 알림 없음’은 눌러서 다시 예약할 수 있어요." />
        {data?.reminders.length ? (
          <Card padded={false}>
            {data.reminders.map((r, i) => (
              <View key={r.reminder.id}>
                {i ? <Divider inset={spacing.md} /> : null}
                <DueRow
                  title={r.item.title}
                  sub={r.reminder.title}
                  when={r.reminder.scheduledAt}
                  onPress={() => open(r.item.id)}
                  badge={
                    deliveryState(r.reminder, { scheduledIds: data.scheduledIds, permission: data.permission, nowLocal: nowLocal() }) === 'scheduled'
                      ? { label: '알림 예약됨', ok: true }
                      : { label: '기기 알림 없음', ok: false }
                  }
                />
              </View>
            ))}
          </Card>
        ) : (
          <AppText variant="secondary" tone="secondary">예약된 알림이 없어요. 항목 상세에서 만들 수 있어요.</AppText>
        )}
      </View>

      <View style={{ gap: spacing.xs }}>
        <SectionHeader title="다가오는 날짜" subtitle="60일 이내" />
        {data?.dates.length ? (
          <Card padded={false}>
            {data.dates.map((d, i) => (
              <View key={d.field.id}>
                {i ? <Divider inset={spacing.md} /> : null}
                <DueRow title={d.item.title} sub={fieldLabel('date', d.field.role)} when={d.field.normalizedValue!} onPress={() => open(d.item.id)} />
              </View>
            ))}
          </Card>
        ) : data ? (
          <EmptyState icon="calendar-outline" title="다가오는 날짜가 없어요" message="저장할 때 확인한 날짜가 여기에 모여요." />
        ) : null}
      </View>

      {data?.overdue.length ? (
        <View style={{ gap: spacing.xs }}>
          <SectionHeader title="최근 지난 날짜" subtitle="지난 7일" />
          <Card padded={false}>
            {data.overdue.map((d, i) => (
              <View key={d.field.id}>
                {i ? <Divider inset={spacing.md} /> : null}
                <DueRow title={d.item.title} sub={fieldLabel('date', d.field.role)} when={d.field.normalizedValue!} onPress={() => open(d.item.id)} />
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, minHeight: 64 },
  dday: { minWidth: 56, paddingHorizontal: spacing.xs, paddingVertical: 6, borderRadius: radius.button, alignItems: 'center' },
});
