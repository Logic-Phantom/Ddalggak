# 출시 체크리스트 — Google Play 1.0.0

> 2026-10-26 점검. ✅ 완료·확인 · 🛠 이번에 수정 · ⬜ 남은 일(대부분 계정 소유자가 직접) · ⚠ 위험/주의
> 스토어 원고: [store/PLAY_STORE_LISTING.md](store/PLAY_STORE_LISTING.md) · 정책 답변: [store/PLAY_CONSOLE_FORMS.md](store/PLAY_CONSOLE_FORMS.md) · 처리방침: [store/PRIVACY_POLICY.md](store/PRIVACY_POLICY.md) · 비공개 테스트: [store/CLOSED_TEST_GUIDE.md](store/CLOSED_TEST_GUIDE.md)

## 1. 출시를 막는 항목 (제출 전 반드시)

| | 항목 | 내용 |
|---|---|---|
| ✅ | 앱 이름 | **KeepOn(킵온)** — 2026-10-26 "딸깍"에서 변경(같은 카테고리 동명 앱 충돌). 스토어 표시명 `KeepOn 킵온 - 링크·쿠폰·예약 정보함`, 기기 표시 이름 `KeepOn`. Play 조사 결과는 `BRAND_AND_TRADEMARKS.md` |
| ⬜ | 상표 검색 | KIPRIS 9류·42류 "KeepOn", "킵온", "Keep On" 직접 검색 (자동 조회 실패) |
| ✅ | 지원 이메일 | `dlacoaud96@gmail.com` — `app.json` `extra.supportEmail`, 마이 > 문의하기, 처리방침 9항 |
| ✅ | 처리방침 게시 | https://logic-phantom.github.io/Ddalggak/privacy-policy.html (`gh-pages` 브랜치, 원본 `store/site/`). `app.json` `extra.privacyPolicyUrl` 설정 → 앱 처리방침 화면에 "웹에서 전체 처리방침 보기" 표시 |
| ✅ | 휴대전화 스크린샷 | `store/screenshots/` 7장, 1080×2160 (웹 미리보기, 가상 데이터). 실기기 화면으로 바꾸면 더 정확 |
| ⬜ | 비공개 테스트 요건 | ⚠ 2023-11-13 이후 만든 **개인** 계정: 테스터 12명 이상 14일 연속 → `store/CLOSED_TEST_GUIDE.md` |
| ⬜ | 실기기 회귀 확인 | 이번 수정분(아래 3장) 포함 AAB/APK를 폰에 설치해 확인 |
| ✅ | 패키지명 | `app.ddalggak.mobile` 유지 결정 (2026-10-26). 앱 이름을 바꾸더라도 사용자에게는 보이지 않음 |

### 사이트 갱신 방법
`docs/store/site/`를 고친 뒤 `gh-pages` 브랜치에 같은 파일을 커밋·푸시한다. 처리방침을 바꿀 때는 `PRIVACY_POLICY.md` → `site/privacy-policy.html` → 앱 `src/app/privacy.tsx` 시행일을 함께 바꾼다.

## 2. 빌드·서명

| | 항목 | 상태 |
|---|---|---|
| ✅ | 패키지명 | `app.ddalggak.mobile` (유지 결정) — 첫 업로드 후 바꿀 수 없음 |
| 🛠 | 버전 | `1.0.0` (app.json·package.json). versionCode는 EAS 원격 관리(`appVersionSource: remote`, production `autoIncrement`) |
| ✅ | 타깃 SDK | 36 (Expo SDK 58 / RN 0.88 기본) |
| ✅ | 서명 | EAS 서버 보관 키스토어 = 업로드 키. Play App Signing 사용(신규 앱 기본) |
| ✅ | 출시 형식 | production 프로필은 AAB(기본) |
| 🛠 | 제출 트랙 | `eas.json` submit.production → `internal` 트랙, `draft` (게시 전 앱은 draft만 허용) |
| ✅ | 정적 검사 | `tsc` 통과 · `expo lint` 통과 · `jest` 127/127 · `expo-doctor` 20/20 (2026-10-26, macOS) |
| ✅ | 라이선스 감사 | 번들 포함 68개: MIT 65, ISC 1, MIT AND Apache-2.0 1, OFL-1.1(Pretendard) 1 — 모두 허용 목록 |

빌드·제출 명령
```bash
npx eas-cli@latest build --platform android --profile production
```
```bash
npx eas-cli@latest submit --platform android --profile production
```
첫 AAB는 Play Console에서 앱을 만든 뒤 **직접 업로드**해야 하는 경우가 있다(API 제출은 앱이 존재해야 함). 자동 제출은 Google Cloud 서비스 계정 키를 EAS에 등록해야 한다.

## 3. 이번 점검에서 고친 것

