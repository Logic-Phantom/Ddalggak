import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, CategoryBadge, CategoryIcon, StatusBadge, elevation, radius, spacing, tileCornerRatio, useColors } from '@/design-system';
import { CATEGORY_INFO, fieldLabel } from '@/domain/categories';
import type { ExtractedField, InboxItem } from '@/domain/models';
import { dDayLabel, diffDays, formatIsoDate, formatLocal, toYmd } from '@/utils/dates';

export interface InboxItemRowProps {
  item: InboxItem;
  /** Earliest upcoming date field for this item, if any. */
  nextDate?: ExtractedField | null;
  /** Local URI of the first image attachment (thumbnail). */
  thumbnail?: string | null;
  onPress: () => void;
}

/** List row: thumbnail (or category tile), title, the one date that matters, category badge + D-day on the right. */
export function InboxItemRow({ item, nextDate, thumbnail, onPress }: InboxItemRowProps) {
  const c = useColors();
  const cat = CATEGORY_INFO[item.category];
  const days = nextDate?.normalizedValue ? diffDays(toYmd(new Date()), nextDate.normalizedValue) : null;
  const soon = days != null && days >= 0 && days <= 3;
  const dateLabel = nextDate?.normalizedValue
    ? `${fieldLabel('date', nextDate.role)} ${formatLocal(nextDate.normalizedValue)}${nextDate.userConfirmed ? '' : ' (확인 전)'}`
    : `${formatIsoDate(item.capturedAt)} 저장`;
  const a11y = [item.title, cat.label, dateLabel, nextDate?.normalizedValue ? dDayLabel(nextDate.normalizedValue) : null, item.needsReview ? '검토 필요' : null, item.pinned ? '고정됨' : null]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.card, elevation.card, { backgroundColor: pressed ? c.surfaceSunken : c.surface, borderColor: c.border }]}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.thumb} contentFit="cover" accessible={false} recyclingKey={thumbnail} />
      ) : (
        <CategoryIcon category={item.category} size={THUMB} />
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>{item.title}</AppText>
          {item.pinned ? <Ionicons name="pin" size={14} color={c.textTertiary} /> : null}
        </View>
        <AppText variant="meta" numberOfLines={1} style={{ color: soon ? c.warning : c.textTertiary }}>
          {dateLabel}
        </AppText>
        {item.needsReview || item.tags.length ? (
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {item.needsReview ? <StatusBadge label="검토 필요" icon="alert-circle-outline" tone="warning" /> : null}
            {item.tags.slice(0, 2).map((t) => <StatusBadge key={t} label={`#${t}`} />)}
          </View>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <CategoryBadge category={item.category} />
        {nextDate?.normalizedValue && days != null && days >= 0 ? (
          <AppText variant="caption" style={{ color: soon ? c.error : c.textTertiary, fontWeight: '700' }}>{dDayLabel(nextDate.normalizedValue)}</AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const THUMB = 48;

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  thumb: { width: THUMB, height: THUMB, borderRadius: Math.round(THUMB * tileCornerRatio) },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
