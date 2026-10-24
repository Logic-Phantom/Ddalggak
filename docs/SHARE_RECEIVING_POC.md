# 외부 앱 공유 수신 POC

> 상태(2026-10-24): **코드·설정 구현 완료, 실기기 미검증.** 아래 표의 "실기기" 열이 채워지기 전까지 어떤 앱과도 "호환"이라고 표시하지 않는다.

## 구현 방식
- `expo-sharing@58.0.20` config plugin (`app.json`):
  - Android: `singleShareMimeTypes = text/plain, image/*, application/pdf`, `multipleShareMimeTypes = image/*` → MainActivity에 `ACTION_SEND`/`ACTION_SEND_MULTIPLE` intent filter 생성.
  - iOS: Share Extension 타깃(`expo-sharing-extension`, 배포 타깃 16.4) 생성, activation rule: 텍스트, 웹 URL 1개, 이미지 5개, 파일 3개. App Group 기본값 `group.app.ddalggak.mobile`.
- 앱은 `ddalggak://expo-sharing`으로 열리고 `+native-intent.ts`가 `/capture?source=share`로 보냄.
- `useIncomingShare().sharedPayloads`(raw)만 읽고, 화면에 반영한 뒤 `clearSharedPayloads()`로 비움(재실행 시 중복 수신 방지).
- **사용하지 않는 것**: `getResolvedSharedPayloadsAsync()` — URL 해석에 네트워크가 쓰일 수 있음.
- 패키지 타입 정의상 수신 API는 `@experimental`.

## 정규화·검증 규칙 (`share-payload-normalizer.ts`, `mime-validation.ts`)
| 입력 | 처리 |
|---|---|
| `url` | http/https만 허용 |
| `text` | 2만 자 제한. URL이 있으면 url 입력으로, URL 외 글이 있으면 원문 보존 |
| `image`/`file` | `file://`·`content://`만 허용(원격 URL 거부). MIME 미상/`image/*`이면 확장자로 판별. jpeg/png/heic/heif/webp/pdf만 |
| `audio`/`video`/zip 등 | 거부 + 사유 안내 |
| 빈 값 | `share-empty` 안내 + 수동 입력 대안 |
| 중복/과다 | 동일 payload 1회만, 최대 10개 |
| 파일 복사 후 | 헤더 스니핑으로 실제 형식 확인, 확장자와 계열이 다르면 거부, 25MB 초과 거부 |

## 실기기 테스트 표 (채울 것)
| 출처 앱 | OS/기기 | 공유 타입 | 전달된 shareType/mimeType | 앱 종료 상태에서 | 결과 |
|---|---|---|---|---|---|
| Chrome | Android ? | URL | 미검증 | 미검증 | - |
| 사진(갤러리) | Android ? | 이미지 1장 / 여러 장 | 미검증 | 미검증 | - |
| 파일 | Android ? | PDF | 미검증 | 미검증 | - |
| 카카오톡 | Android ? | 링크 / 텍스트 / 이미지 | 미검증 | 미검증 | - |
| Safari | iOS ? | URL | 미검증 (Mac/Xcode 또는 EAS 필요) | 미검증 | - |
| 사진 | iOS ? | 이미지 | 미검증 | 미검증 | - |
| 파일 | iOS ? | PDF | 미검증 | 미검증 | - |
| 카카오톡 | iOS ? | 링크 / 텍스트 / 이미지 | 미검증 | 미검증 | - |

## 검증 절차
1. `npx expo prebuild --clean` 후 `npx expo run:android` (또는 `eas build --profile development`).
2. 각 출처 앱에서 공유 → 딸깍 선택 → 캡처 화면의 "받은 내용" 항목과 거부 메시지 확인.
3. 앱 강제 종료 상태에서 공유 → 앱이 캡처 화면으로 열리는지.
4. 공유 직후 원본 앱에서 파일 삭제 → 복사본이 남는지(`content://` 수명).
5. 결과를 위 표와 README Work Log에 기록. 실패도 그대로 기록.

## 알려진 위험
- iOS: Share Extension은 App Group 등록·서명이 필요. 로컬 Xcode가 없는 Windows 환경에서는 EAS Build로만 검증 가능.
- 카카오톡 등 앱별로 텍스트만 넘기거나 이미지 대신 링크를 넘기는 등 동작이 다를 수 있음. 앱이 노출한 공유 데이터만 받을 수 있으며 대화 전체를 가져올 수 없음.
- OS 업데이트로 공유 동작이 바뀔 수 있음.
- 실패 시 대안: 앱 안의 붙여넣기 / 사진 선택 / 파일 선택은 항상 동작.
