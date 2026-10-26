# 딸깍 (Ddalggak)

> 저장한 정보를, 딸깍 한 번에.

다른 앱에서 발견한 링크·텍스트·이미지·문서를 공유 메뉴로 보내 두면, 기기 안에서 날짜·금액·쿠폰 코드 같은 정보를 **후보로** 찾아 주고, 사용자가 확인한 날짜로만 알림을 만들어 주는 개인용 생활정보 인박스입니다.

- iOS + Android 크로스플랫폼 (React Native + Expo SDK 58, Expo Router, TypeScript strict)
- **로컬 우선**: 로그인·서버·원격 AI 없이 동작. SQLite + 앱 전용 폴더 + 로컬 알림
- 공유된 URL을 앱이 자동으로 조회하거나 스크래핑하지 않음
- 자동 추출값은 근거·신뢰도와 함께 보여 주고, 확인 전 값으로는 알림을 만들지 않음

## 현재 지원 범위 (2026-10-24)

| 기능 | 상태 |
|---|---|
| 텍스트/URL 직접 입력·붙여넣기 | 구현, 웹 프리뷰에서 확인 |
| 사진/문서(PDF·이미지) 선택 | 구현, 기기 미검증 |
| 외부 앱 공유 수신 (Android intent / iOS Share Extension) | 설정·코드 구현, **실기기 미검증** ([지원표](docs/SHARE_RECEIVING_POC.md)) |
| 한국어 날짜·시간·금액·코드·주소 규칙 추출 | 구현, 단위/fixture 테스트 통과 |
| 이미지 OCR | **미연결** — OCR 계약만 있고 "지원하지 않음"을 안내 ([계획](docs/OCR_AND_EXTRACTION.md)) |
| 분류 후보, 검토·수정·확인 UI | 구현 |
| 로컬 알림 (확인된 날짜만) | 구현, 기기 알림 전달 미검증 |
| 검색·분류·태그·보관·완료·삭제 | 구현 |
| JSON 내보내기/가져오기, 전체 삭제 | 구현 (첨부 파일은 내보내기에 미포함) |
| iOS | 빌드 환경 없음(Windows) → 전부 미검증 |

공유 수신 동작은 OS 버전과 보내는 앱(카카오톡 등)에 따라 달라질 수 있으며, 앱이 노출한 공유 데이터만 받을 수 있습니다. 공유가 안 되는 경우에도 앱 안의 붙여넣기·사진 선택·파일 선택은 동작합니다.

## 요구 사항

- Node.js 20+ (확인 환경: Node 24.20.0, npm 11.19.0)
- Android: Android Studio/SDK (development build), 또는 EAS Build
- iOS: macOS + Xcode, 또는 EAS Build + Apple Developer 계정

## 설치·실행

```bash
npm install
```

```bash
npx expo start --web
```

웹은 UI 확인용입니다(공유 수신·알림·파일 복사는 동작하지 않음). 공유 수신은 Expo Go에서 동작하지 않으므로 development build가 필요합니다.

```bash
npx expo run:android
```

```bash
npx eas-cli@latest build --profile development --platform android
```

EAS를 쓰려면 먼저 `npx eas-cli@latest init`으로 본인 계정의 프로젝트를 연결하세요. 환경변수는 필수 항목이 없습니다(`.env.example` 참고).

## 테스트

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

## 프로젝트 구조

```
src/app/             화면 (홈·보관함·+·알림·마이 탭, capture, item, search, settings, privacy, licenses)
src/components/      InboxItemRow, ItemEditor, ExtractedFieldRow, ReminderSheet
src/design-system/   토큰과 공용 컴포넌트
src/domain/          모델·분류 라벨·오류
src/features/        incoming-share, capture, ocr, extraction, items, reminders, search, export-import, preferences
src/infrastructure/  SQLite, 파일 저장소, 로컬 알림 (+ 웹 대체 구현)
src/generated/       오픈소스 고지 목록 (scripts/license-audit.mjs가 생성)
tests/               unit, share-intent, extraction-fixtures(가상 텍스트)
scripts/             앱 아이콘 생성, 라이선스 감사, Android 기기 QA
docs/                아키텍처·결정·POC·개인정보·위협 모델·라이선스·비용·테스트·로드맵·출시
docs/store/          Play 등록정보 원고, 정책 답변, 처리방침(웹 게시용), 스토어 그래픽
```

