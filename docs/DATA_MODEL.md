# 데이터 모델

SQLite 파일 `ddalggak.db` (앱 전용 저장소, **암호화 안 됨**). 마이그레이션: `src/infrastructure/database/migrations.ts`, 버전은 `PRAGMA user_version`. 바이너리는 DB에 넣지 않고 파일 경로만 저장.

## items
| 열 | 설명 |
|---|---|
| id, title, category, status | status: draft/active/completed/archived |
| source_type | shared-url/shared-text/shared-image/shared-document/manual/paste |
| source_url, url_key, domain | url_key = 중복 판별용 정규화 URL (추적 파라미터·www·fragment 제거) |
| display_text | 공유/붙여넣은 원문 |
| ocr_text | OCR 원문(설정으로 저장 끄기·일괄 삭제 가능) |
| user_note, needs_review, pinned | |
| captured_at, created_at, updated_at, schema_version | |

`sourceApp`은 저장하지 않음: 현재 공유 API가 출처 앱을 제공하지 않으므로 추측하지 않는다.

## extracted_fields
field_type, value_text(표시값), normalized_value(날짜 `YYYY-MM-DD[THH:mm]`, 금액 `<최소단위> <통화>`), role(날짜/금액 의미), confidence, method(shared-payload/regex-rule/ocr/manual), evidence_text(근거 줄), requires_confirmation, user_confirmed, user_edited_at.
- 사용자 확인 여부가 알림·기한 탭 노출을 결정.
- 원문·추출값·사용자 확인값이 분리되어 근거를 잃지 않음.

## attachments
local_uri(앱 폴더 `ddalggak/attachments/<itemId>/`), original_name(정리된 파일명), mime_type(헤더 검증 결과), size_bytes, storage_mode.

## reminders
scheduled_at(로컬 `YYYY-MM-DDTHH:mm`), timezone_id, reminder_type, notification_id(OS 예약 id, 권한 없으면 null), enabled, completed_at.

## tags / item_tags
태그 이름 UNIQUE, 사용되지 않는 태그는 자동 정리.

## kv
`settings.v1`: retainAttachments, storeOcrText, defaultReminderHour, onboardingSeenAt.

## 삭제·정합성
- 항목 삭제: items 행 삭제(자식 CASCADE) → 예약 알림 취소 → 파일 삭제.
- 전체 삭제: 모든 알림 취소 → 모든 테이블 비우기 → 앱 폴더 삭제.
- 시작 시 reconcile: 1일 지난 draft 삭제, DB에 없는 첨부 폴더 삭제, 파일 없는 첨부 행 삭제, 알림 재동기화.
