import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColors } from '../theme';
import { radius, spacing, touchTarget } from '../tokens';
import { AppText } from './AppText';

export type IconName = ComponentProps<typeof Ionicons>['name'];

interface BaseButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
  compact?: boolean;
}

function ButtonBase({ label, onPress, icon, disabled, loading, style, accessibilityHint, testID, compact, kind }: BaseButtonProps & { kind: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const c = useColors();
  const inactive = disabled || loading;
  const primary = kind === 'primary';
  const bg = primary ? c.accent : kind === 'danger' ? c.errorSoft : kind === 'ghost' ? 'transparent' : c.surface;
  const bgPressed = primary ? c.accentPressed : c.surfaceSunken;
  // Accent pill CTA with a bold label.
  const fg = primary ? c.textOnAccent : kind === 'danger' ? c.error : c.textPrimary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: pressed ? bgPressed : bg, borderColor: kind === 'secondary' ? c.border : 'transparent', opacity: inactive ? 0.4 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <AppText variant="bodyStrong" style={[{ color: fg }, primary && { fontWeight: '700' }]} numberOfLines={2} align="center">
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

export function PrimaryButton(p: BaseButtonProps) {
  return <ButtonBase {...p} kind="primary" />;
}

export function SecondaryButton(p: BaseButtonProps) {
  return <ButtonBase {...p} kind="secondary" />;
}

export function DangerButton(p: BaseButtonProps) {
  return <ButtonBase {...p} kind="danger" />;
}

export function GhostButton(p: BaseButtonProps) {
  return <ButtonBase {...p} kind="ghost" />;
}

export interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  tone?: 'default' | 'danger' | 'onPhoto';
  size?: number;
  /** Smaller visual box for dense rows; the tap area stays ≥ 44pt through hitSlop. */
  compact?: boolean;
  children?: ReactNode;
  testID?: string;
}

/** Icon-only button: always carries an accessibility label; min 44pt target. */
export function IconButton({ icon, label, onPress, disabled, active, tone = 'default', size = 22, compact, testID }: IconButtonProps) {
  const c = useColors();
  const color = tone === 'danger' ? c.error : tone === 'onPhoto' ? '#FFFFFF' : active ? c.accent : c.textPrimary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      hitSlop={compact ? 10 : 6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      style={({ pressed }) => [
        styles.icon,
        compact && styles.iconCompact,
        tone === 'onPhoto' && { backgroundColor: 'rgba(0,0,0,0.45)' },
        pressed && { opacity: 0.6 },
        disabled && { opacity: 0.35 },
      ]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget + 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.chip,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { minHeight: touchTarget, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  icon: { minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', borderRadius: touchTarget / 2 },
  iconCompact: { minWidth: 32, minHeight: 32, borderRadius: 16 },
});
