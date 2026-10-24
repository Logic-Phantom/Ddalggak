# 디자인 시스템 — Calm Personal Inbox

`src/design-system/`. 화면은 자체 색·간격을 정의하지 않고 토큰과 공용 컴포넌트만 쓴다.

## 토큰 (`tokens.ts`)
- 색: background, surface, surfaceElevated, surfaceSunken, textPrimary/Secondary/Tertiary, border(Strong), accent(+Pressed/Soft/Text), selected, success, warning, error(+Soft), scrim. 라이트/다크 각각 정의.
- 포인트 컬러 1개(라이트 `#2F5BD3`, 다크 `#8FA8FF`). 상태는 색 + 아이콘 + 텍스트로 함께 표시.
- 간격 4/8/12/16/20/24/32, 반경(button 12, tile 14, card 16, sheet 22), 터치 최소 44pt.
- 타이포: Pretendard 4종(굵기별 별도 family). screenTitle, title, sectionTitle, body, bodyStrong, secondary, label, meta(날짜), caption, numeric(날짜·금액, tabular-nums). `maxFontSizeMultiplier` 2.

## 컴포넌트
| 사양 요구 | 구현 |
|---|---|
| PrimaryButton / SecondaryButton / IconButton | `Buttons.tsx` (+ DangerButton, GhostButton) |
| SearchField | `TextField` (검색 탭에서 사용) |
| CategoryChip | `FilterChip` (아이콘 지원, radio/checkbox 역할) |
| InboxItemRow | `src/components/inbox/InboxItemRow.tsx` |
| ExtractedFieldRow | `src/components/items/ExtractedFieldRow.tsx` |
| ConfidenceBadge | `Badges.tsx` (근거 분명/확인 권장/확인 필요/불확실) |
| ReviewPanel | `ItemEditor.tsx` |
| ReminderCard | 기한 탭 `DueRow`, `ReminderSheet` |
| EmptyState / ErrorState / InlineMessage | `Feedback.tsx` |
| ConfirmDialog | OS `Alert` (파괴적 동작은 destructive 스타일) |
| BottomSheet | `Layout.tsx` (Reduce Motion 시 애니메이션 없음) |

## 원칙
- "AI가 다 알아서" 연출 금지. 자동 값은 "후보"로, 확인 필요는 노란 테두리 + 배지 + 하단 요약 문구.
- 카드에는 제목 → 가장 중요한 날짜(D-day, 확인 전 표시) → 메타 순.
- 민감 번호는 기본 가림 + 보기 버튼.
