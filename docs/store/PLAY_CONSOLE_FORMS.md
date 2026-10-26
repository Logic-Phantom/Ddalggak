# Play Console 앱 콘텐츠(정책) 답변

> Play Console > 정책 > 앱 콘텐츠의 각 설문에 넣을 답. 근거는 이 저장소의 실제 동작(코드·매니페스트)이다.
> 앱 동작이 바뀌면(백업·동기화·분석·광고·OCR 원격 처리 등) 이 문서와 데이터 보안 답변을 먼저 고친다.
> 2026-10-26 기준. Play Console 문항 문구는 수시로 바뀌므로 제출 화면의 최신 문항을 기준으로 맞춘다.

## 요약

| 설문 | 답 |
|---|---|
| 개인정보처리방침 | `PRIVACY_POLICY.md`를 게시한 공개 URL (앱 안: 마이 > 개인정보 처리방침) |
| 광고 | 광고 없음 |
| 앱 액세스 권한 | 모든 기능을 별도 액세스 권한 없이 사용 가능 (로그인 없음) |
| 콘텐츠 등급 | IARC 설문 → 예상 등급: 전체이용가 / Everyone / PEGI 3 |
| 타겟층 및 콘텐츠 | 만 18세 이상 (아동 대상 아님) |
| 데이터 보안 | 데이터 수집 없음 · 공유 없음 |
| 광고 ID | 사용 안 함 |
| 정부 앱 | 아니요 |
| 금융 기능 | 제공하지 않음 |
| 건강 | 건강 기능 없음 |
| 뉴스 앱 | 아니요 |
| 권한 선언(민감 권한) | 해당 권한 없음 → 선언 불필요 |

## 데이터 보안 (Data safety)

Google 정의상 "수집"은 데이터를 **기기 밖으로 전송**하는 것이다. 딸깍은 기기 안에서만 처리하므로 수집·공유가 없다.

| 문항 | 답 | 근거 |
|---|---|---|
| 앱에서 필수 사용자 데이터 유형을 수집하거나 공유하나요? | **아니요** | 서버·로그인·분석·광고·크래시 리포트 SDK 없음. `fetch`/네트워크 호출 없음. 링크는 사용자가 누를 때만 OS 브라우저로 넘김 |
| (위가 "아니요"이면 이후 문항 생략) | | |

확인 포인트
- 내보내기(JSON)는 사용자가 OS 공유 시트에서 목적지를 직접 고르는 동작이라 개발자 수집·공유가 아니다.
- Android 자동 백업(`allowBackup=true`)은 사용자의 Google 계정 백업이며 개발자가 받는 데이터가 아니다. 처리방침 3항에 고지함.
- `INTERNET` 권한은 React Native 기본으로 남아 있지만 앱 기능은 네트워크를 쓰지 않는다.
- 라이브러리 중 `expo-notifications`가 Android에서 Firebase Messaging을 포함하지만, `google-services.json`이 없어 Firebase가 초기화되지 않고 푸시 토큰도 만들지 않는다(로컬 알림만 사용).

## 광고 ID

- "앱에서 광고 ID를 사용하나요?" → **아니요**.
- `com.google.android.gms.permission.AD_ID`는 `app.json`의 `blockedPermissions`로 제거해 둠. 빌드 후 확인:
  `aapt2 dump permissions app.apk` 또는 Play Console > 앱 번들 탐색기 > 권한.

## 앱 액세스 권한

"모든 기능을 특별한 액세스 권한 없이 사용할 수 있음" 선택. 심사자용 계정 불필요.

## 콘텐츠 등급 (IARC)

- 카테고리: **유틸리티, 생산성, 커뮤니케이션 또는 기타**
- 폭력·성적 콘텐츠·욕설·약물·도박·공포: 모두 아니요
- 사용자 간 상호작용/콘텐츠 공유(채팅·게시판): **아니요** (다른 사용자와 연결되지 않음)
- 사용자 위치 공유: 아니요
- 디지털 상품 구매: 아니요
- 웹 브라우저/검색 엔진 기능: 아니요 (링크를 OS 브라우저로 넘길 뿐)

## 타겟층 및 콘텐츠

- 대상 연령: **18세 이상**만 선택 (13~17 포함도 가능하지만, 13세 미만을 고르면 가족 정책 적용 대상이 됨 → 고르지 않음)
- 아동의 관심을 끄는 앱인가요?: 아니요

## 권한 (빌드 매니페스트 기준, 2026-10-26 prebuild로 확인)

| 권한 | 출처 | 용도 | Play 선언 |
|---|---|---|---|
| POST_NOTIFICATIONS | expo-notifications | 기한 로컬 알림 (첫 알림 만들 때만 요청) | 불필요 |
| RECEIVE_BOOT_COMPLETED | expo-notifications | 재부팅 후 예약 알림 복원 | 불필요 |
| VIBRATE | expo-haptics | 버튼 햅틱 | 불필요 |
| INTERNET | React Native/expo-image | 앱 기능은 사용 안 함 | 불필요 |
| READ_EXTERNAL_STORAGE (maxSdk 32) | expo-file-system·image-picker | Android 12 이하 선택기 호환 | 불필요 |
| ~~WRITE_EXTERNAL_STORAGE~~ | | `blockedPermissions`로 제거 | |
| ~~READ_MEDIA_IMAGES/VIDEO~~ | | 제거 — 시스템 사진 선택기 사용 → **사진·동영상 권한 선언 불필요** | |
| ~~CAMERA, RECORD_AUDIO, 위치, 연락처, SYSTEM_ALERT_WINDOW~~ | | 제거 | |
| SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM | 없음 | 정확한 알람 권한을 쓰지 않음 → 알림이 몇 분 늦을 수 있음 | 불필요 |
| 포그라운드 서비스 | 없음 | | 불필요 |

## 기타 정책 확인

- 타깃 API: **36** (RN 0.88 / Expo SDK 58 기본값). Play 신규 앱 요건(현재 35 이상) 충족 — 제출 시점 요건은 Console 경고로 재확인.
- 16KB 메모리 페이지 크기: RN 0.77+ 네이티브 라이브러리는 16KB 정렬로 빌드됨. AAB 업로드 후 Console의 "16KB 페이지 크기" 경고 여부 확인.
- 메타데이터: 설명에 OCR 등 미구현 기능을 쓰지 않음(기만적 행위 정책).
- 상표: "딸깍" 상표·동명 앱 확인 미완료 → `docs/BRAND_AND_TRADEMARKS.md`.
