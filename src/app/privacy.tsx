import { Linking, View } from 'react-native';

import { AppText, Card, GhostButton, ScreenScroll, spacing } from '@/design-system';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '@/utils/app-info';

/** Keep in sync with docs/store/PRIVACY_POLICY.md (the hosted copy linked from Play Console). */
const POLICY_EFFECTIVE_DATE = '2026년 10월 26일';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. 수집하는 개인정보',
    body: 'KeepOn은 개발자나 서버로 어떤 개인정보도 수집·전송하지 않아요. 로그인·회원가입이 없고, 분석·광고·크래시 리포트 도구도 쓰지 않아요.',
  },
  {
    title: '2. 기기 안에서 처리하는 정보',
    body: '다른 앱의 공유 메뉴로 보낸 링크·텍스트·이미지·PDF, 그리고 앱에서 직접 붙여 넣거나 선택한 내용만 처리해요. 날짜·금액·코드 같은 값은 기기 안의 규칙으로 찾은 후보이며, 직접 확인한 날짜로만 알림을 만들어요. 카카오톡 대화, 문자, 이메일, 사진첩을 앱이 스스로 읽거나 훑어보지 않아요.',
  },
  {
    title: '3. 저장 위치와 보관 기간',
    body: '모든 데이터는 이 기기의 앱 전용 저장소(SQLite 데이터베이스와 앱 폴더)에만 저장되고, 사용자가 지우거나 앱을 삭제할 때까지 보관돼요. 데이터베이스는 별도로 암호화되어 있지 않고 운영체제의 앱 격리로 보호돼요. Android 기기 백업을 켜 두었다면 앱 데이터가 사용자의 Google 계정 백업에 포함될 수 있어요(개발자는 접근할 수 없어요).',
  },
  {
    title: '4. 외부 전송과 제3자 제공',
    body: '기본 기능은 네트워크를 쓰지 않아요. 링크 미리보기를 자동으로 가져오지 않아요. 링크는 사용자가 ‘열기’를 눌렀을 때만 기기의 브라우저로 넘기고, 내보내기 파일은 사용자가 고른 앱으로만 전달돼요. 개인정보를 제3자에게 제공하거나 처리를 위탁하지 않아요.',
  },
  {
    title: '5. 권한',
    body: '알림: 사용자가 처음 알림을 만들 때만 요청해요. 사진·파일: 시스템 선택 화면에서 직접 고른 파일만 읽어요(사진첩 전체 접근 권한을 요청하지 않아요). 위치·연락처·카메라·마이크 권한은 쓰지 않아요.',
  },
  {
    title: '6. 확인·내보내기·삭제',
    body: '항목별로 원문·추출값·첨부를 지울 수 있고, 설정에서 전체 데이터를 JSON으로 내보내거나 모두 삭제할 수 있어요. 앱을 삭제하면 기기 안의 데이터도 함께 지워져요. 내보낸 파일에는 민감한 정보가 들어 있을 수 있으니 안전하게 보관해 주세요.',
  },
  {
    title: '7. 아동',
    body: 'KeepOn은 아동을 대상으로 하지 않으며, 아동의 개인정보를 따로 수집하지 않아요.',
  },
  {
    title: '8. 변경',
    body: '처리방침이 바뀌면 앱 업데이트와 함께 이 화면과 웹 페이지에 시행일을 바꿔 알려 드려요.',
  },
];

export default function PrivacyScreen() {
  return (
    <ScreenScroll>
      <AppText variant="secondary" tone="secondary">시행일 {POLICY_EFFECTIVE_DATE}</AppText>
      <View style={{ gap: spacing.sm }}>
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <View style={{ gap: spacing.xxs }}>
              <AppText variant="sectionTitle">{s.title}</AppText>
              <AppText variant="body" tone="secondary">{s.body}</AppText>
            </View>
          </Card>
        ))}
        <Card>
          <View style={{ gap: spacing.xxs }}>
            <AppText variant="sectionTitle">9. 문의</AppText>
            <AppText variant="body" tone="secondary">
              {SUPPORT_EMAIL ? `개인정보 관련 문의: ${SUPPORT_EMAIL}` : '개인정보 관련 문의는 Google Play 스토어의 개발자 연락처로 보내 주세요.'}
            </AppText>
            {SUPPORT_EMAIL ? <GhostButton compact icon="mail-outline" label="메일 보내기" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})} /> : null}
          </View>
        </Card>
      </View>
      {PRIVACY_POLICY_URL ? <GhostButton icon="open-outline" label="웹에서 전체 처리방침 보기" onPress={() => Linking.openURL(PRIVACY_POLICY_URL!).catch(() => {})} /> : null}
    </ScreenScroll>
  );
}
