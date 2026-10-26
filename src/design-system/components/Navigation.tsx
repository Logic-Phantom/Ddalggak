import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useColors } from '../theme';
import { elevation, radius, spacing, tileCornerRatio, touchTarget } from '../tokens';
import { AppText } from './AppText';
import type { IconName } from './Buttons';

/** Tappable settings/list row with a leading icon, optional trailing value, and chevron. */
export function ListRow({ icon, label, value, onPress, role = 'link', tone = 'default', testID }: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  role?: 'link' | 'button';
  tone?: 'default' | 'danger';
  testID?: string;
}) {
  const c = useColors();
  const fg = tone === 'danger' ? c.error : c.textPrimary;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole={role} accessibilityLabel={value ? `${label}, ${value}` : label} style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfaceSunken }]}>
      <Ionicons name={icon} size={20} color={fg} />
      <AppText variant="body" style={{ flex: 1, color: fg }}>{label}</AppText>
      {value ? <AppText variant="secondary" tone="tertiary" numberOfLines={1}>{value}</AppText> : null}
      <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
    </Pressable>
  );
}

/** Pill segmented control. Selection = filled accent pill + bold text + selected state. */
export function SegmentTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  const c = useColors();
  return (
    <View style={[styles.segments, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <Pressable key={t.id} onPress={() => onChange(t.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.segment, on && { backgroundColor: c.selected }]}>
            <AppText variant="label" style={{ color: on ? c.selectedText : c.textSecondary, fontWeight: on ? '700' : '500' }}>{t.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Card-style action row: icon tile, label (+ optional hint) and chevron. */
export function ActionRow({ icon, label, hint, onPress, testID }: { icon: IconName; label: string; hint?: string; onPress: () => void; testID?: string }) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      style={({ pressed }) => [styles.action, elevation.card, { backgroundColor: pressed ? c.surfaceSunken : c.surface, borderColor: c.border }]}>
      <View style={[styles.actionIcon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={20} color={c.accentText} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? <AppText variant="caption" tone="tertiary">{hint}</AppText> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
    </Pressable>
  );
}

/** Section title with an optional "전체보기 >" style link on the right. */
export function SectionLink({ title, linkLabel = '전체보기', onPress }: { title: string; linkLabel?: string; onPress?: () => void }) {
  const c = useColors();
  return (
    <View style={styles.sectionLink}>
      <AppText variant="sectionTitle" style={{ flex: 1 }}>{title}</AppText>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={`${title} ${linkLabel}`} hitSlop={8} style={styles.linkHit}>
          <AppText variant="caption" tone="tertiary">{linkLabel}</AppText>
          <Ionicons name="chevron-forward" size={14} color={c.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Hairline divider between rows inside a Card. */
export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: inset }} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget + 8, paddingHorizontal: spacing.md },
  segments: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.chip, padding: 4, gap: 4 },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: touchTarget - 4, borderRadius: radius.chip, paddingHorizontal: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 64, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  actionIcon: { width: 40, height: 40, borderRadius: Math.round(40 * tileCornerRatio), alignItems: 'center', justifyContent: 'center' },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  linkHit: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 },
});
