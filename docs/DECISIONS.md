# 결정 기록 (DECISIONS)

사소한 결정은 사용자 확인 없이 안전한 기본값을 고르고 여기에 남긴다. 형식: 결정 / 이유 / 대안 / 위험.

## D-001 · Expo SDK 58 + Expo Router + TypeScript strict (2026-10-24)
- **결정**: 동일 개발 환경에서 이미 검증된 CutPick 프로젝트와 같은 Expo SDK 58(`expo@58.0.19`, `react-native@0.88.0`, `react@19.3.0`) 계열을 사용. 신규 패키지는 `npx expo install`로 SDK 호환 버전을 받음(`expo-notifications@58.1.6`, `expo-document-picker@58.0.4`).
- **이유**: 같은 PC에서 빌드·실기기(Android) 검증 이력이 있는 조합이라 초기 위험이 낮음. `npx expo-doctor` 20/20 통과.
- **대안**: 더 최신 SDK — 출시 시점에 공식 문서로 재확인 후 업그레이드.
- **위험**: 이 문서 작성 시점에 Expo 공식 "최신 안정" 버전을 웹에서 재확인하지는 않았음 → 출시 전 확인 필요.

## D-002 · CutPick에서 가져온 것 (2026-10-24)
| 가져온 것 | 딸깍에서의 변경 |
|---|---|
| eslint/metro/tsconfig/jest 설정, `AGENTS.md` | 경로 alias(`@/*`) 동일, jest testMatch에 share-intent·fixture 폴더 추가 |
| SQLite `PRAGMA user_version` 마이그레이션 패턴 | 마이그레이션을 **트랜잭션**으로 감싸 반쯤 적용되는 상태 방지 |
| 앱 전용 파일 저장소(`expo-file-system` 신규 `File`/`Directory` API) + `.web.ts` 대체 구현 | 공유/선택 파일을 항목별 폴더로 **복사**(임시 URI 수명 대응) |
| `AppError` + 민감정보 없는 `logError` | 딸깍 오류 코드(공유·OCR·알림·가져오기) |
| 디자인 시스템 구조(AppText, Buttons, Feedback, Layout, FilterChip, Tag…) | "Calm Personal Inbox" 토큰으로 교체, TextField·ConfidenceBadge·StatusBadge 신규 |
| Pretendard 폰트(OFL 1.1) | 그대로 사용 (브랜드 전용 영문 폰트는 제외) |
| NativeTabs(+웹 JS 탭) 구조 | 인박스/검색/기한/설정 4탭 |
| `generate-oss-licenses.mjs`, `android-device.ps1` | `scripts/license-audit.mjs`, 기기 QA 스크립트로 이름·출력 경로 변경 |
- **가져오지 않은 것**: Supabase/커뮤니티/로그인(딸깍 MVP는 서버 없음), 이미지 분석·추천 엔진, EAS projectId/owner(CutPick 계정 값이므로 복사 금지).

## D-003 · 공유 수신은 `expo-sharing`의 실험적 incoming share 사용 (2026-10-24)
- **결정**: `expo-sharing@58.0.20` config plugin(`ios.enabled`, `android.enabled`) + `useIncomingShare()`의 **raw payload**만 사용. `+native-intent.ts`에서 `ddalggak://expo-sharing` → `/capture?source=share`로 라우팅.
- **이유**: 별도 네이티브 코드 없이 Android intent filter와 iOS Share Extension 타깃을 CNG로 생성 가능.
- **resolved payload를 쓰지 않는 이유**: 문서상 URL 해석에 네트워크가 필요할 수 있음 → "웹페이지 자동 조회 금지" 원칙 위배.
- **위험**: API가 `@experimental`. iOS는 App Group(`group.app.ddalggak.mobile`) 등록·서명이 필요하고 실기기 미검증. → `SHARE_RECEIVING_POC.md`.

