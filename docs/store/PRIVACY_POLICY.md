# 킵온(KeepOn) 개인정보 처리방침

> 게시용 원본. 같은 내용을 `site/privacy-policy.html`(GitHub Pages 게시본)로 변환해 두었다. 앱 안의 화면(`src/app/privacy.tsx`)과 내용·시행일을 함께 고친다.
> 법률 자문이 아니므로 필요하면 전문가 검토를 받는다.

시행일: 2026년 10월 26일

임채명(이하 "개발자")은 Android 앱 「킵온(KeepOn)」(이하 "앱")을 이용하는 분의 개인정보를 소중히 다루며, 「개인정보 보호법」 등 관련 법령을 지킵니다. 이 처리방침은 앱이 어떤 정보를 어떻게 다루는지 설명합니다.

## 1. 개발자가 수집하는 개인정보

개발자는 앱을 통해 **어떠한 개인정보도 수집하거나 전송받지 않습니다.**
- 회원가입·로그인 기능이 없습니다.
- 개발자가 운영하는 서버가 없습니다.
- 분석, 광고, 크래시 리포트, 추적 도구(SDK)를 사용하지 않습니다.
- 광고 ID를 사용하지 않습니다.

## 2. 기기 안에서만 처리되는 정보

앱은 사용자가 직접 보낸 내용만 사용자 기기 안에서 처리합니다.

| 정보 | 언제 처리하나요 | 어디에 저장되나요 |
|---|---|---|
| 링크, 텍스트 | 다른 앱의 공유 메뉴로 보내거나 앱에 직접 입력·붙여넣기할 때 | 기기 안 앱 전용 데이터베이스 |
| 이미지, PDF | 공유 메뉴로 보내거나 시스템 선택 화면에서 직접 고를 때 | 기기 안 앱 전용 폴더 (설정에서 보관 끄기 가능) |
| 날짜·금액·쿠폰/주문/예약 번호·전화번호·주소 후보 | 위 내용에서 기기 안의 규칙으로 찾을 때 | 기기 안 앱 전용 데이터베이스 |
| 알림 일정 | 사용자가 확인한 날짜로 알림을 만들 때 | 기기 안 데이터베이스 및 운영체제 로컬 알림 |

- 앱은 카카오톡 대화, 문자, 이메일, 사진첩, 연락처를 스스로 읽거나 훑어보지 않습니다.
- 클립보드는 사용자가 ‘붙여넣기’를 누를 때만 읽습니다.
- 공유된 링크의 웹페이지를 자동으로 불러오지 않습니다.

## 3. 보관 기간과 파기

- 기기 안의 정보는 사용자가 항목을 삭제하거나, 설정 > 모든 데이터 삭제를 하거나, 앱을 삭제할 때까지 보관되며 그 즉시 기기에서 지워집니다.
- 저장 후 확인하지 않은 임시 항목은 하루가 지나면 자동으로 지워집니다.
- 데이터베이스와 파일은 별도로 암호화되어 있지 않으며, 운영체제의 앱 격리로 보호됩니다.
- Android 기기 백업이 켜져 있으면 앱 데이터가 사용자의 Google 계정 백업에 포함될 수 있습니다. 이 백업은 Google과 사용자 사이의 서비스이며 개발자는 접근할 수 없습니다.

## 4. 제3자 제공 및 처리 위탁

개발자는 개인정보를 제3자에게 제공하거나 처리를 위탁하지 않습니다.
다만 사용자가 직접 다음 동작을 할 때 정보가 다른 앱으로 넘어갑니다.
- 링크 ‘열기’: 해당 주소를 기기의 브라우저로 넘깁니다. 이후 처리는 브라우저와 해당 사이트의 정책을 따릅니다.
- ‘내보내기’: 데이터 파일(JSON)을 사용자가 고른 앱으로 넘깁니다.
- 첨부 ‘다른 앱으로 열기’: 해당 파일을 사용자가 고른 앱으로 넘깁니다.

## 5. 앱이 사용하는 권한

| 권한 | 목적 | 요청 시점 |
|---|---|---|
| 알림 | 사용자가 만든 기한 알림 표시 | 처음 알림을 만들 때 (거부해도 앱 안에서 기한 확인 가능) |
| 재부팅 후 실행 | 기기 재시작 후 예약된 알림 복원 | 별도 요청 없음 |
| 진동 | 버튼 누름 피드백 | 별도 요청 없음 |

사진은 시스템 사진 선택 화면에서 사용자가 고른 것만 읽으며, 사진첩 전체 접근 권한을 요청하지 않습니다. 위치, 연락처, 카메라, 마이크 권한은 사용하지 않습니다.

## 6. 이용자의 권리

모든 정보가 사용자 기기 안에 있으므로 사용자가 앱에서 직접 확인·수정·삭제할 수 있습니다.
- 항목별 수정·삭제, 첨부·원문 삭제
- 설정 > 내보내기(JSON)로 전체 정보 사본 받기
- 설정 > 모든 데이터 삭제
개발자는 사용자 정보를 갖고 있지 않으므로 개발자에게 열람·삭제를 요청할 정보는 없습니다.

## 7. 아동의 개인정보

앱은 만 14세 미만 아동을 대상으로 하지 않으며, 아동의 개인정보를 따로 수집하지 않습니다.

## 8. 안전성 확보 조치

- 외부 전송 기능이 없도록 설계했습니다.
- 오류 기록에는 원문, 링크, 쿠폰 코드, 파일 경로를 남기지 않습니다.
- 쿠폰·주문·예약 번호와 전화번호는 화면에서 기본으로 가려 둡니다.
- 알림 문구에는 금액·코드·원문을 넣지 않습니다.

## 9. 개인정보 보호책임자 및 문의

- 개인정보 보호책임자: 임채명
- 이메일: dlacoaud96@gmail.com

개인정보 침해에 대한 신고나 상담은 아래 기관에 문의할 수 있습니다.
- 개인정보침해신고센터: privacy.kisa.or.kr / 국번 없이 118
- 개인정보분쟁조정위원회: www.kopico.go.kr / 1833-6972

## 10. 처리방침의 변경

이 처리방침이 바뀌면 앱 업데이트와 함께 앱 안의 처리방침 화면과 이 페이지에 변경 내용과 시행일을 알립니다.

---

## Privacy Policy (English summary)

Effective: October 26, 2026

KeepOn (킵온) does not collect, transmit or share any personal data. There is no account, no server, and no analytics, advertising or crash-reporting SDK, and the advertising ID is not used. Content you share into the app or add yourself (links, text, images, PDFs) and the dates, amounts and codes found in it are stored only on your device, unencrypted, protected by the operating system's app sandbox, until you delete them or uninstall the app. If Android device backup is on, app data may be included in your own Google account backup, which the developer cannot access. Links open in your browser only when you tap them; exports go only to the app you choose. Permissions: notifications (requested when you create your first reminder), run at startup (restore scheduled reminders), vibration. Photos are read only through the system photo picker. Contact: dlacoaud96@gmail.com.
