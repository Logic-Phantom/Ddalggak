import { Image } from 'expo-image';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import {
  AppText,
  BottomBar,
  Card,
  CategoryIcon,
  Divider,
  FilterChip,
  GhostButton,
  InlineMessage,
  PrimaryButton,
  Row,
  ScreenScroll,
  SecondaryButton,
  SectionHeader,
  TextField,
  elevation,
  radius,
  spacing,
  tileCornerRatio,
  useCategoryTone,
  useColors,
  type IconName,
} from '@/design-system';
import { CATEGORY_INFO, fieldLabel } from '@/domain/categories';
import { toUserMessage } from '@/domain/errors';
import { CATEGORIES, type Category, type ExtractedField, type FieldType, type ItemDetail } from '@/domain/models';
import { categoryHint, classify, fieldSignal } from '@/features/extraction/category-classifier';
import { formatMoney, toMinor } from '@/features/extraction/money-parser';
import { addField, deleteField, updateField } from '@/features/items/item-repository';
import { confirmDraft } from '@/features/items/item-service';
import { formatLocal, parseUserDateInput } from '@/utils/dates';
import { newId } from '@/utils/id';

import { ExtractedFieldRow } from './ExtractedFieldRow';

const MANUAL_TYPES: { type: FieldType; label: string; placeholder: string }[] = [
  { type: 'date', label: '날짜', placeholder: '2026-10-31 또는 2026-10-31 18:00' },
  { type: 'amount', label: '금액(원)', placeholder: '12,000' },
  { type: 'merchant', label: '상호·장소명', placeholder: '킵온커피' },
  { type: 'address', label: '주소', placeholder: '서울 마포구 양화로 12' },
  { type: 'coupon-code', label: '쿠폰 코드', placeholder: 'ABCD-1234' },
];

