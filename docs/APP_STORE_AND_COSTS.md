# 비용·스토어 배포

> 금액은 이 문서 작성 시 공식 페이지에서 재확인하지 않았다. 출시 직전에 아래 공식 링크에서 현재 금액·조건을 확인하고 날짜와 함께 갱신한다. "완전히 무료로 상용 배포 가능"하다고 보지 않는다.

| 구분 | 항목 | 비용 성격 | 공식 출처 |
|---|---|---|---|
| 로컬 개발 | React Native, Expo SDK, 사용 패키지 | 오픈소스(MIT 등), 라이선스 비용 없음 | 각 저장소 |
| 로컬 개발 | Android 빌드 (Android Studio/SDK) | 무료 도구, Windows 가능 | developer.android.com |
| 로컬 개발 | iOS 빌드 | macOS + Xcode 필요 (현재 환경 Windows → 로컬 불가) | developer.apple.com |
| 외부 테스트 | EAS Build | 무료 플랜 빌드 횟수·대기열 제한 있음, 초과 시 유료 | https://expo.dev/pricing |
| 외부 테스트 | iOS 실기기 설치 | Apple Developer Program 가입 필요(연회비) | https://developer.apple.com/programs/whats-included/ |
| 스토어 배포 | Google Play Console | 1회 등록비 | https://support.google.com/googleplay/android-developer/answer/6112435 |
| 스토어 배포 | Apple App Store | Apple Developer Program 연회비 | 위 링크 |
| 운영 | 서버/DB/스토리지/네트워크 | **MVP는 서버 없음 → 0** | - |
| 향후 | 백업/동기화, 광고, 구독, 분석 SDK | 도입 시 별도 비용·개인정보 검토 | - |

## Expo Go vs development build
- 공유 수신(intent filter, Share Extension)과 config plugin 설정은 Expo Go에 포함되지 않음 → **development build 필수** (`npx expo run:android` 또는 `eas build --profile development`).
- 로컬 알림은 Expo Go에서도 일부 동작하나 최종 검증은 development build에서.
- 향후 OCR 네이티브 모듈도 development build 필요.

## 빌드 명령
```bash
npx expo prebuild --clean
npx expo run:android
npx eas-cli@latest build --profile development --platform android
```
EAS 사용 시 `eas init`으로 **본인 계정의** projectId를 새로 발급(CutPick의 projectId를 재사용하지 않음).
