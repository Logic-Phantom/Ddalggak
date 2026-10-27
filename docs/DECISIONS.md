# 결정 기록 (DECISIONS)

사소한 결정은 사용자 확인 없이 안전한 기본값을 고르고 여기에 남긴다. 형식: 결정 / 이유 / 대안 / 위험.

## D-001 · Expo SDK 58 + Expo Router + TypeScript strict (2026-10-24)
- **결정**: 동일 개발 환경에서 이미 검증된 CutPick 프로젝트와 같은 Expo SDK 58(`expo@58.0.19`, `react-native@0.88.0`, `react@19.3.0`) 계열을 사용. 신규 패키지는 `npx expo install`로 SDK 호환 버전을 받음(`expo-notifications@58.1.6`, `expo-document-picker@58.0.4`).
- **이유**: 같은 PC에서 빌드·실기기(Android) 검증 이력이 있는 조합이라 초기 위험이 낮음. `npx expo-doctor` 20/20 통과.
- **대안**: 더 최신 SDK — 출시 시점에 공식 문서로 재확인 후 업그레이드.
- **위험**: 이 문서 작성 시점에 Expo 공식 "최신 안정" 버전을 웹에서 재확인하지는 않았음 → 출시 전 확인 필요.

## D-002 · CutPick에서 가져온 것 (2026-10-24)
| 가져온 것 | 킵온에서의 변경 |
|---|---|
| eslint/metro/tsconfig/jest 설정, `AGENTS.md` | 경로 alias(`@/*`) 동일, jest testMatch에 share-intent·fixture 폴더 추가 |
| SQLite `PRAGMA user_version` 마이그레이션 패턴 | 마이그레이션을 **트랜잭션**으로 감싸 반쯤 적용되는 상태 방지 |
| 앱 전용 파일 저장소(`expo-file-system` 신규 `File`/`Directory` API) + `.web.ts` 대체 구현 | 공유/선택 파일을 항목별 폴더로 **복사**(임시 URI 수명 대응) |
| `AppError` + 민감정보 없는 `logError` | 킵온 오류 코드(공유·OCR·알림·가져오기) |
| 디자인 시스템 구조(AppText, Buttons, Feedback, Layout, FilterChip, Tag…) | "Calm Personal Inbox" 토큰으로 교체, TextField·ConfidenceBadge·StatusBadge 신규 |
| Pretendard 폰트(OFL 1.1) | 그대로 사용 (브랜드 전용 영문 폰트는 제외) |
| NativeTabs(+웹 JS 탭) 구조 | 인박스/검색/기한/설정 4탭 |
| `generate-oss-licenses.mjs`, `android-device.ps1` | `scripts/license-audit.mjs`, 기기 QA 스크립트로 이름·출력 경로 변경 |
- **가져오지 않은 것**: Supabase/커뮤니티/로그인(킵온 MVP는 서버 없음), 이미지 분석·추천 엔진, EAS projectId/owner(CutPick 계정 값이므로 복사 금지).

## D-003 · 공유 수신은 `expo-sharing`의 실험적 incoming share 사용 (2026-10-24)
- **결정**: `expo-sharing@58.0.20` config plugin(`ios.enabled`, `android.enabled`) + `useIncomingShare()`의 **raw payload**만 사용. `+native-intent.ts`에서 `ddalggak://expo-sharing` → `/capture?source=share`로 라우팅.
- **이유**: 별도 네이티브 코드 없이 Android intent filter와 iOS Share Extension 타깃을 CNG로 생성 가능.
- **resolved payload를 쓰지 않는 이유**: 문서상 URL 해석에 네트워크가 필요할 수 있음 → "웹페이지 자동 조회 금지" 원칙 위배.
- **위험**: API가 `@experimental`. iOS는 App Group(`group.app.KeepOn.mobile`, D-022) 등록·서명이 필요하고 실기기 미검증. → `SHARE_RECEIVING_POC.md`.

## D-004 · OCR 엔진은 POC 전까지 "사용 불가" provider로 출시 (2026-10-24)
- **결정**: `OcrProvider` 계약 + `unavailableOcrProvider`(가짜 텍스트를 만들지 않음). 이미지 캡처 시 "이 버전에서는 아직 OCR을 지원하지 않아요" 안내 후 수동 입력.
- **이유**: iOS Vision / Android ML Kit(한국어) 연결은 네이티브 모듈 선택·라이선스·앱 용량 검증이 먼저. 검증 없이 서드파티 네이티브 패키지를 추가하지 않음.
- **다음 단계**: `OCR_AND_EXTRACTION.md`의 POC 계획 수행 후 `setOcrProvider()`로 교체.

