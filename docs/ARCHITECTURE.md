# 아키텍처

## 원칙
- **로컬 우선**: 서버·로그인·원격 AI 없음. SQLite + 앱 전용 폴더 + 로컬 알림.
- **사용자가 보낸 것만 처리**: OS 공유, 사진/문서 선택기, 붙여넣기(버튼을 눌렀을 때만 클립보드 읽기).
- **추출은 후보**: 모든 값은 근거(evidence)·신뢰도·추출 방식을 가지고, 사용자가 확인한 값만 알림에 쓰임.
- **UI는 SQL을 모름**: 화면 → 서비스 → 리포지토리 → SQLite.

## 레이어
```
src/app/                 Expo Router 화면 (파일 = 라우트)
  (tabs)/                인박스 · 검색 · 기한 · 설정
  capture/               공유 수신·직접 추가(index) → 검토(review)
  item/                  상세, 수정
  +native-intent.ts      ddalggak://expo-sharing → /capture?source=share
src/components/          화면 조합 컴포넌트 (InboxItemRow, ItemEditor, ExtractedFieldRow, ReminderSheet)
src/design-system/       토큰 + 공용 컴포넌트 (화면은 자체 색/간격 정의 금지)
src/domain/              모델 타입, 분류 라벨, 오류
src/features/
  incoming-share/        payload 정규화(순수 함수), MIME/헤더/파일명 검증, useSharedPayloads
  capture/               캡처 → 파일 복사 → 검증 → OCR → 추출 → draft 저장
  ocr/                   OcrProvider 계약, 서비스, 텍스트 정규화, unavailable provider
  extraction/            날짜·시간·금액·코드·주소·URL 규칙, 분류기, 재분석 병합 정책
  items/                 리포지토리(SQL), 상태 전이, 삭제·정합성(reconcile)
  reminders/             알림 정책(순수), 리포지토리, 서비스(권한·예약·동기화)
  search/                검색어 정규화
  export-import/         버전 있는 JSON 포맷, 내보내기/가져오기
  preferences/           설정(kv)
src/infrastructure/      SQLite, 파일 저장소, 로컬 알림 (+ .web.ts 대체 구현)
tests/                   unit · share-intent · extraction-fixtures
```

## 캡처 파이프라인
1. 입력 수집: OS 공유(raw payload) / 붙여넣기 / 선택기 → `CaptureInput[]` (`share-payload-normalizer.ts`).
2. 파일: 앱 폴더로 복사(`attachments/<itemId>/`) → 실제 헤더로 MIME 재검증 → 크기 25MB 제한 → 파일명 정리.
3. OCR: 이미지에 한해 `runOcr()` — 현재 provider는 "사용 불가"를 정직하게 반환.
4. 추출: 텍스트 정규화(NFKC, 숫자 사이 O/l 보정) → 날짜/시간/금액/코드/전화/주소/상호/반품 문구 → 분류 후보.
5. draft 저장 → 검토 화면에서 분류/값 확인·수정 → `active`.
6. 앱 시작 시 정합성: 1일 지난 draft 삭제, 고아 첨부 폴더 삭제, 파일 없는 첨부 행 삭제, 알림 재동기화.

## 플랫폼 경계
- `*.web.ts`: 파일 시스템·알림·공유 수신 대체(웹은 UI 확인 전용).
- 공유 수신·OCR·알림은 **Expo Go가 아닌 development build**에서 검증해야 함.
