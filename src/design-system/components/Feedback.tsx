import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useColors } from '../theme';
import { elevation, radius, spacing } from '../tokens';
import { AppText } from './AppText';
import { PrimaryButton, SecondaryButton, type IconName } from './Buttons';

export function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <AppText variant="sectionTitle">{title}</AppText>
        {subtitle ? <AppText variant="secondary" tone="secondary">{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, padded = true, style }: { children: ReactNode; padded?: boolean; style?: object }) {
  const c = useColors();
  return <View style={[styles.card, elevation.card, { backgroundColor: c.surface, borderColor: c.border }, padded && { padding: spacing.md }, style]}>{children}</View>;
}

export type MessageTone = 'info' | 'success' | 'warning' | 'error';

/** Persistent inline message (no auto-dismiss) so users have time to read it. */
export function InlineMessage({ tone = 'info', title, message, action }: { tone?: MessageTone; title?: string; message: string; action?: ReactNode }) {
  const c = useColors();
  const map = {
    info: { bg: c.accentSoft, fg: c.accentText, icon: 'information-circle' as IconName },
    success: { bg: c.successSoft, fg: c.success, icon: 'checkmark-circle' as IconName },
    warning: { bg: c.warningSoft, fg: c.warning, icon: 'warning' as IconName },
    error: { bg: c.errorSoft, fg: c.error, icon: 'alert-circle' as IconName },
  }[tone];
  return (
    <View style={[styles.msg, { backgroundColor: map.bg }]} accessibilityRole={tone === 'error' ? 'alert' : 'text'} accessibilityLiveRegion="polite">
      <Ionicons name={map.icon} size={20} color={map.fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <AppText variant="bodyStrong" style={{ color: map.fg }}>{title}</AppText> : null}
        <AppText variant="secondary" tone="primary">{message}</AppText>
        {action}
      </View>
    </View>
  );
}

export function EmptyState({ icon = 'file-tray-outline', title, message, actionLabel, onAction, secondaryLabel, onSecondary }: {
  icon?: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: c.surfaceSunken }]}>
        <Ionicons name={icon} size={30} color={c.textSecondary} />
      </View>
      <AppText variant="sectionTitle" align="center">{title}</AppText>
      <AppText variant="body" tone="secondary" align="center">{message}</AppText>
      {actionLabel && onAction ? <PrimaryButton label={actionLabel} onPress={onAction} style={{ alignSelf: 'stretch' }} /> : null}
      {secondaryLabel && onSecondary ? <SecondaryButton label={secondaryLabel} onPress={onSecondary} style={{ alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

export function ErrorState({ title = '문제가 생겼어요', message, onRetry, retryLabel = '다시 시도' }: { title?: string; message: string; onRetry?: () => void; retryLabel?: string }) {
  return <EmptyState icon="cloud-offline-outline" title={title} message={message} actionLabel={onRetry ? retryLabel : undefined} onAction={onRetry} />;
}

export interface ProgressStep {
  id: string;
  label: string;
  state: 'waiting' | 'active' | 'done' | 'error' | 'cancelled';
}

/** Shows real stages and real counts only — no fake percentages or ETAs. */
export function ProgressPanel({ steps, processed, total, failed }: { steps: ProgressStep[]; processed: number; total: number; failed: number }) {
  const c = useColors();
  const ratio = total > 0 ? processed / total : 0;
  return (
    <Card>
      <View style={{ gap: spacing.sm }}>
        <View style={styles.progressHead}>
          <AppText variant="numeric" accessibilityLabel={`${total}장 중 ${processed}장 처리`}>
            {processed}/{total}
          </AppText>
          <AppText variant="secondary" tone="secondary">장 처리{failed ? ` · 실패 ${failed}` : ''}</AppText>
        </View>
        <View
          style={[styles.track, { backgroundColor: c.surfaceSunken }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: processed }}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: c.accent }]} />
        </View>
        <View style={{ gap: spacing.xs }}>
          {steps.map((s) => {
            const icon: IconName = s.state === 'done' ? 'checkmark-circle' : s.state === 'active' ? 'ellipse' : s.state === 'error' ? 'alert-circle' : s.state === 'cancelled' ? 'stop-circle-outline' : 'ellipse-outline';
            const color = s.state === 'done' ? c.success : s.state === 'active' ? c.accent : s.state === 'error' ? c.error : c.textTertiary;
            const stateLabel = { waiting: '대기', active: '진행 중', done: '완료', error: '오류', cancelled: '중단됨' }[s.state];
            return (
              <View key={s.id} style={styles.stepRow} accessible accessibilityLabel={`${s.label}: ${stateLabel}`}>
                <Ionicons name={icon} size={18} color={color} />
                <AppText variant="secondary" tone={s.state === 'waiting' ? 'tertiary' : 'primary'} style={{ flex: 1 }}>{s.label}</AppText>
                <AppText variant="caption" tone="tertiary">{stateLabel}</AppText>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginBottom: spacing.xs },
  card: { borderRadius: radius.card, borderWidth: 1 },
  msg: { flexDirection: 'row', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.button },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  progressHead: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 28 },
});