| | 문제 | 수정 |
|---|---|---|
| 🛠 | 앱이 꺼진 상태에서 알림을 누르면 해당 항목이 열리지 않음(리스너가 등록되기 전에 탭 이벤트가 지나감) | `onNotificationOpened`가 마지막 알림 응답을 한 번 읽고 지움 (`local-notifications.ts`) |
| 🛠 | 재설치·복원 후 다시 예약된 알림의 제목이 항목 제목 대신 "쿠폰 만료일" 같은 라벨로 표시 | 재예약 시 항목 제목 사용 (`reminder-repository.ts`, `reminder-service.ts`) |
| 🛠 | 안내 문구가 없어진 "기한 탭"을 가리킴 | "알림 탭"으로 수정 (오류 메시지·알림 시트) |
| 🛠 | 마이 화면 버전이 `0.1.0` 하드코딩 | app.json 버전을 읽음 (`src/utils/app-info.ts`) |
| 🛠 | 개인정보 화면이 "출시 전에 처리방침을 마련할 예정" 문구 | 앱 안 처리방침(시행일·항목·권한·문의)으로 교체, 웹 URL 설정 시 링크 표시. Play는 앱 안에도 처리방침을 요구함 |
| 🛠 | 오픈소스 고지 화면 없음 (MIT·OFL 고지 의무) | 마이 > 오픈소스 라이선스 추가. 목록은 `scripts/license-audit.mjs`가 번들 기준으로 `src/generated/oss-licenses.json` 생성 |
| 🛠 | 쓰지 않는 `WRITE_EXTERNAL_STORAGE` 권한 | `blockedPermissions`로 제거 (prebuild 매니페스트에서 `tools:node="remove"` 확인) |
| 🛠 | 광고 ID 권한이 라이브러리로 섞여 들어올 가능성 | `com.google.android.gms.permission.AD_ID` 차단 → 데이터 보안·광고 ID 설문 "아니요"와 일치 |
| 🛠 | 스플래시 배경이 앱 배경과 약간 달라 전환 시 번쩍임 | 현재 토큰(`#F5F8F7` / 다크 `#0E1311`)으로 맞춤 |
| 🛠 | 스토어 그래픽 없음 | `python scripts/build-app-icons.py --store` → `store/assets/` 512 아이콘·1024×500 그래픽 |
| 🛠 | 스크린샷·처리방침 페이지 없음 | `scripts/store-screenshots.mjs` → `store/screenshots/`, GitHub Pages 소개·처리방침 페이지 게시 |

## 4. 실기기 회귀 테스트 (새 빌드로)

| | 시나리오 | 기대 |
|---|---|---|
| ⬜ | 알림 예약 → 앱 강제 종료 → 알림 탭 | 앱이 열리고 해당 항목 상세로 이동 |
| ⬜ | 앱 실행 중 알림 탭 | 해당 항목 상세로 이동 (한 번만) |
| ⬜ | 마이 > 개인정보 처리방침 / 오픈소스 라이선스 | 내용 표시, 항목 펼치기 |
| ⬜ | 마이 하단 버전·이름 | `KeepOn 1.0.0`, 홈 화면·공유 메뉴에 `KeepOn` 표시 |
| ⬜ | 알림 권한 거부 후 알림 만들기 | "알림 탭에서 일정을 확인할 수 있어요" 문구 |
| ⬜ | 사진 선택 (Android 13+ / 12 이하) | 권한 팝업 없이 시스템 선택기 |
| ⬜ | 공유 수신: Chrome 링크, 카카오톡 텍스트, 갤러리 이미지, 파일 앱 PDF | `SHARE_RECEIVING_POC.md` 표 갱신 |
| ⬜ | 재부팅 후 예약 알림 유지 | 시간에 알림 도착 |
| ⬜ | 다크 모드·글자 크게·TalkBack 기본 흐름 | 잘림·읽기 순서 문제 없음 |

## 5. Play Console 작업 순서

1. 앱 만들기: 이름, 기본 언어 한국어, 앱, 무료, 선언 동의
2. 앱 콘텐츠: `PLAY_CONSOLE_FORMS.md` 순서대로 (처리방침 URL → 광고 → 앱 액세스 → 콘텐츠 등급 → 타겟층 → 데이터 보안 → 광고 ID → 정부/금융/건강/뉴스)
3. 스토어 등록정보: `PLAY_STORE_LISTING.md` 원고 + 그래픽 + 스크린샷
4. 국가/지역: 대한민국(필요 시 추가)
5. 테스트 > 내부 테스트에 AAB 업로드 → 본인 기기 설치 확인
6. 비공개 테스트 트랙 → 테스터 모집·14일 → 프로덕션 액세스 신청
7. 프로덕션 출시 → 검토(보통 수일)

## 6. 출시 후에도 남는 위험 (알고 출시)

| | 내용 |
|---|---|
| ⚠ | **OCR 없음**: 이미지 글자 인식 미지원. 설명에 명시함. |
| ⚠ | **DB·파일 암호화 없음**, 앱 잠금 없음 (처리방침 3항에 고지). |
| ⚠ | **정확한 알람 권한 없음**: Android 절전(Doze)에서 알림이 몇 분 늦을 수 있음. 정확한 시각이 꼭 필요하면 `SCHEDULE_EXACT_ALARM` + Play 선언이 필요(캘린더/알람 앱 외에는 거절 위험). |
| ⚠ | **앱 전환 화면 가림 미구현**: 최근 앱 목록 미리보기에 상세 화면이 보일 수 있음. |
| ⚠ | **iOS 미검증**: 이번 출시는 Android만. |
| ⚠ | 상표·동명 앱 확인 미완료 (`BRAND_AND_TRADEMARKS.md`). |
| ⚠ | `npm audit` high 5건 — 전부 빌드 도구 `@expo/cli` 안의 node-forge·zod(앱 번들에는 포함 안 됨, 라이선스 감사 목록에 없음). `npm audit fix --force`는 Expo SDK를 54로 내려 깨지므로 하지 않음. Expo SDK 58 패치가 나오면 `npx expo install --fix` 후 재확인. |
