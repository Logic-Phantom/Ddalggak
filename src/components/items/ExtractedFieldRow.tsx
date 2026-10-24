import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, ConfidenceBadge, FilterChip, GhostButton, IconButton, PrimaryButton, Row, TextField, radius, spacing, useColors } from '@/design-system';
import { DATE_ROLE_LABEL, SENSITIVE_FIELDS, fieldLabel, maskSensitive } from '@/domain/categories';
import type { DateRole, ExtractedField } from '@/domain/models';
import { formatMoney, parseNormalizedMoney, toMinor } from '@/features/extraction/money-parser';
import { formatLocal, parseUserDateInput, toInputValue } from '@/utils/dates';

export interface FieldEdit {
  valueText: string;
  normalizedValue: string | null;
  role: string | null;
}

const EDITABLE_ROLES: DateRole[] = ['expiry', 'reservation', 'event', 'purchase', 'return-deadline', 'warranty-end', 'unknown'];

/**
 * One extracted value with its meaning, confidence and evidence. Confirming is an explicit tap;
 * editing marks the field as user-owned so re-analysis never overwrites it.
 */
export function ExtractedFieldRow({ field, onConfirm, onEdit, onDelete, maskByDefault = false }: {
  field: ExtractedField;
  onConfirm?: (confirmed: boolean) => void;
  onEdit?: (edit: FieldEdit) => void;
  onDelete?: () => void;
  maskByDefault?: boolean;
}) {
  const c = useColors();
  const [showEvidence, setShowEvidence] = useState(false);
  const [revealed, setRevealed] = useState(!maskByDefault);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [role, setRole] = useState<string | null>(field.role);
  const [error, setError] = useState<string | null>(null);

  const label = fieldLabel(field.fieldType, field.role);
  const sensitive = SENSITIVE_FIELDS.has(field.fieldType);
  const shown = sensitive && !revealed ? maskSensitive(field.valueText) : field.valueText;
  const needsLook = field.requiresConfirmation && !field.userConfirmed;

  const startEdit = () => {
    setDraft(field.fieldType === 'date' ? toInputValue(field.normalizedValue) : field.fieldType === 'amount' ? field.valueText.replace(/[^\d.,-]/g, '') : field.valueText);
    setRole(field.role);
    setError(null);
    setEditing(true);
  };

  const save = () => {
    if (!onEdit) return;
    if (field.fieldType === 'date') {
      const v = parseUserDateInput(draft);
      if (!v) return setError('예: 2026-10-31 또는 2026-10-31 18:00');
      onEdit({ valueText: formatLocal(v), normalizedValue: v, role });
    } else if (field.fieldType === 'amount') {
      const currency = parseNormalizedMoney(field.normalizedValue ?? '')?.currency ?? 'KRW';
      const negative = draft.trim().startsWith('-');
      const parsed = toMinor(draft.replace(/^-/, '').trim(), currency);
      if (!parsed) return setError('숫자만 입력해 주세요. 예: 12,000');
      const minor = negative ? -parsed.minor : parsed.minor;
      onEdit({ valueText: formatMoney(minor, currency), normalizedValue: `${minor} ${currency}`, role: field.role });
    } else {
      const v = draft.trim();
      if (!v) return setError('값을 입력하거나 항목을 삭제해 주세요.');
      onEdit({ valueText: v, normalizedValue: v, role: field.role });
    }
    setEditing(false);
  };

  return (
    <View style={[styles.wrap, { borderColor: needsLook ? c.warning : c.border, backgroundColor: c.surface }]}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="secondary">{label}</AppText>
          {!editing ? (
            <AppText variant={field.fieldType === 'date' || field.fieldType === 'amount' ? 'numeric' : 'body'} selectable={!sensitive || revealed}>
              {shown}
            </AppText>
          ) : null}
        </View>
        {sensitive && !editing ? <IconButton icon={revealed ? 'eye-off-outline' : 'eye-outline'} label={revealed ? `${label} 가리기` : `${label} 보기`} onPress={() => setRevealed((v) => !v)} size={20} /> : null}
      </View>

      {editing ? (
        <View style={{ gap: spacing.xs }}>
          <TextField
            label={`${label} 수정`}
            value={draft}
            onChangeText={setDraft}
            error={error}
            keyboardType={field.fieldType === 'amount' ? 'numbers-and-punctuation' : 'default'}
            autoFocus
            hint={field.fieldType === 'date' ? '형식: 2026-10-31 또는 2026-10-31 18:00' : undefined}
          />
          {field.fieldType === 'date' ? (
            <View style={{ gap: spacing.xxs }}>
              <AppText variant="caption" tone="secondary">이 날짜의 의미</AppText>
              <Row wrap gap={spacing.xs}>
                {EDITABLE_ROLES.map((r) => (
                  <FilterChip key={r} role="radio" label={DATE_ROLE_LABEL[r]} selected={(role ?? 'unknown') === r} onPress={() => setRole(r)} />
                ))}
              </Row>
            </View>
          ) : null}
          <Row gap={spacing.xs}>
            <PrimaryButton compact label="저장" onPress={save} style={{ flex: 1 }} />
            <GhostButton compact label="취소" onPress={() => setEditing(false)} />
          </Row>
        </View>
      ) : (
        <Row wrap gap={spacing.xs}>
          <ConfidenceBadge level={field.userConfirmed ? 'high' : field.confidence} />
          {field.userEditedAt ? <AppText variant="caption" tone="tertiary">직접 수정함</AppText> : null}
          {field.method === 'ocr' ? <AppText variant="caption" tone="tertiary">이미지에서 읽음</AppText> : null}
        </Row>
      )}

      {!editing && field.evidenceText ? (
        <View style={{ gap: spacing.xxs }}>
          <Pressable onPress={() => setShowEvidence((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showEvidence }} accessibilityLabel="근거 보기" style={styles.evidenceToggle}>
            <Ionicons name={showEvidence ? 'chevron-up' : 'chevron-down'} size={16} color={c.textSecondary} />
            <AppText variant="caption" tone="secondary">근거 보기</AppText>
          </Pressable>
          {showEvidence ? (
            <View style={[styles.evidence, { backgroundColor: c.surfaceSunken }]}>
              <AppText variant="secondary" tone="secondary">“{sensitive && !revealed ? '(가려짐)' : field.evidenceText}”</AppText>
            </View>
          ) : null}
        </View>
      ) : null}

      {!editing && (onConfirm || onEdit || onDelete) ? (
        <Row wrap gap={spacing.xs}>
          {onConfirm ? (
            <FilterChip
              label={field.userConfirmed ? '확인함' : '이 값이 맞아요'}
              selected={field.userConfirmed}
              onPress={() => onConfirm(!field.userConfirmed)}
              testID={`confirm-${field.id}`}
            />
          ) : null}
          {onEdit ? <GhostButton compact icon="create-outline" label="수정" onPress={startEdit} /> : null}
          {onDelete ? <GhostButton compact icon="trash-outline" label="삭제" onPress={onDelete} /> : null}
        </Row>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: radius.tile, padding: spacing.sm, gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  evidenceToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, alignSelf: 'flex-start' },
  evidence: { borderRadius: radius.button, padding: spacing.sm },
});
