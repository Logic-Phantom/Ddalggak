# 데이터 모델

SQLite 파일 `ddalggak.db` (앱 전용 저장소, **암호화 안 됨**). 마이그레이션: `src/infrastructure/database/migrations.ts`, 버전은 `PRAGMA user_version`. 바이너리는 DB에 넣지 않고 파일 경로만 저장.

## items
| 열 | 설명 |
|---|---|
| id, title, category, status | status: draft(검토 화면 열림, 1일 후 자동 삭제) / pending(임시 저장, 자동 삭제 없음, 알림 불가) / active / completed / archived. 전이: draft→active·pending, pending→active, active→completed·archived, completed→active·archived, archived→active |
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
scheduled_at(로컬 `YYYY-MM-DDTHH:mm`, 알림이 울릴 시각), timezone_id(예약 당시 기기 시간대), reminder_type, notification_id(OS 예약 id — null이면 기기에 예약 안 됨: 권한 없음·예약 실패·꺼짐), enabled(사용자 의도: 켜짐/꺼짐), completed_at.
v2 추가(NULL 허용, 기존 행은 NULL): source_field_id(알림을 만든 확인된 날짜 필드), target_date(사용자가 고른 날짜), days_before(며칠 전). 날짜 필드를 수정·확인 해제하면 연결된 알림이 재예약되거나 꺼진다(DECISIONS D-017).

## tags / item_tags
태그 이름 UNIQUE, 사용되지 않는 태그는 자동 정리.

## kv
`settings.v1`: retainAttachments, storeOcrText, ocrEnabled(기본 true, 없으면 기본값으로 채움), defaultReminderHour, onboardingSeenAt.

## 마이그레이션
| 버전 | 내용 |
|---|---|
| v1 | 초기 스키마 |
| v2 (2026-10-25) | `reminders`에 `source_field_id`, `target_date`, `days_before` 열 + `idx_reminders_field` 추가. `ALTER TABLE ADD COLUMN`만 사용해 기존 데이터 보존, 버전 올림과 같은 트랜잭션 |

## 백업 파일 (`ddalggak-export`)
- v1: 데이터만. v2: 항목마다 `attachments[]`(id, originalName, mimeType, sizeBytes, sha256, createdAt, data(base64 또는 null), excludedReason). 알림 행에는 v2 열이 포함되고 `notificationId`는 제외.

## 삭제·정합성
- 항목 삭제: items 행 삭제(자식 CASCADE) → 예약 알림 취소 → 파일 삭제.
- 전체 삭제: 모든 알림 취소 → 모든 테이블 비우기 → 앱 폴더 삭제.
- 시작 시 reconcile: 1일 지난 draft 삭제(pending은 대상 아님), DB에 없는 첨부 폴더 삭제, 파일 없는 첨부 행 삭제, 알림 재동기화(알림 탭 진입 때도 실행).
- 캡처 DB 삽입 실패 시 그 캡처로 복사한 폴더를 즉시 삭제. 가져오기 실패 시 이번에 쓴 첨부 폴더를 삭제하고 DB는 트랜잭션으로 원상태.
