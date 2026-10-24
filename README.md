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
src/app/             화면 (인박스·검색·기한·설정 탭, capture, item, category, archive, privacy)
src/components/      InboxItemRow, ItemEditor, ExtractedFieldRow, ReminderSheet
src/design-system/   토큰과 공용 컴포넌트
src/domain/          모델·분류 라벨·오류
src/features/        incoming-share, capture, ocr, extraction, items, reminders, search, export-import, preferences
src/infrastructure/  SQLite, 파일 저장소, 로컬 알림 (+ 웹 대체 구현)
tests/               unit, share-intent, extraction-fixtures(가상 텍스트)
scripts/             앱 아이콘 생성, 라이선스 감사, Android 기기 QA
docs/                아키텍처·결정·POC·개인정보·위협 모델·라이선스·비용·테스트·로드맵
```

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

**변경 파일**: `src/infrastructure/notifications/local-notifications.ts`(+`.web.ts`), `src/components/items/ReminderSheet.tsx`, `src/app/(tabs)/reminders.tsx`, `src/app/item/[id].tsx`, `docs/DECISIONS.md`, `docs/TESTING.md`, `README.md`

**실행한 명령과 결과**
- `npx jest` — 124 통과 / 0 실패, `npx tsc --noEmit` — 통과, `npx expo lint` — 통과
- 실기기 기능 테스트(공유 수신·사진/파일 선택·알림): **미실행** — 사용자가 APK로 직접 확인 예정
