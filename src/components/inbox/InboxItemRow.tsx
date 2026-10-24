import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, StatusBadge, elevation, radius, spacing, useColors, type IconName } from '@/design-system';
import { CATEGORY_INFO, fieldLabel } from '@/domain/categories';
import type { ExtractedField, InboxItem } from '@/domain/models';
import { dDayLabel, diffDays, formatIsoDate, formatLocal, toYmd } from '@/utils/dates';

export interface InboxItemRowProps {
  item: InboxItem;
  /** Earliest upcoming date field for this item, if any. */
  nextDate?: ExtractedField | null;
  onPress: () => void;
}

/** Inbox card: title first, then the one date that matters, then quiet metadata. */
export function InboxItemRow({ item, nextDate, onPress }: InboxItemRowProps) {
  const c = useColors();
  const cat = CATEGORY_INFO[item.category];
  const days = nextDate?.normalizedValue ? diffDays(toYmd(new Date()), nextDate.normalizedValue) : null;
  const soon = days != null && days >= 0 && days <= 3;
  const dateLabel = nextDate?.normalizedValue
    ? `${fieldLabel('date', nextDate.role)} ${formatLocal(nextDate.normalizedValue)} · ${dDayLabel(nextDate.normalizedValue)}${nextDate.userConfirmed ? '' : ' (확인 전)'}`
    : null;
  const a11y = [item.title, cat.label, dateLabel, item.needsReview ? '검토 필요' : null, item.pinned ? '고정됨' : null].filter(Boolean).join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.card, elevation.card, { backgroundColor: pressed ? c.surfaceSunken : c.surface, borderColor: c.border }]}>
      <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={cat.icon as IconName} size={20} color={c.accentText} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>{item.title}</AppText>
          {item.pinned ? <Ionicons name="pin" size={14} color={c.textTertiary} /> : null}
        </View>
        {dateLabel ? (
          <View style={styles.metaRow}>
            <Ionicons name={soon ? 'alarm-outline' : 'calendar-outline'} size={14} color={soon ? c.warning : c.textSecondary} />
            <AppText variant="meta" style={{ color: soon ? c.warning : c.textSecondary, flexShrink: 1 }}>{dateLabel}</AppText>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <AppText variant="caption" tone="tertiary">{cat.label} · {formatIsoDate(item.capturedAt)} 저장{item.domain ? ` · ${item.domain}` : ''}</AppText>
        </View>
        {item.needsReview || item.tags.length ? (
          <View style={[styles.metaRow, { flexWrap: 'wrap' }]}>
            {item.needsReview ? <StatusBadge label="검토 필요" icon="alert-circle-outline" tone="warning" /> : null}
            {item.tags.slice(0, 3).map((t) => <StatusBadge key={t} label={`#${t}`} />)}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderWidth: 1 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
