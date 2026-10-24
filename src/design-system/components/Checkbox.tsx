import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { useColors } from '../theme';
import { spacing } from '../tokens';
import { AppText } from './AppText';

export interface CheckboxProps {
  checked: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
}

/** Consent-style checkbox with a wrapping label; the whole row is the touch target. */
export function Checkbox({ checked, label, onPress, testID }: CheckboxProps) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} testID={testID} style={styles.check}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? c.accent : c.textSecondary} />
      <AppText variant="secondary" style={{ flex: 1 }}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start', minHeight: 44, paddingVertical: spacing.xxs },
});
