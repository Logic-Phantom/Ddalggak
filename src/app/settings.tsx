import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AppSwitch, AppText, Card, Divider, FilterChip, InlineMessage, ListRow, Row, ScreenScroll, SectionHeader, spacing } from '@/design-system';
import { toUserMessage } from '@/domain/errors';
import { pickJsonFile } from '@/features/capture/attachment-import-service';
import { MAX_EXPORT_ATTACHMENT_BYTES } from '@/features/export-import/archive-format';
import { exportToShareSheet, importFromFile, planExport, type ExportPlan } from '@/features/export-import/export-service';
import { clearOcrTextEverywhere, countByStatus } from '@/features/items/item-repository';
import { isOcrAvailable } from '@/features/ocr/ocr-service';
import { deleteAllData } from '@/features/items/item-service';
import { useAppState } from '@/hooks/app-state';
import { useLoader } from '@/hooks/use-loader';
import { appStorageBytes } from '@/infrastructure/file-storage/app-files';
import { formatBytes } from '@/utils/dates';

const HOURS = [8, 9, 12, 18, 20];

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row gap={spacing.sm} style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body">{label}</AppText>
        <AppText variant="caption" tone="tertiary">{hint}</AppText>
      </View>
      <AppSwitch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </Row>
  );
}

export default function SettingsScreen() {
  const { settings, updateSettings, notifyDataChanged } = useAppState();
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { data } = useLoader(async () => ({ counts: await countByStatus(), bytes: appStorageBytes(), ocrAvailable: await isOcrAvailable() }));
  const ocrAvailable = data?.ocrAvailable;

  const onStoreOcrChange = (v: boolean) => {
    if (v) return updateSettings({ storeOcrText: true });
    Alert.alert('이미지 원문 텍스트 저장을 끌까요?', '앞으로 저장하는 항목은 확인한 값만 남아요. 이미 저장된 원문 텍스트도 지울 수 있어요.', [
      { text: '취소', style: 'cancel' },
      { text: '앞으로만 끄기', onPress: () => updateSettings({ storeOcrText: false }) },
      {
        text: '끄고 기존 원문도 삭제',
        style: 'destructive',
        onPress: async () => {
          await updateSettings({ storeOcrText: false });
          await clearOcrTextEverywhere();
          notifyDataChanged();
          setMessage({ tone: 'success', text: '저장된 이미지 원문 텍스트를 지웠어요.' });
        },
      },
    ]);
  };

  const runExport = async (includeAttachments: boolean) => {
    setBusy(true);
    try {
      const p = await exportToShareSheet({ includeAttachments });
      const left = p.attachments - p.includedAttachments;
      setMessage({
        tone: 'success',
        text: includeAttachments
          ? `${p.items}개 항목과 첨부 ${p.includedAttachments}개(${formatBytes(p.includedBytes)})를 내보냈어요.${left ? ` 첨부 ${left}개는 포함하지 못했어요.` : ''}`
          : `${p.items}개 항목을 내보냈어요. 첨부 파일은 포함하지 않았어요.`,
      });
    } catch (e) {
      setMessage({ tone: 'error', text: toUserMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    if (busy) return;
    let p: ExportPlan;
    try {
      p = await planExport();
    } catch (e) {
      return setMessage({ tone: 'error', text: toUserMessage(e) });
    }
    const left = p.attachments - p.includedAttachments;
    const reasons = [
      p.excluded.budget ? `용량 한도(${formatBytes(MAX_EXPORT_ATTACHMENT_BYTES)}) 초과 ${p.excluded.budget}개` : null,
      p.excluded['too-large'] ? `너무 큰 파일 ${p.excluded['too-large']}개` : null,
      p.excluded.missing ? `기기에서 찾을 수 없는 파일 ${p.excluded.missing}개` : null,
    ].filter(Boolean);
    const attachmentLine = p.attachments
      ? `첨부 ${p.attachments}개 중 ${p.includedAttachments}개(${formatBytes(p.includedBytes)})를 넣을 수 있어요.${left ? ` 빠지는 첨부: ${reasons.join(', ')}.` : ''}`
      : '저장된 첨부 파일이 없어요.';
    Alert.alert(
      '데이터 내보내기',
      `항목 ${p.items}개. ${attachmentLine}\n\n내보낸 파일은 암호화되지 않아요. 영수증·주소·쿠폰 코드 같은 민감한 정보가 들어 있을 수 있으니 안전한 곳에만 저장해 주세요.`,
      [
        { text: '취소', style: 'cancel' },
        { text: '첨부 없이', onPress: () => runExport(false) },
        ...(p.includedAttachments ? [{ text: '첨부 포함', onPress: () => runExport(true) }] : []),
      ],
    );
  };

  const doImport = async () => {
    if (busy) return;
    try {
      const file = await pickJsonFile();
      if (!file) return;
      setBusy(true);
      const r = await importFromFile(file.uri, file.size);
      notifyDataChanged();
      const parts = [
        `${r.imported}개를 가져왔어요.`,
        r.skippedExisting ? `이미 있는 ${r.skippedExisting}개는 덮어쓰지 않고 건너뛰었어요.` : null,
        r.attachmentsRestored ? `첨부 ${r.attachmentsRestored}개를 복원했어요.` : null,
        r.attachmentsNotInBackup ? `첨부 ${r.attachmentsNotInBackup}개는 백업에 들어 있지 않아 복원하지 못했어요.` : null,
        r.remindersOff ? `알림 ${r.remindersOff}개는 꺼진 상태로 가져왔어요. 항목 상세에서 ‘다시 켜기’를 눌러 주세요.` : null,
      ];
      setMessage({ tone: r.attachmentsNotInBackup ? 'info' : 'success', text: parts.filter(Boolean).join(' ') });
    } catch (e) {
      setMessage({ tone: 'error', text: toUserMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const doDeleteAll = () =>
    Alert.alert('모든 데이터를 삭제할까요?', '저장한 항목, 첨부 파일, 예약된 알림이 이 기기에서 모두 지워지고 되돌릴 수 없어요. 설정 값과 이미 내보내 다른 곳에 저장한 백업 파일은 지우지 않아요. 필요하면 먼저 내보내기를 해 주세요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '모두 삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAllData();
            await updateSettings({ onboardingSeenAt: settings.onboardingSeenAt });
            notifyDataChanged();
            setMessage({ tone: 'success', text: '모든 로컬 데이터를 삭제했어요.' });
          } catch (e) {
            setMessage({ tone: 'error', text: toUserMessage(e) });
          }
        },
      },
    ]);

  return (
    <ScreenScroll>
      {message ? <InlineMessage tone={message.tone} message={message.text} /> : null}

      <View style={{ gap: spacing.xs }}>
        <SectionHeader title="저장 방식" />
        <Card padded={false}>
          <ToggleRow label="첨부 파일 보관" hint="끄면 이미지·PDF 원본은 저장하지 않고 제목·확인한 값만 남겨요." value={settings.retainAttachments} onChange={(v) => updateSettings({ retainAttachments: v })} />
          <Divider inset={spacing.md} />
          <ToggleRow label="이미지 원문 텍스트 저장" hint="이미지에서 읽은 글자를 검색용으로 보관해요." value={settings.storeOcrText} onChange={onStoreOcrChange} />
          <Divider inset={spacing.md} />
          <ToggleRow
            label="이미지·PDF 글자 인식"
            hint={
              ocrAvailable === false
                ? '이 기기·버전에서는 글자 인식을 쓸 수 없어요.'
                : '사진과 PDF 앞 3쪽의 글자를 기기 안에서 읽어요. 이미지·글자는 외부로 보내지 않아요.'
            }
            value={settings.ocrEnabled}
            onChange={(v) => updateSettings({ ocrEnabled: v })}
          />
        </Card>
        <AppText variant="caption" tone="tertiary">
          Android 글자 인식은 Google ML Kit(기기 내 모델)을 써요. Google 문서에 따르면 ML Kit는 이미지 내용이 아닌 진단 정보(기기·앱 정보, 처리 시간, 오류 코드 등)를 Google에 보낼 수 있어요. 원하지 않으면 끌 수 있어요.
        </AppText>
      </View>

      <View style={{ gap: spacing.xs }}>
        <SectionHeader title="알림" subtitle="시간이 없는 날짜의 알림 시각" />
        <Row wrap gap={spacing.xs}>
          {HOURS.map((h) => (
            <FilterChip key={h} role="radio" label={`${h}시`} selected={settings.defaultReminderHour === h} onPress={() => updateSettings({ defaultReminderHour: h })} />
          ))}
        </Row>
      </View>

      <View style={{ gap: spacing.xs }}>
        <SectionHeader title="데이터" />
        <Card padded={false}>
          <ListRow icon="share-outline" label={busy ? '처리 중…' : '내보내기 (백업 파일)'} onPress={doExport} role="button" />
          <Divider inset={spacing.md} />
          <ListRow icon="download-outline" label="가져오기" onPress={doImport} role="button" />
          <Divider inset={spacing.md} />
          <ListRow icon="trash-outline" label="모든 데이터 삭제" tone="danger" onPress={doDeleteAll} role="button" />
        </Card>
        <AppText variant="caption" tone="tertiary">
          저장된 항목 {data ? data.counts.pending + data.counts.active + data.counts.completed + data.counts.archived : '-'}개 · 첨부 파일 {data ? formatBytes(data.bytes) : '-'}
        </AppText>
      </View>

    </ScreenScroll>
  );
}
