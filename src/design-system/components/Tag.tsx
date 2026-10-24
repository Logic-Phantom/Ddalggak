import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { useColors } from '../theme';
import { radius, spacing } from '../tokens';
import { AppText } from './AppText';

export interface TagProps {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  testID?: string;
}

/**
 * Read-only label (category, style, feature). Not pressable and announced as plain text —
 * use FilterChip for anything the user can select. Visually lighter than a chip (no touch-target
 * height, sunken fill, no border) so it is not mistaken for a disabled control.
 */
export function Tag({ label, icon, testID }: TagProps) {
  const c = useColors();
  return (
    <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={label} style={[styles.tag, { backgroundColor: c.surfaceSunken }]}>
      {icon ? <Ionicons name={icon} size={14} color={c.textSecondary} /> : null}
      <AppText variant="caption" tone="secondary">{label}</AppText>
    </View>
  );
}

/** A labelled group of tags, read by screen readers as one sentence ("태그: 카페, 따뜻한"). */
export function TagList({ tags, label = '태그', testID }: { tags: TagProps[]; label?: string; testID?: string }) {
  if (!tags.length) return null;
  return (
    <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={`${label}: ${tags.map((t) => t.label).join(', ')}`} style={styles.list}>
      {tags.map((t) => (
        <View key={t.label} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Tag {...t} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.chip,
  },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