## D-005 · 첨부 파일 기본 보관 = 켜짐 (2026-10-24)
- **결정**: `retainAttachments` 기본 `true`, 설정에서 끌 수 있음.
- **이유**: OCR이 아직 없으므로 이미지 원본이 항목의 유일한 내용인 경우가 많음. 끄면 원본은 OCR용 임시 복사 후 삭제.
- **재검토**: OCR이 실제 동작하게 되면 기본값을 "끔"으로 바꿀지 사용자 테스트로 결정.

## D-006 · 삭제는 상태가 아니라 하드 삭제 (2026-10-24)
- **결정**: 상태는 `draft / active / completed / archived`. 삭제는 확인 대화상자 후 DB 행(CASCADE) + 복사 파일 + 예약 알림을 함께 제거.
- **이유**: "삭제한 민감 정보가 남아 있음"을 피하기 위해. 실수 방지는 확인 UI와 보관(archive)으로 대응.

## D-007 · 날짜/금액 표현 (2026-10-24)
- 날짜는 오프셋 없는 로컬 벽시계 문자열: 날짜만 `YYYY-MM-DD`, 시각 포함 `YYYY-MM-DDTHH:mm`. 해석은 기기 타임존. 알림 행에는 `timezoneId`를 함께 저장.
- 금액은 `"<최소단위 정수> <통화>"`(예: `15000 KRW`, `1099 USD`) — 부동소수점 금지.

## D-008 · 알림 정책 (2026-10-24)
- 사용자가 확인한 날짜(또는 직접 입력한 날짜)로만 생성. 과거 시각, 잘못된 날짜, 활성 알림 60개 초과(iOS 대기 알림 64개 제한 여유분) 거부.
- 권한은 첫 알림 생성 시점에만 요청. 거부돼도 알림 행은 저장되고 기한 탭에 표시.
- 알림 본문에는 제목과 날짜 의미만 — 금액·코드·원문 없음. 제목 자동 제안 시 코드/전화번호는 마스킹.
- 항목 보관/완료 시 OS 알림 취소 + 행 비활성화. 되돌려도 자동 재예약하지 않음(사용자가 다시 만듦).

## D-009 · 검색은 LIKE 기반 (2026-10-24)
- **결정**: 제목·메모·공유 원문·OCR 원문·URL·태그·추출 값에 대해 파라미터 바인딩된 `LIKE ... ESCAPE` 검색, 최대 5개 단어 AND.
- **대안**: SQLite FTS5 — 한국어 토크나이저(형태소/ngram) 결정이 필요해 Phase 5로 미룸.

## D-010 · 내보내기 형식 v1 (2026-10-24)
- `ddalggak-export` JSON, `schemaVersion: 1`, `attachmentsIncluded: false`. 가져오기는 단일 트랜잭션, 기존 id는 건너뜀, 알림은 비활성 상태로 복원.

## D-011 · 저장소 라이선스 미지정 (2026-10-24)
- 저장소 LICENSE 파일은 소유자가 정할 사항이라 임의로 추가하지 않음. 공개 저장소에 LICENSE가 없으면 기본적으로 "모든 권리 보유"로 해석됨.

## D-013 · expo-notifications 지연 로딩 (2026-10-24)
- **문제**: 폰의 Expo Go(58.0.5, Android)에서 `expo-notifications`를 import하는 순간 `Cannot find native module 'ExpoTopicSubscriptionModule'`로 앱 전체가 시작되지 않음. 58.0.11로 내려도 같은 모듈이 포함돼 있어 버전 문제가 아님 → 버전은 `~58.1.6` 유지.
- **결정**: `local-notifications.ts`에서 Expo Go(`ExecutionEnvironment.StoreClient`)일 때는 불러오지 않고, 그 외에는 `require`를 try/catch로 감싸 지연 로딩. 실패 시 권한 상태를 `unavailable`로 보고하고 알림은 앱 안(기한 탭)에서만 표시.
- **영향**: Expo Go에서는 기기 알림 없음(안내 문구 표시). 설치형 APK/development build에서는 정상 경로.