## D-004 · OCR 엔진은 POC 전까지 "사용 불가" provider로 출시 (2026-10-24) — Android는 D-015로 대체
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

## D-010 · 내보내기 형식 v1 (2026-10-24) — v2로 확장(D-018)
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

## D-015 · OCR = Android ML Kit 한국어 번들 모델, 로컬 Expo 모듈 (2026-10-25)
- **결정**: `modules/ddalggak-ocr`(Expo Modules API, Kotlin, Android 전용)에서 `com.google.mlkit:text-recognition-korean:16.0.1`(번들 모델, 라틴 문자도 인식)을 호출. 이미지는 2의 거듭제곱 샘플링으로 긴 변 3072px 이하 디코딩 + EXIF 회전 반영. PDF는 Android 내장 `PdfRenderer`로 앞 3쪽을 렌더링해 같은 엔진으로 인식(추가 라이브러리 없음, 텍스트 PDF·스캔 PDF 모두 같은 경로). JS는 `OcrProvider` 계약(`mlkit-provider.ts`)으로만 사용하고, 모듈이 없는 빌드(iOS·웹·Expo Go·이전 APK)에서는 `unavailable`.
- **이유**: Google 문서(2026-10-21 갱신본 확인) 기준 번들 모델은 첫 실행부터 오프라인 동작, 크기 증가 "약 4MB/스크립트/아키텍처". Play 서비스(비번들) 방식은 첫 사용 전 모델 다운로드가 필요해 로컬 우선 원칙과 맞지 않음. 서드파티 RN 패키지는 RN 0.88(New Architecture) 호환을 확인할 수 없어 쓰지 않음. minSdk 요구(23)는 Expo 기본 24로 충족.
- **위험·미확인**: ① Kotlin 코드는 이 PC에서 **컴파일하지 못함**(EAS/development build 필요). ② ML Kit는 진단 정보를 Google에 보낼 수 있음(PRIVACY.md) → 설정에서 끌 수 있게 함, 기본값(켜짐)은 소유자 확인 필요. ③ 정확도 실측 없음. ④ iOS(Vision)는 빌드·검증 수단이 없어 구현하지 않음 — iOS 빌드를 깨뜨릴 수 있는 미검증 Swift 코드를 넣지 않기 위해 `expo-module.config.json`의 platforms를 android로 제한.
- **대안**: Tesseract(kor.traineddata) — RN 연결·용량·정확도 부담. iOS Vision — iOS 빌드 환경 확보 후.

## D-016 · 임시 저장은 새 상태 `pending` (2026-10-25)
- **결정**: `ItemStatus`에 `pending`(라벨 "임시 저장") 추가. 전이: `draft → pending`, `pending → active`. `pending`은 알림을 가질 수 없음(`checkReminder`의 `itemActive`). 저장 흐름: 파일 복사·헤더 검증 → (원본을 보관하면 OCR 생략, 보관하지 않으면 지금 OCR) → 규칙 추출(후보만) → `pending` 삽입. 같은 내용을 저장 중일 때의 두 번째 요청은 거절(지문 기반 in-flight 잠금 + 버튼 `useRef` 잠금). DB 삽입 실패 시 복사한 폴더 삭제.
- **이유**: 기존 `draft`는 "검토 화면이 열린 상태"이고 하루 지나면 자동 삭제되므로 재사용하면 데이터 손실. `needs_review`는 "저장했지만 미확인 값이 있음"이라 의미가 다름. `status`는 CHECK 제약 없는 TEXT라 스키마 변경 불필요.
- **위험**: 이 버전 이후의 백업(`pending` 포함)을 이전 버전 앱이 가져오면 상태 검증에서 거부됨(백업 v2라 어차피 이전 앱은 거부).