출시: [RELEASE_CHECKLIST](docs/RELEASE_CHECKLIST.md) · [스토어 등록정보](docs/store/PLAY_STORE_LISTING.md) · [Play Console 답변](docs/store/PLAY_CONSOLE_FORMS.md) · [개인정보 처리방침](docs/store/PRIVACY_POLICY.md)

자세한 내용: [ARCHITECTURE](docs/ARCHITECTURE.md) · [DECISIONS](docs/DECISIONS.md) · [DATA_MODEL](docs/DATA_MODEL.md) · [PRIVACY](docs/PRIVACY.md) · [THREAT_MODEL](docs/THREAT_MODEL.md) · [LICENSES](docs/LICENSES_AND_COPYRIGHT.md) · [COSTS](docs/APP_STORE_AND_COSTS.md) · [BRAND](docs/BRAND_AND_TRADEMARKS.md) · [TESTING](docs/TESTING.md) · [ROADMAP](docs/ROADMAP.md)

## 개인정보

모든 데이터는 기기 안에만 저장되며 기본 기능은 네트워크를 쓰지 않습니다. 데이터베이스와 첨부 파일은 **암호화되어 있지 않고** OS 앱 격리에 의존합니다. 분석·광고·크래시 리포트 SDK는 없습니다. 설정에서 내보내기·전체 삭제가 가능합니다.

## 작업 내역 (Work Log)

### 2026-10-24 — 프로젝트 초기 생성 (Phase 0~5 기반)

**구현**
- Expo SDK 58(`expo@58.0.19`, `react-native@0.88.0`) + Expo Router + TypeScript strict 프로젝트 생성. CutPick(`C:\eclipse_AI\Cutpick`)의 설정·SQLite 마이그레이션 패턴·파일 저장소·오류/로그 정책·디자인 시스템 구조·Pretendard 폰트·스크립트를 가져와 딸깍에 맞게 수정(D-002). Supabase/커뮤니티/EAS projectId는 가져오지 않음.
- 공유 수신: `expo-sharing` config plugin(Android intent filter, iOS Share Extension), `+native-intent.ts` 라우팅, raw payload 정규화·MIME/헤더/파일명 검증, 앱 폴더 복사.
- 캡처 파이프라인: 입력 → 파일 복사·검증 → OCR(현재 미지원 provider) → 규칙 추출 → draft → 검토 → 저장.
- 추출: 한국어 날짜(절대/연도 없음/상대/D-n/요일 검증/시간), 날짜 의미(가장 가까운 라벨), 금액(원·만원·USD 등, 정수 최소 단위, 합계/부가세/할인 구분), 쿠폰/주문/예약/티켓 번호(OTP·비밀번호 제외), 전화·주소·상호, 반품 기한 문구(날짜 계산 안 함), 분류 후보, 재분석 시 사용자 수정값 보존.
- 데이터: SQLite v1 스키마(items, extracted_fields, attachments, reminders, tags, kv), 트랜잭션 마이그레이션, 시작 시 정합성 정리.
- 알림: 확인된 날짜만, 과거·잘못된 날짜·60개 초과 거부, 권한은 첫 알림 때 요청, 거부 시 앱 내 기한 탭으로 대체, 보관/완료 시 취소.
- UI: 인박스(첫 실행 안내, 최근/검토 필요/7일 안 필터, 분류 칩), 캡처, 검토, 상세(코드 마스킹, 근거 보기, 알림 시트), 수정, 검색, 기한, 설정(첨부 보관, OCR 원문 저장·삭제, 알림 시각, 내보내기/가져오기, 전체 삭제), 보관함, 개인정보 안내.
- 앱 아이콘/스플래시 직접 제작(`scripts/build-app-icons.py`).

**주요 파일**: `app.json`, `src/app/**`, `src/features/**`, `src/infrastructure/**`, `src/design-system/**`, `tests/**`, `docs/**`

