import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useColors } from '../theme';
import { spacing, touchTarget } from '../tokens';
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

/** Underlined text tabs. Selection = bold text + accent underline + selected state. */
export function SegmentTabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  const c = useColors();
  return (
    <View style={[styles.segments, { borderBottomColor: c.border }]} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <Pressable key={t.id} onPress={() => onChange(t.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={styles.segment}>
            <AppText variant="label" style={{ color: on ? c.textPrimary : c.textTertiary, fontWeight: on ? '700' : '500' }}>{t.label}</AppText>
            <View style={[styles.segmentBar, { backgroundColor: on ? c.accent : 'transparent' }]} />
          </Pressable>
        );
      })}
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
  segments: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  segment: { flex: 1, alignItems: 'center', paddingTop: spacing.sm, gap: spacing.xs, minHeight: touchTarget },
  segmentBar: { height: 2, alignSelf: 'stretch', marginHorizontal: spacing.xs, borderRadius: 1 },
});