## D-014 · 테스트용 APK는 로컬 Gradle release 빌드 (2026-10-24)
- `npx expo prebuild --platform android --clean` 후 `android/gradlew assembleRelease` (JDK 17 지정). Expo 템플릿 기본값대로 **디버그 키로 서명** — 사내 테스트용이며 스토어 배포용이 아님. 스토어용은 업로드 키 생성 후 EAS/서명 설정 필요.
- 이 PC의 `JAVA_HOME`이 JDK 1.8을 가리키므로 빌드 시 `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`을 지정해야 함.

## D-012 · 웹 타깃은 UI 확인용 (2026-10-24)
- `expo start --web`은 레이아웃·흐름 점검용. 공유 수신/알림/파일 복사는 웹에서 동작하지 않음(`.web.ts` 대체 구현). 출시 대상 아님.

## D-015 · 출시 정보는 app.json `extra`에서 읽음 (2026-10-26)
- **결정**: 앱 버전은 `expo.version`, 지원 이메일·처리방침 URL은 `expo.extra.supportEmail` / `expo.extra.privacyPolicyUrl`에서 `src/utils/app-info.ts`로 읽는다. 값이 비어 있으면 해당 링크를 숨긴다.
- **이유**: `.env.local`은 EAS 빌드에 업로드되지 않아 `EXPO_PUBLIC_*`로는 출시 빌드에 값이 빠질 수 있음. 버전 하드코딩(0.1.0)도 함께 제거.

## D-016 · 앱 안 처리방침 + 오픈소스 고지 화면 (2026-10-26)
- **결정**: `privacy.tsx`를 "출시 전 안내"에서 실제 처리방침(시행일·처리 항목·권한·문의)으로 바꾸고, 같은 내용을 `docs/store/PRIVACY_POLICY.md`(웹 게시용)에 둔다. `licenses.tsx`는 `scripts/license-audit.mjs`가 번들 소스맵 기준으로 만든 `src/generated/oss-licenses.json`을 표시한다(Pretendard OFL 포함).
- **이유**: Google Play 사용자 데이터 정책은 Console과 앱 안 양쪽에 처리방침을 요구한다. MIT·OFL은 저작권 표시·라이선스 동봉을 요구한다.
- **유지**: 의존성을 바꾸면 `npx expo export --platform android --source-maps --output-dir <dir>` → `node scripts/license-audit.mjs <map>`으로 JSON을 다시 만든다.

## D-017 · 권한 추가 차단: WRITE_EXTERNAL_STORAGE, AD_ID (2026-10-26)
- **결정**: `android.blockedPermissions`에 `WRITE_EXTERNAL_STORAGE`, `com.google.android.gms.permission.AD_ID` 추가. 정확한 알람 권한(`SCHEDULE_EXACT_ALARM`)은 쓰지 않는다.
- **이유**: 앱이 외부 저장소에 쓰지 않고 광고 ID를 쓰지 않으므로 데이터 보안·광고 ID 설문 답("아니요")과 매니페스트를 일치시킨다. 정확한 알람은 Play 선언 대상이고 기한 알림(하루 전 등)에는 몇 분 오차가 허용된다.
- **위험**: Doze 상태에서 알림이 몇 분 늦을 수 있음 → 알림 시트에 이미 안내 문구 있음.

## D-018 · `allowBackup` 기본값(true) 유지 (2026-10-26)
- **결정**: Android 자동 백업을 끄지 않는다.
- **이유**: 서버·동기화가 없어 기기 교체 시 사용자가 데이터를 되살릴 유일한 자동 경로. 복원 후 알림은 `reconcileNotifications`가 다시 예약한다.
- **위험**: 암호화되지 않은 DB가 사용자 Google 계정 백업에 포함될 수 있음 → 처리방침 3항에 고지. 민감도 우려가 커지면 `android.allowBackup: false` 또는 백업 제외 규칙을 검토.

## D-019 · 앱 이름 "딸깍" → KeepOn(킵온) (2026-10-26)
- **결정**: 사용자에게 보이는 이름을 KeepOn으로 바꾼다(`app.json` `name`, `BRAND_NAME`, 안내 문구, 스토어·처리방침·사이트). 스토어 표시명은 `KeepOn 킵온 - 링크·쿠폰·예약 정보함`, 기기 표시 이름은 `KeepOn`.
- **이유**: Google Play 생산성 카테고리에 같은 개념의 「딸깍 - 링크, 스크린샷, 메모 한 곳에 저장」(1만+)이 있어 혼동·상표 위험이 큼. "킵온"은 일치 앱 없음, "KeepOn"은 다른 분야 앱 1개.
- **바꾸지 않은 것**: 패키지 `app.ddalggak.mobile`, 스킴 `ddalggak`, EAS slug/projectId, DB·파일 폴더·내보내기 형식 이름, 로그 접두사, 저장소·Pages 주소. 사용자에게 보이지 않고, 바꾸면 설치본·데이터·EAS 연결이 끊긴다.
- **안내 문구**: 공유 메뉴에는 기기 표시 이름이 뜨므로 "‘KeepOn’을 고르세요"로 맞춘다.

