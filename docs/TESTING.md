# 테스트 기록

## 명령
```bash
npm test               # jest (unit + share-intent + extraction-fixtures)
npm run typecheck      # tsc --noEmit
npm run lint           # expo lint
npx expo-doctor
```

## 2026-10-24 실행 결과 (Windows 11, Node 24.20.0, npm 11.19.0)
| 항목 | 결과 |
|---|---|
| `npx jest` | **124 통과 / 0 실패** (6 suites: date-parser, money-and-codes, url-and-category, policies, share-payload-normalizer, extraction-fixtures) |
| `npx tsc --noEmit` | 통과 |
| `npx expo lint` | 통과 (경고 0) |
| `npx expo-doctor` | 20/20 통과 |
| 웹 프리뷰 수동 확인 | 인박스(빈 상태·첫 실행 안내) → 직접 추가 → 정리하기 → 검토(분류 후보·확인 필요 표시) → 저장 → 상세(쿠폰 코드 마스킹) → 알림 만들기(웹: 권한 없음 경로, 앱 내 저장) → 기한 탭 표시까지 동작 확인 |

웹 확인 중 발견·수정한 버그
1. "모바일 **교환권** … 유효기간 2026.12.31"이 반품 마감으로 분류 → 날짜에 가장 가까운 라벨 우선 + "교환권" 제외 (회귀 테스트 추가).
2. 첫 줄로 만든 제목에 쿠폰 코드가 그대로 들어가 알림/목록에 노출 → 제목 제안 시 민감 코드 마스킹 (테스트 추가).

## 미실행 / 미검증
- **Android/iOS 실기기·에뮬레이터 실행 안 함**: 공유 수신, 파일 복사(`content://`), 로컬 알림 예약/전달, SQLite 네이티브 동작, 다크 모드·큰 글자·TalkBack/VoiceOver 모두 미검증.
- iOS 빌드 환경 없음(Windows) → iOS는 전부 미검증.
- OCR: 엔진 미연결 → OCR 정확도 측정 없음.
- E2E(Detox 등) 미구성.
- 통합 테스트(SQLite 리포지토리)는 jest 환경에서 expo-sqlite 네이티브가 없어 미작성 — development build 위 계측 테스트 또는 SQLite 대체 드라이버 도입 필요.

## 2026-10-24 실기기 연결 (Galaxy Z Flip5, SM-F731N)
| 항목 | 결과 |
|---|---|
| adb 연결 | 정상 |
| prebuild 매니페스트 | 공유 intent filter(SEND/SEND_MULTIPLE) 생성 확인 |
| Expo Go 58.0.5 실행 | **실패** — `ExpoTopicSubscriptionModule` 없음 → 알림 모듈 지연 로딩으로 수정(D-013), 수정 후 재확인은 미실행 |
| 테스트용 release APK | Gradle 빌드 (결과는 README Work Log 참고) |
| 공유 수신·선택기·알림 실동작 | 미검증 (사용자가 APK로 확인 예정) |

## 스크린샷
- `docs/screenshots/01-web-inbox-empty-light.jpg` (웹, 375×812 에뮬레이션, 라이트)
- 나머지 화면은 웹 프리뷰 창이 가려져 캡처가 실패해 저장하지 못함(위 흐름은 확인함).
