import { View } from 'react-native';

import { AppText, Card, ScreenScroll, spacing } from '@/design-system';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '무엇을 처리하나요',
    body: '다른 앱의 공유 메뉴로 보낸 링크·텍스트·이미지·PDF, 그리고 앱에서 직접 붙여 넣거나 선택한 내용만 처리해요. 카카오톡 대화, 문자, 이메일, 사진첩을 앱이 스스로 읽거나 훑어보지 않아요.',
  },
  {
    title: '어디에 저장되나요',
    body: '모든 데이터는 이 기기의 앱 전용 저장소(SQLite 데이터베이스와 앱 폴더)에만 저장돼요. 로그인, 서버, 클라우드 동기화가 없어요. 데이터베이스는 별도로 암호화되어 있지 않고, 운영체제의 앱 격리(샌드박스)로 보호돼요.',
  },
  {
    title: '밖으로 나가는 데이터',
    body: '딸깍은 저장한 내용을 기기 밖으로 보내지 않아요. 링크 미리보기를 자동으로 가져오지 않고, 원격 AI·분석·광고 SDK도 없어요. 링크는 사용자가 ‘열기’를 눌렀을 때만 기기의 브라우저로 넘겨요. Android의 이미지 글자 인식은 기기 안의 Google ML Kit로 하는데, Google 문서에 따르면 ML Kit는 이미지 내용이 아닌 진단 정보(기기·앱 정보, 처리 시간, 오류 코드 등)를 Google에 보낼 수 있어요. 설정에서 글자 인식을 끌 수 있어요.',
  },
  {
    title: '자동 추출은 후보예요',
    body: '날짜·금액·코드는 기기 안의 규칙으로 찾은 후보예요. 틀릴 수 있어서 직접 확인한 날짜로만 알림을 만들어요. 반품·보증 기한은 판매자 정책마다 달라 앱이 계산해서 정하지 않아요.',
  },
  {
    title: '확인·내보내기·삭제',
    body: '항목별로 원문·추출값·첨부를 지울 수 있고, 설정에서 전체 데이터를 백업 파일로 내보내거나(첨부 포함 선택 가능) 모두 삭제할 수 있어요. 백업 파일은 암호화되지 않고 민감한 정보가 들어 있을 수 있으니 안전하게 보관해 주세요.',
  },
  {
    title: '로그',
    body: '오류가 나도 원문 텍스트, 링크, 쿠폰 코드, 파일 경로는 기록하지 않고 오류 종류만 남겨요. 외부 크래시 리포트 도구는 쓰지 않아요.',
  },
];

export default function PrivacyScreen() {
  return (
    <ScreenScroll>
      <AppText variant="secondary" tone="secondary">이 안내는 앱의 실제 동작을 설명해요. 법률 자문이 아니며, 정식 출시 전에 개인정보 처리방침을 별도로 마련할 예정이에요.</AppText>
      <View style={{ gap: spacing.sm }}>
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <View style={{ gap: spacing.xxs }}>
              <AppText variant="sectionTitle">{s.title}</AppText>
              <AppText variant="body" tone="secondary">{s.body}</AppText>
            </View>
          </Card>
        ))}
      </View>
    </ScreenScroll>
  );
}
