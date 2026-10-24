import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { useColors } from '../theme';
import { radius, spacing, touchTarget } from '../tokens';
import { AppText } from './AppText';

export interface FilterChipProps {
  label: string;
  /** Optional leading icon (category pills). */
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** 'radio' for single choice groups, 'checkbox' for multi choice. */
  role?: 'radio' | 'checkbox';
  testID?: string;
}

/** Selection is conveyed by fill + check icon + accessibility state, not color alone. */
export function FilterChip({ label, icon, selected, onPress, disabled, role = 'checkbox', testID }: FilterChipProps) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      aria-checked={selected}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.selected : pressed ? c.border : c.surfaceSunken,
          borderColor: selected ? c.selected : c.surfaceSunken,
          opacity: disabled ? 0.45 : 1,
        },
      ]}>
      {icon ? <Ionicons name={icon} size={15} color={selected ? c.selectedText : c.textSecondary} /> : selected ? <Ionicons name="checkmark" size={16} color={c.selectedText} /> : null}
      <AppText variant="secondary" style={{ color: selected ? c.selectedText : c.textSecondary, fontWeight: selected ? '700' : '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: touchTarget - 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.chip,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
});
