# 디자인 시스템 — Calm Personal Inbox (딥그린, 2026-10-24 개편)

`src/design-system/`. 화면은 자체 색·간격을 정의하지 않고 토큰과 공용 컴포넌트만 쓴다. 사용자 제공 레퍼런스 시안(주요 화면 미리보기)의 구조를 따르되, 앱 아이콘은 기존 것을 유지한다.

## 토큰 (`tokens.ts`)
- 색: 민트빛 오프화이트 배경 `#F5F8F7`, 흰 카드, 주요 버튼·선택 상태 딥그린 `#1F3D36`(흰 글자 대비 ≈ 11:1), 강조 텍스트 `#1E6B4E`. 다크 모드는 민트 `#8FD3B4` 강조.
- 카테고리 파스텔 톤(`categoryTones`): green·orange·blue·purple·pink·teal·yellow·gray·indigo — 원형 배경 + 진한 아이콘색. 카테고리별 매핑은 `domain/categories.ts`의 `tone`.
- 간격 4/8/12/16/20/24/32, 반경(button 14, tile 14, card 18, sheet 24), 터치 최소 44pt.
- 타이포: Pretendard 4종. screenTitle, title, sectionTitle, body, bodyStrong, secondary, label, meta, caption, numeric.

## 화면 구조
| 레퍼런스 화면 | KeepOn 구현 |
|---|---|
| 스플래시/온보딩 | `app/onboarding.tsx` — 로고(현재 앱 아이콘), 이름, 슬로건, 세 가지 약속, 시작하기. 공유로 처음 열린 경우엔 막지 않음 |
| 홈 | `(tabs)/index.tsx` — 인사말 제목, 검색 pill, 원형 카테고리 아이콘 줄, 검토 필요 배너, 다가오는 기한 카드(이미지/카테고리 아이콘), 최근 저장 |
| 공유 수집 | `capture/index.tsx` — 받은 내용 미리보기 카드(이미지·링크·글), 자동 분류 미리보기 칩(실제 규칙 결과) |
| 정보 확인하기 | `capture/review.tsx` + `ItemEditor` — 요약 카드, 제목, 아이콘 달린 분류 칩, 찾은 정보(근거·신뢰도), 저장하기 |
| 보관함 / 상세보기 | `(tabs)/library.tsx` — 카테고리 칩 + 진행 중/완료/보관됨 탭 + 썸네일 목록. `item/[id].tsx` — 상단 이미지, 카테고리 아이콘 |
| 커뮤니티 | **제외** (서버·로그인 필요 → 로컬 우선 원칙과 충돌, 사용자 결정 2026-10-24) |
| 마이페이지 | `(tabs)/me.tsx` — 로컬 프로필(계정 없음), 통계(저장한 정보/완료/7일 내 기한), 메뉴(알림·완료/보관·저장 설정·개인정보), 도움말 |
| 하단 탭 | 홈 · 보관함 · (+) · 알림 · 마이 — JS 탭으로 통일, 가운데 + 는 `/capture` 로 이동 |

## 컴포넌트
| 사양 요구 | 구현 |
|---|---|
| PrimaryButton / SecondaryButton / IconButton | `Buttons.tsx` |
| CategoryChip / 카테고리 아이콘 | `FilterChip`(아이콘 지원), `CategoryIcon`, `CategoryTile` |
| InboxItemRow | `components/inbox/InboxItemRow.tsx` (썸네일, 날짜, 우측 분류·D-day) |
| ExtractedFieldRow / ConfidenceBadge | `components/items/ExtractedFieldRow.tsx`, `Badges.tsx` |
| ReviewPanel | `ItemEditor.tsx` (SummaryCard 포함) |
| EmptyState / ErrorState / InlineMessage / BottomSheet | `Feedback.tsx`, `Layout.tsx` |
| 로고 | `Brand.tsx` — `assets/images/splash-icon.png`(현재 아이콘) |

## 원칙
- 자동 값은 "후보"로 표시, 확인 필요는 노란 테두리 + 배지 + 하단 요약.
- 카테고리는 색 + 아이콘 + 글자 라벨을 함께 표시.
- 민감 번호는 기본 가림 + 보기 버튼.
- 레퍼런스의 "AI 기반 분류", 진행률 70% 같은 연출은 쓰지 않음: 실제 규칙 결과와 실제 상태만 표시.
