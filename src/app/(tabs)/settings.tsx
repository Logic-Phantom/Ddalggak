import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AppSwitch, AppText, Card, Divider, FilterChip, InlineMessage, ListRow, Row, ScreenScroll, SectionHeader, spacing } from '@/design-system';
import { toUserMessage } from '@/domain/errors';
import { pickJsonFile } from '@/features/capture/attachment-import-service';
import { exportToShareSheet, importFromFile } from '@/features/export-import/export-service';
import { clearOcrTextEverywhere, countByStatus } from '@/features/items/item-repository';
import { deleteAllData } from '@/features/items/item-service';
import { currentOcrProviderId } from '@/features/ocr/ocr-service';
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
  const router = useRouter();
  const { settings, updateSettings, notifyDataChanged } = useAppState();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const { data } = useLoader(async () => ({ counts: await countByStatus(), bytes: appStorageBytes() }));

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

  const doExport = () =>
    Alert.alert('데이터 내보내기', '내보낸 파일에는 영수증·주소·쿠폰 코드 같은 민감한 정보가 들어 있을 수 있어요. 안전한 곳에만 저장해 주세요. 이미지·PDF 첨부는 포함되지 않아요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '내보내기',
        onPress: async () => {
          try {
            const n = await exportToShareSheet();
            setMessage({ tone: 'success', text: `${n}개 항목을 내보냈어요.` });
          } catch (e) {
            setMessage({ tone: 'error', text: toUserMessage(e) });
          }
        },
      },
    ]);

  const doImport = async () => {
    try {
      const file = await pickJsonFile();
      if (!file) return;
      const r = await importFromFile(file.uri, file.size);
      notifyDataChanged();
      setMessage({ tone: 'success', text: `${r.imported}개를 가져왔어요.${r.skippedExisting ? ` 이미 있는 ${r.skippedExisting}개는 건너뛰었어요.` : ''} 알림은 다시 설정해 주세요.` });
    } catch (e) {
      setMessage({ tone: 'error', text: toUserMessage(e) });
    }
  };

  const doDeleteAll = () =>
    Alert.alert('모든 데이터를 삭제할까요?', '저장한 항목, 첨부 파일, 예약된 알림이 이 기기에서 모두 지워지고 되돌릴 수 없어요. 필요하면 먼저 내보내기를 해 주세요.', [
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
    <ScreenScroll topInset>
      <AppText variant="screenTitle">설정</AppText>
      {message ? <InlineMessage tone={message.tone} message={message.text} /> : null}

      <View style={{ gap: spacing.xs }}>
        <SectionHeader title="저장 방식" />
        <Card padded={false}>
          <ToggleRow label="첨부 파일 보관" hint="끄면 이미지·PDF 원본은 저장하지 않고 제목·확인한 값만 남겨요." value={settings.retainAttachments} onChange={(v) => updateSettings({ retainAttachments: v })} />
          <Divider inset={spacing.md} />
          <ToggleRow label="이미지 원문 텍스트 저장" hint="이미지에서 읽은 글자를 검색용으로 보관해요." value={settings.storeOcrText} onChange={onStoreOcrChange} />
        </Card>
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
          <ListRow icon="archive-outline" label="보관함·완료" value={data ? `${data.counts.archived + data.counts.completed}개` : undefined} onPress={() => router.push('/archive')} />
          <Divider inset={spacing.md} />
          <ListRow icon="share-outline" label="내보내기 (JSON)" onPress={doExport} role="button" />
          <Divider inset={spacing.md} />
          <ListRow icon="download-outline" label="가져오기" onPress={doImport} role="button" />
          <Divider inset={spacing.md} />
          <ListRow icon="trash-outline" label="모든 데이터 삭제" tone="danger" onPress={doDeleteAll} role="button" />
        </Card>
        <AppText variant="caption" tone="tertiary">
          저장된 항목 {data ? data.counts.active : '-'}개 · 첨부 파일 {data ? formatBytes(data.bytes) : '-'}
        </AppText>
      </View>

      <View style={{ gap: spacing.xs }}>
        <SectionHeader title="정보" />
        <Card padded={false}>
          <ListRow icon="shield-checkmark-outline" label="개인정보와 데이터" onPress={() => router.push('/privacy')} />
        </Card>
        <AppText variant="caption" tone="tertiary">
          이미지 글자 인식: {currentOcrProviderId() === 'unavailable' ? '이 버전에서는 아직 지원하지 않아요' : currentOcrProviderId()} · 버전 0.1.0
        </AppText>
      </View>
    </ScreenScroll>
  );
}