## D-017 · 알림을 날짜 필드에 연결 (마이그레이션 v2, 2026-10-25)
- **결정**: `reminders`에 `source_field_id`, `target_date`, `days_before` 추가(기존 행은 NULL). 날짜 수정·확인 해제는 `item-service.editField`를 거쳐 `syncRemindersForField`가 처리: 바뀐 날짜로 취소 후 재예약, 확인 해제·과거·잘못된 날짜면 끔. 날짜를 "다음 날" 등으로 임의 보정하지 않음. 값 삭제 시 알림은 남기고 연결만 해제(사용자가 만든 알림이므로).
- **상태 표시**: DB 행(사용자 의도)과 OS 예약 상태를 구분해 `deliveryState`로 표시 — 예약됨 / 기기 예약 확인 안 됨 / 권한 꺼짐 / 실행 환경 미지원 / 예약 실패 / 꺼짐 / 지남. 권한 허용 후 OS 예약이 실패하면 "예약 실패"로 표시하고 "다시 예약" 제공.
- **복원**: 보관·완료 → 진행 중으로 되돌려도 자동 재예약하지 않음(D-008 유지). 대신 알림별 "다시 켜기"가 활성 항목·확인된 날짜·미래 시각·60개 한도를 다시 검사한 뒤 예약.
- **재조정**: 앱 시작과 알림 탭 진입 시 `reconcileNotifications` — 비활성 항목의 알림 끔, 사라진 OS 예약 재등록, 행 없는 OS 예약 취소. 멱등.
- **시간대**: 저장값은 오프셋 없는 로컬 벽시계(D-007). 예약은 예약 시점 기기 시간대 기준의 절대 시각이라, 기기 시간대가 바뀌어도 기존 예약은 원래 시간대 기준 그 순간에 울린다. 재조정으로 다시 예약되는 경우에만 현재 시간대로 해석된다(실기기 미검증).

## D-018 · 백업 v2: 첨부를 JSON에 base64로 포함 (2026-10-25)
- **결정**: `schemaVersion: 2`. "첨부 없이"(데이터만)와 "첨부 포함"(파일별 base64 + SHA-256 + 크기, 총 30MB 예산, 파일당 25MB) 중 선택. 예산을 넘거나 파일이 없으면 `data: null` + `excludedReason`으로 목록에 남겨 복원 시 "백업에 없음"을 알림. v1 파일 가져오기 계속 지원.
- **가져오기**: 전체 검증(경로 안전 id, MIME 허용 목록, base64 형식·디코딩 크기) → 새 항목의 첨부 파일 쓰기 → SHA-256·헤더 MIME 재검증 → 단일 트랜잭션. 어느 단계든 실패하면 이번에 쓴 폴더를 지우고 아무것도 반영하지 않음. 이미 있는 항목 id는 건너뜀(덮어쓰기·병합 없음). 필드·알림·첨부 id는 새로 발급(기본키 충돌 방지), 알림→필드 연결은 새 id로 이어 줌. 알림은 꺼진 채 복원.
- **이유**: zip은 추가 네이티브/JS 라이브러리가 필요하고 앱 용량·호환성 검토가 필요. 단일 JSON은 기존 형식·검증 코드를 그대로 확장 가능. 가져오기는 JSON 전체를 메모리에 올리므로 예산을 30MB(파일 최대 48MB)로 제한.
- **후속**: 큰 백업용 스트리밍 형식(JSONL 또는 zip), 백업 암호화(비밀번호 기반).

## D-019 · OCR 설정 `ocrEnabled` (2026-10-25)
- 설정 > 저장 방식 > "이미지·PDF 글자 인식". 끄면 캡처·재분석 모두 OCR을 호출하지 않고 "설정에서 꺼 두었어요" 안내. 기본값 켜짐(D-015 위험 ② 참고).

## D-012 · 웹 타깃은 UI 확인용 (2026-10-24)
- `expo start --web`은 레이아웃·흐름 점검용. 공유 수신/알림/파일 복사는 웹에서 동작하지 않음(`.web.ts` 대체 구현). 출시 대상 아님.