## D-020 · 표시 이름은 한글 "킵온", 저장소 이름은 KeepOn (2026-10-26)
- **결정**: 기기 표시 이름·앱 안 문구·스토어 원고에서 이름을 "킵온"으로 쓰고, 영문 KeepOn은 보조 표기(스토어 표시명 `킵온(KeepOn) - 링크·쿠폰·예약 정보함`, 피처 그래픽, 영문 처리방침 요약)로만 쓴다. GitHub 저장소는 `Logic-Phantom/KeepOn`.
- **이유**: 소유자 요청. 국내 사용자가 홈 화면·공유 메뉴에서 바로 읽을 수 있음. 스토어 표시명에 영문을 함께 넣어 두 검색어 모두 걸리게 함.
- **영향**: GitHub Pages 주소가 `https://logic-phantom.github.io/KeepOn/`으로 바뀜(프로젝트 Pages는 저장소 이름 변경 시 옛 주소로 자동 이동하지 않음) → `app.json` `extra.privacyPolicyUrl`과 문서의 주소를 바꿈. 패키지·스킴·DB 이름은 D-019대로 유지.

## D-021 · 2026-10-26 시안 스타일로 디자인 개편 (2026-10-26)
- **결정**: 사용자 제공 시안(피처 그래픽 + 홈·추가·확인·상세·알림·마이)에 맞춰 토큰(틸그린 `#1F5B4F`, 민트 배경, 브랜드 민트), 둥근 사각형 카테고리 타일, pill 탭, 카드 행 구조, 아이콘 색(그라데이션 `#296C5A→#074E3F` + 민트 글리프)을 바꾼다. 피처 그래픽은 HTML 렌더링(`scripts/store-feature-graphic.mjs`)으로 만든다.
- **지킨 것**: 앱에 없는 기능(태그 관리, 보낸 알림 기록, 알림 스위치, 목록의 금액)은 화면에 만들지 않음 — `DESIGN_SYSTEM.md` "시안과 다른 점". 확인 전 값으로 알림을 만들지 않는 규칙, 민감 번호 가림은 그대로.
- **추가 동작**: 상세의 민감 번호에 "복사" 버튼(누를 때만 클립보드에 씀). 확인한 값은 체크 아이콘을 눌러 확인 취소.
- **위험**: 웹 미리보기로만 확인함 — Android 실기기에서 그림자·아이콘·다크 모드 확인 필요.

## D-022 · 패키지/번들 ID `app.ddalggak.mobile` → `app.KeepOn.mobile` (2026-10-27)
- **결정**: 첫 Play 업로드 전에 Android 패키지와 iOS 번들 ID(공유 확장 `app.KeepOn.mobile.expo-sharing-extension`, App Group `group.app.KeepOn.mobile` 포함)를 `app.KeepOn.mobile`로 바꾼다. D-019의 "패키지 유지"를 뒤집는다.
- **이유**: 소유자 요청 — 이름이 킵온으로 바뀌었으므로 식별자도 맞춤. Play에 아직 앱이 없어 지금이 바꿀 수 있는 마지막 시점(첫 업로드 후 변경 불가). Play Console "사용 가능한 패키지 이름" 확인(2026-10-27).
- **영향**: EAS가 새 패키지용 업로드 키스토어를 새로 만들었다(옛 `app.ddalggak.mobile` 키는 사용 안 함). 옛 패키지로 설치한 개발·미리보기 빌드는 다른 앱으로 취급되어 데이터가 이어지지 않음(출시 전이라 사용자 없음). 대문자가 섞인 패키지는 Android에서 허용되지만 관례(소문자)와 다르다 — 소유자 선택.
- **바꾸지 않은 것**: 스킴 `ddalggak`, EAS slug/projectId, DB·내보내기 형식 이름(사용자에게 보이지 않음).