/** Top summary (thumbnail or category icon, live title, category, most relevant date). */
function SummaryCard({ item, title, category }: { item: ItemDetail; title: string; category: Category }) {
  const c = useColors();
  const tone = useCategoryTone(category);
  const image = item.attachments.find((a) => a.mimeType.startsWith('image/'));
  const date = item.fields.find((f) => f.fieldType === 'date' && f.normalizedValue);
  return (
    <View style={[styles.summary, elevation.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {image ? (
        <Image source={{ uri: image.localUri }} style={styles.summaryThumb} contentFit="cover" accessible={false} />
      ) : (
        <CategoryIcon category={category} size={60} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" style={{ color: tone.fg }}>{CATEGORY_INFO[category].label}</AppText>
        <AppText variant="bodyStrong" numberOfLines={2}>{title || '제목 없음'}</AppText>
        {date ? <AppText variant="meta" tone="tertiary">{fieldLabel('date', date.role)} {date.valueText}{date.userConfirmed ? '' : ' · 확인 전'}</AppText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card },
  summaryThumb: { width: 60, height: 60, borderRadius: Math.round(60 * tileCornerRatio) },
});

export interface ItemEditorProps {
  item: ItemDetail;
  mode: 'review' | 'edit';
  /** Reloads the item after a field change. */
  reload: () => void;
  onSaved: () => void;
  onCancel: () => void;
  /** Shown above the form (OCR status, duplicate warning…). */
  notices?: React.ReactNode;
}

/**
 * Review/edit form. Category is a suggestion the user can change; each field must be confirmed
 * or edited explicitly. Nothing here schedules reminders — that happens on the item screen.
 */
export function ItemEditor({ item, mode, reload, onSaved, onCancel, notices }: ItemEditorProps) {
  const [title, setTitle] = useState(item.title);
  const [category, setCategory] = useState<Category>(item.category);
  const [note, setNote] = useState(item.userNote ?? '');
  const [tags, setTags] = useState(item.tags.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addType, setAddType] = useState<FieldType | null>(null);
  const [addValue, setAddValue] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Same inputs as the capture pipeline (text, domain and extracted-field signals) so the hint matches.
  const suggestion = classify({
    text: [item.displayText, item.ocrText].filter(Boolean).join('\n'),
    domain: item.domain,
    fieldSignals: item.fields.map((f) => fieldSignal(f.fieldType, f.role)),
  })[0];
  const unconfirmed = item.fields.filter((f) => f.requiresConfirmation && !f.userConfirmed && f.fieldType !== 'url');
  const ordered = [...item.fields.filter((f) => f.fieldType !== 'url')].sort((a, b) => Number(b.fieldType === 'date') - Number(a.fieldType === 'date'));

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
      reload();
    } catch (e) {
      setError(toUserMessage(e));
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await confirmDraft(item.id, {
        title,
        category,
        userNote: note,
        tags: tags.split(/[,#\n]/).map((t) => t.trim()).filter(Boolean),
      });
      onSaved();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const addManual = async () => {
    if (!addType) return;
    let valueText = addValue.trim();
    let normalized: string | null = valueText;
    if (addType === 'date') {
      const v = parseUserDateInput(addValue);
      if (!v) return setAddError('예: 2026-10-31 또는 2026-10-31 18:00');
      normalized = v;
      valueText = formatLocal(v);
    } else if (addType === 'amount') {
      const p = toMinor(addValue.trim(), 'KRW');
      if (!p) return setAddError('숫자만 입력해 주세요. 예: 12,000');
      normalized = `${p.minor} KRW`;
      valueText = formatMoney(p.minor, 'KRW');
    } else if (!valueText) {
      return setAddError('값을 입력해 주세요.');
    }
    const f: ExtractedField = {
      id: newId('f'),
      itemId: item.id,
      fieldType: addType,
      valueText,
      normalizedValue: normalized,
      role: addType === 'date' ? 'unknown' : null,
      confidence: 'high',
      method: 'manual',
      evidenceText: null,
      requiresConfirmation: false,
      userConfirmed: true,
      userEditedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    await run(() => addField(f));
    setAddType(null);
    setAddValue('');
    setAddError(null);
  };

  const confirmDelete = (f: ExtractedField) =>
    Alert.alert('이 값을 지울까요?', '추출된 값만 지워지고 원문은 그대로 남아요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => run(() => deleteField(f.id)) },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <ScreenScroll withBottomBar="summary">
        {notices}
        <SummaryCard item={item} title={title} category={category} />
        {error ? <InlineMessage tone="error" message={error} /> : null}

        <View style={{ gap: spacing.sm }}>
          <TextField label="제목" value={title} onChangeText={setTitle} maxLength={200} returnKeyType="done" testID="title-input" />
          <View style={{ gap: spacing.xs }}>
            <AppText variant="label" tone="secondary">분류</AppText>
            {mode === 'review' && suggestion.confidence !== 'unknown' ? (
              <AppText variant="caption" tone="tertiary">{categoryHint(suggestion)}{suggestion.reasons.length ? ` (근거: ${suggestion.reasons.slice(0, 3).join(', ')})` : ''}</AppText>
            ) : null}
            <Row wrap gap={spacing.xs}>
              {CATEGORIES.map((id) => (
                <FilterChip key={id} role="radio" icon={CATEGORY_INFO[id].icon as IconName} label={CATEGORY_INFO[id].short} selected={category === id} onPress={() => setCategory(id)} />
              ))}
            </Row>
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <SectionHeader
            title="추출된 정보"
            subtitle={ordered.length ? '자동으로 찾은 값은 후보예요. 맞는 값만 확인해 주세요.' : '찾은 값이 없어요. 필요한 정보를 직접 추가할 수 있어요.'}
          />
          {ordered.length ? (
            <Card padded={false}>
              {ordered.map((f, i) => (
                <View key={f.id}>
                  {i ? <Divider inset={spacing.md} /> : null}
                  <ExtractedFieldRow
                    field={f}
                    maskByDefault={mode === 'edit'}
                    onConfirm={(v) => run(() => updateField(f.id, { userConfirmed: v }))}
                    onEdit={(e) => run(() => updateField(f.id, { ...e, userConfirmed: true, edited: true }))}
                    onDelete={() => confirmDelete(f)}
                  />
                </View>
              ))}
            </Card>
          ) : null}
          <Card>
            <View style={{ gap: spacing.xs }}>
              <AppText variant="label">직접 추가</AppText>
              <Row wrap gap={spacing.xs}>
                {MANUAL_TYPES.map((t) => (
                  <FilterChip key={t.type} role="radio" label={t.label} selected={addType === t.type} onPress={() => { setAddType(t.type); setAddError(null); }} />
                ))}
              </Row>
              {addType ? (
                <>
                  <TextField
                    label={MANUAL_TYPES.find((t) => t.type === addType)!.label}
                    placeholder={MANUAL_TYPES.find((t) => t.type === addType)!.placeholder}
                    value={addValue}
                    onChangeText={setAddValue}
                    error={addError}
                  />
                  <Row gap={spacing.xs}>
                    <SecondaryButton compact label="추가" onPress={addManual} style={{ flex: 1 }} />
                    <GhostButton compact label="취소" onPress={() => { setAddType(null); setAddValue(''); }} />
                  </Row>
                </>
              ) : null}
            </View>
          </Card>
        </View>

        <View style={{ gap: spacing.sm }}>
          <TextField label="메모" value={note} onChangeText={setNote} multiline maxLength={4000} placeholder="나중에 할 일, 같이 갈 사람 등" />
          <TextField label="태그" value={tags} onChangeText={setTags} placeholder="쉼표로 구분 (예: 주말, 데이트)" hint="태그로 나중에 묶어서 찾을 수 있어요." />
        </View>
      </ScreenScroll>
      <BottomBar
        summary={
          <AppText variant="caption" tone={unconfirmed.length ? 'warning' : 'secondary'}>
            {unconfirmed.length ? `확인이 필요한 값 ${unconfirmed.length}개 — 확인 전 값으로는 알림을 만들지 않아요.` : '확인된 값만 알림·기한에 쓰여요.'}
          </AppText>
        }>
        <SecondaryButton label={mode === 'review' ? '버리기' : '취소'} onPress={onCancel} style={{ flex: 1 }} />
        <PrimaryButton label={mode === 'review' ? '저장하기' : '수정 완료'} onPress={save} loading={saving} style={{ flex: 2 }} testID="save-item" />
      </BottomBar>
    </View>
  );
}
