import { useState } from 'react';
import { View } from 'react-native';

import { AppText, BottomSheet, FilterChip, InlineMessage, PrimaryButton, Row, TextField, spacing } from '@/design-system';
import { fieldLabel } from '@/domain/categories';
import { toUserMessage } from '@/domain/errors';
import type { ItemDetail } from '@/domain/models';
import { canUseFieldForReminder, reminderTypeForRole } from '@/features/reminders/reminder-policy';
import { createReminder } from '@/features/reminders/reminder-service';
import { formatLocal, parseUserDateInput } from '@/utils/dates';

const OFFSETS = [
  { days: 0, label: '당일' },
  { days: 1, label: '하루 전' },
  { days: 3, label: '3일 전' },
  { days: 7, label: '일주일 전' },
];

/**
 * Reminder creation. Only confirmed date fields are offered; a typed date counts as confirmed
 * because the user entered it. Permission is asked here, the first time it is needed.
 */
export function ReminderSheet({ item, visible, onClose, onCreated, defaultHour }: { item: ItemDetail; visible: boolean; onClose: () => void; onCreated: (message: string) => void; defaultHour: number }) {
  const candidates = item.fields.filter(canUseFieldForReminder);
  const unconfirmedDates = item.fields.filter((f) => f.fieldType === 'date' && !f.userConfirmed).length;
  const [selected, setSelected] = useState<string | 'manual'>(candidates[0]?.id ?? 'manual');
  const [manual, setManual] = useState('');
  const [offset, setOffset] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const field = candidates.find((f) => f.id === selected);
    const target = field ? field.normalizedValue : parseUserDateInput(manual);
    if (!target) return setError('날짜를 선택하거나 2026-10-31 형식으로 입력해 주세요.');
    setBusy(true);
    try {
      const label = field ? fieldLabel('date', field.role) : '설정한 날짜';
      const res = await createReminder({
        itemId: item.id,
        itemTitle: item.title,
        targetDate: target,
        daysBefore: offset,
        defaultHour,
        confirmed: true,
        reminderType: reminderTypeForRole(field?.role ?? null),
        label,
        sourceFieldId: field?.id ?? null,
      });
      onCreated(
        res.scheduled
          ? `${formatLocal(res.reminder.scheduledAt)}에 알려 드릴게요. 기기 설정(방해 금지·절전)에 따라 늦거나 오지 않을 수 있어요.`
          : res.failed
            ? '알림은 저장했지만 기기 알림 예약에 실패했어요. 아래 알림 목록의 ‘다시 예약’으로 다시 시도할 수 있어요.'
            : res.permission === 'unavailable'
              ? '이 실행 환경(Expo Go 등)에서는 기기 알림을 쓸 수 없어요. 알림 탭에서 일정을 확인할 수 있어요.'
              : '알림 권한이 없어 기기 알림은 예약하지 못했어요. 알림 탭에서 일정을 확인할 수 있어요.',
      );
      onClose();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} title="알림 만들기" onClose={onClose}>
      {unconfirmedDates ? <InlineMessage tone="warning" message={`확인하지 않은 날짜 ${unconfirmedDates}개는 목록에 없어요. 항목 수정에서 먼저 확인해 주세요.`} /> : null}
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">어떤 날짜에 맞출까요?</AppText>
        <Row wrap gap={spacing.xs}>
          {candidates.map((f) => (
            <FilterChip key={f.id} role="radio" label={`${fieldLabel('date', f.role)} ${f.valueText}`} selected={selected === f.id} onPress={() => setSelected(f.id)} />
          ))}
          <FilterChip role="radio" label="직접 입력" selected={selected === 'manual'} onPress={() => setSelected('manual')} />
        </Row>
        {selected === 'manual' ? <TextField label="날짜" placeholder="2026-10-31 또는 2026-10-31 18:00" value={manual} onChangeText={setManual} /> : null}
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label">언제 알려 드릴까요?</AppText>
        <Row wrap gap={spacing.xs}>
          {OFFSETS.map((o) => (
            <FilterChip key={o.days} role="radio" label={o.label} selected={offset === o.days} onPress={() => setOffset(o.days)} />
          ))}
        </Row>
        <AppText variant="caption" tone="tertiary">시간이 없는 날짜는 {defaultHour}시에 알려요. 기기 설정(방해 금지, 절전)에 따라 늦거나 오지 않을 수 있어요.</AppText>
      </View>
      {error ? <InlineMessage tone="error" message={error} /> : null}
      <PrimaryButton label="알림 만들기" onPress={submit} loading={busy} />
    </BottomSheet>
  );
}