**실행한 명령과 결과**
- `npm install`, `npx expo install expo-notifications expo-document-picker` — 성공
- `npx jest` — 6 suites, **124 통과 / 0 실패**
- `npx tsc --noEmit` — 통과
- `npx expo lint` — 통과
- `npx expo-doctor` — 20/20 통과
- `npx expo start --web` + 내장 브라우저(375×812) 수동 확인: 인박스 → 직접 추가 → 검토 → 저장 → 상세 → 알림 만들기(권한 없음 경로) → 기한 탭. 이 과정에서 "교환권" 오분류와 제목 내 쿠폰 코드 노출 버그 2건을 발견·수정하고 회귀 테스트 추가.

**검증 범위**
- Android/iOS 실기기·에뮬레이터: **미실행**. 공유 수신 출처 앱(카카오톡·Chrome·사진·파일) 검증 없음 — 지원표 전부 "미검증".
- OCR: 엔진 미연결, 정확도 측정 없음. 추출 fixture는 직접 작성한 가상 텍스트 8건(실제 OCR 결과 아님).
- 네트워크 사용: 개발 중 npm 패키지 설치만. 앱 기능은 네트워크를 사용하지 않음.
- 라이선스: 주요 런타임 패키지 MIT, Pretendard OFL 1.1, 아이콘 자체 제작. 전체 의존성 트리 감사(`scripts/license-audit.mjs`)는 미실행.
- 비용·상표: 공식 금액·KIPRIS 검색 미확인(문서에 확인 링크만 기록).
- 개인 자료: 저장소·테스트·문서에 실제 영수증/대화/계정 화면 없음.

**다음 우선순위**: Android development build 공유 수신 POC → Android ML Kit 한국어 OCR POC → 기기 알림 검증 → 앱 전환 화면 가림·오픈소스 고지 화면 → iOS EAS 빌드.

### 2026-10-24 — 실기기(Galaxy Z Flip5) 연결 시도, Expo Go 호환 수정, 테스트용 APK

