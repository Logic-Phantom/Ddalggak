import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, CategoryBadge, EmptyState, GhostButton, InlineMessage, ScreenScroll, SegmentTabs, StatusBadge, elevation, radius, spacing, useColors } from '@/design-system';
import { fieldLabel } from '@/domain/categories';
import type { Category } from '@/domain/models';
import { confirmedDatesBetween } from '@/features/items/item-repository';
import { upcomingReminders } from '@/features/reminders/reminder-repository';
import { nowLocal } from '@/features/reminders/reminder-service';
import { useLoader } from '@/hooks/use-loader';
import { getPermission } from '@/infrastructure/notifications/local-notifications';
import { addDays, dDayLabel, formatLocal, hasTime, parseLocal, toYmd } from '@/utils/dates';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface Entry {
  key: string;
  itemId: string;
  title: string;
  sub: string;
  when: string;
  category: Category;
  badge?: string;
}

/** Date block (MM / DD / 요일) + title, meaning and time, category badge and D-day. */
function DateRow({ entry, onPress, past }: { entry: Entry; onPress: () => void; past?: boolean }) {
  const c = useColors();
  const d = parseLocal(entry.when);
  const mm = entry.when.slice(5, 7);
  const dd = entry.when.slice(8, 10);
  const time = hasTime(entry.when) ? entry.when.slice(11, 16) : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${entry.sub}, ${formatLocal(entry.when)}, ${dDayLabel(entry.when)}`}
      style={({ pressed }) => [styles.row, elevation.card, { backgroundColor: pressed ? c.surfaceSunken : c.surface, borderColor: c.border }]}>
      <View style={[styles.block, { backgroundColor: c.surfaceSunken }]}>
        <AppText variant="caption" tone="secondary">{mm}</AppText>
        <AppText variant="sectionTitle" style={{ lineHeight: 22 }}>{dd}</AppText>
        <AppText variant="caption" tone="tertiary">({d ? WEEKDAYS[d.getDay()] : ''})</AppText>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>{entry.title}</AppText>
        <AppText variant="meta" tone="tertiary" numberOfLines={1}>{entry.sub}{time ? ` · ${time}` : ''}</AppText>
        {entry.badge ? <StatusBadge label={entry.badge} icon="notifications-outline" tone="accent" /> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <CategoryBadge category={entry.category} />
        <AppText variant="caption" style={{ color: past ? c.textTertiary : c.textSecondary, fontWeight: '700' }}>{dDayLabel(entry.when)}</AppText>
      </View>
    </Pressable>
  );
}

/** Entries grouped under "2026년 11월" headings, in date order. */
function MonthGroups({ entries, onOpen, past }: { entries: Entry[]; onOpen: (itemId: string) => void; past?: boolean }) {
  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = e.when.slice(0, 7);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return (
    <>
      {[...groups].map(([month, list]) => (
        <View key={month} style={{ gap: spacing.sm }}>
          <AppText variant="sectionTitle">{`${month.slice(0, 4)}년 ${Number(month.slice(5, 7))}월`}</AppText>
          {list.map((e) => (
            <DateRow key={e.key} entry={e} past={past} onPress={() => onOpen(e.itemId)} />
          ))}
        </View>
      ))}
    </>
  );
}

/** 알림 탭: scheduled reminders and confirmed dates. Works even when notifications are denied. */
export default function RemindersScreen() {
  const router = useRouter();
  const c = useColors();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const { data } = useLoader(async () => {
    const today = toYmd(new Date());
    const [reminders, dates, permission] = await Promise.all([
      upcomingReminders(nowLocal()),
      confirmedDatesBetween(today, addDays(today, 61)),
      getPermission().catch(() => 'denied' as const),
    ]);
    const overdue = await confirmedDatesBetween(addDays(today, -7), today);
    return { reminders, dates, overdue, permission };
  });
  const open = (id: string) => router.push({ pathname: '/item/[id]', params: { id } });

  const reminderEntries: Entry[] = (data?.reminders ?? []).map((r) => ({
    key: r.reminder.id,
    itemId: r.item.id,
    title: r.item.title,
    sub: `${r.reminder.title} 알림`,
    when: r.reminder.scheduledAt,
    category: r.item.category,
    badge: r.reminder.notificationId ? '알림 예약됨' : undefined,
  }));
  const dateEntries = (list: NonNullable<typeof data>['dates']): Entry[] =>
    list.map((d) => ({ key: d.field.id, itemId: d.item.id, title: d.item.title, sub: fieldLabel('date', d.field.role), when: d.field.normalizedValue!, category: d.item.category }));

  return (
    <ScreenScroll topInset>
      <View style={styles.head}>
        <AppText variant="screenTitle">알림</AppText>
        <Pressable onPress={() => router.push('/search')} accessibilityRole="button" accessibilityLabel="검색" hitSlop={8} style={styles.iconBtn}>
          <Ionicons name="search-outline" size={23} color={c.textPrimary} />
        </Pressable>
      </View>

      <SegmentTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'upcoming', label: '예정된 일정' },
          { id: 'past', label: '지난 일정' },
        ]}
      />

      {data?.permission === 'unavailable' ? (
        <InlineMessage tone="info" message="이 실행 환경에서는 기기 알림을 쓸 수 없어요. 아래 일정은 앱 안에서만 보여요." />
      ) : null}
      {data?.permission === 'denied' && data.reminders.length ? (
        <InlineMessage
          tone="warning"
          title="알림 권한이 꺼져 있어요"
          message="아래 일정은 앱 안에서만 보여요. 기기 알림을 받으려면 설정에서 킵온 알림을 허용해 주세요."
          action={<GhostButton compact label="기기 설정 열기" onPress={() => Linking.openSettings().catch(() => {})} />}
        />
      ) : null}

      {tab === 'upcoming' && data ? (
        <>
          {reminderEntries.length ? (
            <View style={{ gap: spacing.sm }}>
              <AppText variant="label" tone="secondary">예약된 알림 · 직접 만든 알림만 보여요</AppText>
              {reminderEntries.map((e) => (
                <DateRow key={e.key} entry={e} onPress={() => open(e.itemId)} />
              ))}
            </View>
          ) : null}
          {data.dates.length ? (
            <MonthGroups entries={dateEntries(data.dates)} onOpen={open} />
          ) : (
            <EmptyState icon="calendar-outline" title="다가오는 일정이 없어요" message="항목을 저장할 때 날짜를 확인하면 60일 안의 일정이 여기에 모여요. 항목 상세에서 알림도 만들 수 있어요." />
          )}
        </>
      ) : null}

      {tab === 'past' && data ? (
        data.overdue.length ? (
          <>
            <AppText variant="caption" tone="tertiary">지난 7일 동안의 확인한 날짜예요.</AppText>
            <MonthGroups entries={dateEntries(data.overdue)} onOpen={open} past />
          </>
        ) : (
          <EmptyState icon="time-outline" title="최근 지난 일정이 없어요" message="지난 7일 동안 기한이 지난 확인한 날짜가 여기에 보여요." />
        )
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, minHeight: 76 },
  block: { width: 52, borderRadius: radius.tile, alignItems: 'center', paddingVertical: spacing.xxs },
});
