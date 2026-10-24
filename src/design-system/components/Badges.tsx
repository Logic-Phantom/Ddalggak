import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import type { ConfidenceLevel } from '@/domain/models';

import { useColors } from '../theme';
import { radius, spacing } from '../tokens';
import { AppText } from './AppText';
import type { IconName } from './Buttons';

export type StatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error';

/** Small status pill: icon + text, never color alone. */
export function StatusBadge({ label, icon, tone = 'neutral' }: { label: string; icon?: IconName; tone?: StatusTone }) {
  const c = useColors();
  const map = {
    neutral: { bg: c.surfaceSunken, fg: c.textSecondary },
    accent: { bg: c.accentSoft, fg: c.accentText },
    success: { bg: c.successSoft, fg: c.success },
    warning: { bg: c.warningSoft, fg: c.warning },
    error: { bg: c.errorSoft, fg: c.error },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: map.bg }]} accessible accessibilityRole="text" accessibilityLabel={label}>
      {icon ? <Ionicons name={icon} size={13} color={map.fg} /> : null}
      <AppText variant="caption" style={{ color: map.fg }} maxFontSizeMultiplier={1.6}>{label}</AppText>
    </View>
  );
}

const CONFIDENCE: Record<ConfidenceLevel, { label: string; icon: IconName; tone: StatusTone }> = {
  high: { label: '근거 분명', icon: 'checkmark-circle-outline', tone: 'success' },
  medium: { label: '확인 권장', icon: 'help-circle-outline', tone: 'accent' },
  low: { label: '확인 필요', icon: 'alert-circle-outline', tone: 'warning' },
  unknown: { label: '불확실', icon: 'help-outline', tone: 'neutral' },
};

/** How sure the rule/OCR is about a value — wording avoids sounding like a guarantee. */
export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const s = CONFIDENCE[level];
  return <StatusBadge label={s.label} icon={s.icon} tone={s.tone} />;
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 3, paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: radius.chip },
});