**환경 확인**
- USB 연결 기기: Samsung Galaxy Z Flip5 (`SM-F731N`), adb 인식 정상. Android SDK는 `%LOCALAPPDATA%\Android\Sdk`, 빌드에는 JDK 17 사용(시스템 `JAVA_HOME`은 JDK 1.8이라 그대로는 빌드 불가).
- `npx expo prebuild --platform android` 결과 AndroidManifest에 공유 수신 intent filter 생성 확인: `ACTION_SEND`(text/plain, image/*, application/pdf), `ACTION_SEND_MULTIPLE`(image/*). 앱에서 실제 공유 수신 동작은 아직 미확인.

**Expo Go 테스트 결과**
- 폰의 Expo Go 58.0.5로 Metro(`expo start --go`, USB `adb reverse`)에 연결해 실행 → `expo-notifications` import 시 `ExpoTopicSubscriptionModule` 네이티브 모듈이 없어 **앱이 시작되지 않음**.
- 수정(D-013): 알림 모듈을 지연 로딩하고, Expo Go에서는 기기 알림 대신 "이 실행 환경에서는 기기 알림을 쓸 수 없어요" 안내 + 기한 탭 표시로 대체. 수정 후 Expo Go 화면 재확인은 사용자 요청으로 중단(→ APK로 전환).
- Expo Go에는 딸깍 전용 공유 intent가 포함되지 않으므로, 다른 앱 공유 메뉴에 "딸깍"이 뜨는지는 Expo Go로 검증할 수 없음.

**테스트용 APK (D-014)**
- `android/gradlew assembleRelease`로 JS 번들을 포함한 단독 실행 APK 빌드(디버그 키 서명, 테스트 전용). 생성 위치: `android/app/build/outputs/apk/release/app-release.apk` (android 폴더는 CNG 산출물이라 git에 포함하지 않음).

**로컬 APK 빌드 결과**: 4회 모두 실패. 원인은 사용자 폴더 경로의 한글(`C:\Users\서현`)로, Gradle 캐시·임시 폴더·SDK를 영문 경로로 우회하자 단계는 진행됐지만 마지막에 NDK clang이 링커를 실행하지 못함(`unable to execute command`). → EAS 빌드로 전환.

**EAS 빌드 (성공)**
- `npx eas-cli@latest init` — `@lcm2/ddalggak` 프로젝트 생성·연결(app.json에 projectId/owner 추가), Android 키스토어는 EAS 서버 보관.
- `npx eas-cli@latest build --platform android --profile preview` → **FINISHED**, APK: https://expo.dev/artifacts/eas/HzGKPyc2NjZHacT1L2-U12U89egMSlL2PDkhQIOZpTg.apk (빌드 페이지: https://expo.dev/accounts/lcm2/projects/ddalggak/builds/85840c36-32de-4501-adad-990de11bcfc9)
- 폰 설치·기능 확인은 사용자가 직접 진행 예정(미검증).

**실행 즉시 종료 버그 수정**
- 증상: 첫 APK를 설치하면 열자마자 앱이 꺼짐.
- 원인(logcat): `NativeTabs.Trigger.Icon 'md' icons on Android require 'expo-symbols'` — 하단 탭의 Android 머티리얼 아이콘에 필요한 `expo-symbols`가 빠져 있었음(CutPick에서 옮길 때 누락). 웹 프리뷰는 JS 탭을 써서 드러나지 않았음.
- 수정: `npx expo install expo-symbols`(`~58.0.4`). jest 124 통과, tsc 통과, expo-doctor 20/20.
- 재빌드: https://expo.dev/artifacts/eas/nJcyZW0xtz8Btp8wNOOe9WvthwbCOAZmWojydIEyWAs.apk (빌드 234787bd)
- Galaxy Z Flip5에 adb로 설치·실행: `Running "main"` 이후 크래시 로그 없음, 프로세스 유지 확인.

### 2026-10-24 — 실기기 화면·공유 수신 테스트 (Galaxy Z Flip5, 빌드 234787bd APK)

| 테스트 | 방법 | 결과 |
|---|---|---|
| 첫 화면 | 앱 실행 | ✅ 인박스·안내 카드·네이티브 하단 탭 정상 표시 |
| 텍스트+링크 공유 (앱 종료 상태) | `am start -a SEND -t text/plain` (카카오톡 텍스트 공유와 같은 intent) | ✅ 추가하기 화면으로 바로 열림 → 정리하기 → 분류 "예약" 후보, 예약일 2026.11.02 19:00(근거 분명), 예약번호 추출, 제목의 번호 마스킹 → 확인·저장 → 상세에서 번호 기본 가림 |
| 시스템 등록 | `cmd package query-activities -a SEND` | ✅ image/png, text/plain 모두 `app.ddalggak.mobile/.MainActivity` 등록 |
| 이미지 공유 (adb intent, content://media) | `am start -a SEND --eu EXTRA_STREAM ... --grant-read-uri-permission` | ⚠️ 받은 내용 표시는 됨. 정리하기 시 `file-access-lost`. 시스템에 URI 권한 기록이 없음 → 셸이 미디어 권한을 대신 줄 수 없는 테스트 한계로 추정(앱 버그 여부 미확정) |
| 갤러리 앱 → 공유 시트 | 삼성 갤러리에서 가상 쿠폰 이미지 공유 | ✅ 첫 앱 줄(추천 앱)에는 없고 **"더보기"에 표시됨** (사용자 확인). 삼성 공유 시트가 아직 쓰지 않은 앱을 더보기에 두는 동작으로, 앱 문제 아님 |

이번에 고친 것 (테스트 125개 통과, **아직 APK에 미반영**)
- MediaStore 공유 시 파일 이름 자리에 미디어 번호(`1000021865`)가 보이던 문제 → 확장자 없는 이름은 표시하지 않음.
- 공유 파일 복사 실패 대비: 새 `File.copy`가 실패하면 `expo-file-system/legacy`의 `copyAsync`(ContentResolver 스트림)로 한 번 더 시도.

### 2026-10-24 — 디자인 구조 개편 (레퍼런스 시안 반영, 아이콘 유지)

- 사용자 제공 시안 기준으로 구조 변경. 앱 아이콘은 기존 그대로.
- 결정: 시안의 **커뮤니티 탭은 제외**(서버·로그인 필요 → 로컬 우선 원칙 유지, 사용자 선택).
- 하단 탭: 인박스/검색/기한/설정 → **홈 · 보관함 · (+) · 알림 · 마이**. 가운데 + 로 추가 화면 이동. 네이티브 탭 → JS 탭으로 통일.
- 새/변경 화면: 온보딩(첫 실행), 홈(인사말·검색 pill·원형 카테고리 아이콘·다가오는 기한 카드·최근 저장), 보관함(카테고리 칩 + 진행 중/완료/보관됨 + 썸네일 목록, 기존 archive·category 화면 통합), 마이페이지(통계 + 메뉴), 공유받은 정보(미리보기 카드 + 자동 분류 미리보기), 정보 확인하기(요약 카드 + 저장하기), 상세보기(상단 이미지). 검색·설정은 스택 화면으로 이동.
- 토큰: 파란 포인트 → 딥그린(`#1F3D36`) + 카테고리 파스텔 톤. 문서: `docs/DESIGN_SYSTEM.md` 갱신.
- 실행: `npx tsc --noEmit` 통과, `npx expo lint` 통과, `npx jest` 125 통과. 웹 미리보기(375×812)에서 온보딩 → 홈 → + → 공유받은 정보(분류 미리보기) → 정보 확인하기 → 저장 → 보관함 → 마이페이지 확인.
- 미검증: 새 디자인의 Android 실기기 표시(APK 재빌드 필요), 다크 모드·큰 글자 실기기 확인.

### 2026-10-24 — 새 디자인 실기기 기능 점검 (Galaxy Z Flip5, 빌드 388e2daf APK)

| 기능 | 결과 |
|---|---|
| 온보딩 → 홈 | ✅ (기존 사용자도 1회 표시) |
| 하단 탭바 | ❌→✅ 시스템 내비게이션 버튼에 가려짐 → safe area 반영해 수정 |
| 탭 이동 (홈·보관함·알림·마이) | ✅ |
| (+) 직접 추가 → 정리하기 → 정보 확인하기 | ✅ 날짜 추출, 분류 변경(링크→티켓), 날짜 확인, 의미 수정(행사일, "직접 수정함"), 태그, 저장 → 상세 |
| 알림 권한 | ✅ 첫 알림 생성 시에만 요청 (사용자가 직접 허용) |
| 알림 예약 | ✅ 시스템 알람 2026-11-14 09:00 KST 등록 확인 (행사일 하루 전), 알림 탭 표시 |
| 검색 | ❌→✅ 검색어가 바뀌어도 다시 불러오지 않던 버그(`useLoader`) 수정, "concert" 검색 결과 확인 |
| 완료 → 알림 취소 | ✅ 시스템 알람 2→0, "꺼짐" 표시, 보관함 완료 탭으로 이동 |
| 되돌리기 / 보관 / 되돌리기 | ✅ (문구 "인박스로…", "보관함으로 옮겼어요"가 새 구조와 안 맞아 수정 — 다음 APK에 반영) |
| 텍스트 공유 수신 (앱 종료 상태) | ✅ 미리보기 카드, 분류 미리보기 "쿠폰", 만료일 2026.12.31, 제목 내 코드 마스킹 |
| 버리기 | ✅ 확인 대화상자 후 홈·보관함에서 사라짐 |
| 설정 (저장 방식·알림 시각) | ✅ 화면·칩 동작. "모든 데이터 삭제"·내보내기는 실데이터/연락처 노출 우려로 실행 안 함 |

문구 수정 반영 APK(빌드 e1a44a26, https://expo.dev/artifacts/eas/t0tryqbjfIEjsrLZMwb8gwC5bsKe3YadQnuJ3MblsXI.apk)를 폰에 설치해 확인: 보관 후 버튼 "진행 중으로 되돌리기", 되돌린 뒤 "진행 중으로 되돌렸어요…" 표시, 크래시 로그 없음.

추가 수정: 직접 추가 화면 제목("새 정보 추가"), 영문 분류·날짜 키워드, 탭 접근성 이름, 검토 화면 분류 힌트를 저장 기준과 일치, 상태 라벨 "진행 중". 테스트 127개 통과. 테스트로 만든 "Concert…" 항목(알림 꺼짐 상태)은 폰에 남아 있음.

테스트에 쓴 가상 이미지는 폰에서 삭제함. 공유 시트 조사 중 하단 앱 영역만 캡처하려다 연락처 바로가기 줄이 일부 포함된 캡처가 생겨 즉시 삭제함(저장소·문서에 포함 안 됨).

**변경 파일**: `app.json`, `src/infrastructure/notifications/local-notifications.ts`(+`.web.ts`), `src/components/items/ReminderSheet.tsx`, `src/app/(tabs)/reminders.tsx`, `src/app/item/[id].tsx`, `docs/DECISIONS.md`, `docs/TESTING.md`, `README.md`

**실행한 명령과 결과**
- `npx jest` — 124 통과 / 0 실패, `npx tsc --noEmit` — 통과, `npx expo lint` — 통과
- 실기기 기능 테스트(공유 수신·사진/파일 선택·알림): **미실행** — 사용자가 APK로 직접 확인 예정

### 2026-10-26 — 출시 전 검토 (Google Play 1.0.0 준비)

**환경**: macOS(Darwin 24.6), Node 24.22.0, npm 11.19.1. 저장소를 새로 받아 `npm install`.

**고친 것** (자세한 표: `docs/RELEASE_CHECKLIST.md` 3장)
- 앱 종료 상태에서 알림을 누르면 항목이 안 열리던 문제 → 마지막 알림 응답을 한 번 읽고 지움.
- 재예약된 알림 제목이 항목 제목 대신 라벨로 표시 → 항목 제목 사용.
- 없어진 "기한 탭"을 가리키던 문구 → "알림 탭".
- 버전 하드코딩 제거, `1.0.0`으로 올림. 지원 이메일·처리방침 URL은 `app.json` `extra`에서 읽음(D-015).
- 개인정보 화면을 실제 처리방침으로 교체, 오픈소스 라이선스 화면 추가(D-016).
- `WRITE_EXTERNAL_STORAGE`, `AD_ID` 권한 차단(D-017). 스플래시 배경을 현재 토큰에 맞춤. `eas.json` 제출 트랙 internal/draft.

**만든 것**: `docs/RELEASE_CHECKLIST.md`, `docs/store/PLAY_STORE_LISTING.md`(이름·설명·출시 노트·스크린샷 목록), `docs/store/PLAY_CONSOLE_FORMS.md`(데이터 보안·콘텐츠 등급·타겟층·권한), `docs/store/PRIVACY_POLICY.md` + `privacy-policy.html`, `docs/store/assets/`(512 아이콘·1024×500 그래픽, `python scripts/build-app-icons.py --store`).

**실행한 명령과 결과**
- `npx tsc --noEmit` 통과 · `npx expo lint` 통과 · `npx jest` 127/127 · `npx expo-doctor` 20/20
- `npx expo prebuild --platform android --no-install`로 매니페스트 확인(targetSdk 36, 차단 권한 제거 확인) 후 생성 폴더 삭제
- `npx expo export --platform android --source-maps` + `node scripts/license-audit.mjs` → 68개, 허용 목록 밖 0개
- `npm audit --omit=dev`: high 5건 모두 `@expo/cli`(빌드 도구)의 node-forge·zod — 앱 번들 미포함, `--force`(SDK 54로 내려감)는 하지 않음
- 웹 프리뷰에서 마이·처리방침·오픈소스 라이선스 화면 확인

**미검증**: 알림 수정 2건은 실기기 미확인(웹은 알림 미지원). 새 APK/AAB 빌드·설치 안 함.

**남은 일(계정 소유자)**: 지원 이메일, 처리방침 게시 URL, 휴대전화 스크린샷, 비공개 테스트(신규 개인 계정 요건), 상표 확인 → `docs/RELEASE_CHECKLIST.md` 1장.
