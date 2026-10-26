# 라이선스·저작권

확인 방법: 설치된 `node_modules/<pkg>/package.json`의 license 필드(2026-10-24). npm 메타데이터만으로는 완료가 아니다 — 출시 전 `scripts/license-audit.mjs`로 번들에 실제 포함되는 패키지 전체와 라이선스 전문을 감사하고, iOS Pod/Android Gradle 네이티브 의존성도 별도 확인한다.

## 주요 런타임 의존성
| 이름 | 버전 | 라이선스 | 비고 |
|---|---|---|---|
| expo | 58.0.19 | MIT | |
| react-native | 0.88.0 | MIT | |
| react / react-dom | 19.3.0 | MIT | |
| expo-router | 58.0.26 | MIT | |
| expo-sharing | 58.0.20 | MIT | 공유 수신 API는 experimental |
| expo-sqlite | 58.0.14 | MIT | SQLite 자체는 Public Domain |
| expo-notifications | 58.1.6 | MIT | 로컬 알림만 사용 |
| expo-file-system | 58.0.11 | MIT | |
| expo-document-picker | 58.0.4 | MIT | |
| expo-image-picker | 58.0.10 | MIT | |
| expo-clipboard | 58.0.4 | MIT | |
| @expo/vector-icons (Ionicons) | ^15 | MIT | 아이콘 폰트 Ionicons MIT |
| react-native-web | ~0.21 | MIT | 웹 프리뷰 전용 |

## 폰트·에셋
| 항목 | 라이선스 | 출처 |
|---|---|---|
| Pretendard (Regular/Medium/SemiBold/Bold) | SIL OFL 1.1 — 앱 번들 포함·상업 이용 가능, 폰트 단독 판매 금지, 라이선스 동봉 | `assets/fonts/Pretendard-OFL.txt` (CutPick에서 복사) |
| 앱 아이콘·스플래시 | 직접 제작 (Pillow 도형, `scripts/build-app-icons.py`) | 외부 이미지 미사용 |

## OCR (미도입)
- Apple Vision: OS 프레임워크 — 오픈소스 아님, Apple 개발자 약관 적용.
- Google ML Kit: 무료 SDK이지만 오픈소스 아님 — ML Kit 약관·데이터 처리 고지 확인 필요.
- Tesseract: Apache-2.0, 한국어 traineddata는 별도 확인 필요.

## 개발 도구 (번들 미포함)
typescript 6.0.3 (Apache-2.0), jest / jest-expo (MIT), eslint (MIT).

## 저작권 원칙
- 경쟁 앱의 코드·화면·문구·아이콘·로고를 사용하지 않음. 화면 구조와 카피는 독자 작성.
- 테스트 fixture는 전부 직접 작성한 가상 텍스트(`tests/extraction-fixtures/fixtures.json`). 실제 영수증·대화·계정 화면은 저장소에 넣지 않음.
- `docs/screenshots/`는 웹 프리뷰 화면(가상 데이터)만.

## 감사 결과 (2026-10-26)
- `npx expo export --platform android --source-maps` → `node scripts/license-audit.mjs <map>`: 번들 포함 **68개** — MIT 65, ISC 1(`@ungap/structured-clone`), MIT AND Apache-2.0 1(`@expo-google-fonts/material-symbols`), OFL-1.1 1(Pretendard). 허용 목록 밖 0개.
- 결과는 `src/generated/oss-licenses.json` → 앱 마이 > 오픈소스 라이선스 화면에 표시(D-016).

## 미해결
- iOS Pod / Android Gradle 네이티브 의존성(AndroidX, Firebase Messaging 등)의 라이선스는 위 감사 범위 밖 — 대부분 Apache-2.0이지만 별도 확인 필요.
- 저장소 자체 LICENSE 미정(D-011).
