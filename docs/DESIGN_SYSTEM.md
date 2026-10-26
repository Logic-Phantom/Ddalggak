# 디자인 시스템 — Calm Personal Inbox (틸그린, 2026-10-26 개편)

`src/design-system/`. 화면은 자체 색·간격을 정의하지 않고 토큰과 공용 컴포넌트만 쓴다. 2026-10-26 사용자 제공 시안(피처 그래픽 + 6개 주요 화면)의 스타일·구조를 따르되, 앱에 없는 기능은 화면에 만들지 않는다(아래 "시안과 다른 점").

## 토큰 (`tokens.ts`)
- 색(라이트): 민트빛 배경 `#F6FAF8`, 흰 카드, 주요 버튼·선택 상태 틸그린 `accent #1F5B4F`(흰 글자 대비 ≈ 7.6:1), 강조 텍스트 `accentText #1E6B57`, 연한 강조 `accentSoft #E3F5EE`, 브랜드 민트 `brandMint #4CAB94`(영문 KeepOn·점 장식, 본문 글자색으로 쓰지 않음). 다크 모드는 민트 `#8FD3B4` 강조.
- 카테고리 파스텔 톤(`categoryTones`): green·orange·blue·purple·pink·teal·yellow·gray·indigo — **둥근 사각형** 배경(모서리 = 크기 × `tileCornerRatio` 0.32) + 진한 아이콘색. 카테고리별 매핑은 `domain/categories.ts`의 `tone`.
- 그림자: 초록빛 옅은 그림자(`elevation.card` 0.06, `raised` 0.16). 카드는 머리카락 두께 테두리 + 그림자.
- 간격 4/8/12/16/20/24/32, 반경(button 14, tile 16, card 20, sheet 24, chip 999), 터치 최소 44pt.
- 타이포: Pretendard 4종. screenTitle, title, sectionTitle, body, bodyStrong, secondary, label, meta, caption, numeric.

## 앱 아이콘·그래픽
- 아이콘: 트레이 + 점 글리프(모양은 그대로), 배경 틸그린 세로 그라데이션 `#296C5A → #074E3F`, 글리프 민트 `#DAFAED`. Android 적응형 배경 `#165D4C`, 단색 아이콘은 흰색. `python scripts/build-app-icons.py`
- 스토어: 512 아이콘 `python scripts/build-app-icons.py --store`, 피처 그래픽은 HTML 레이아웃을 Chrome으로 렌더링 `node scripts/store-feature-graphic.mjs`(민트 배경, 큰 아이콘, 궤도선, 링크·달력·티켓·이미지 파스텔 타일, "킵온 KeepOn" + 슬로건).

## 화면 구조
| 시안 화면 | 킵온 구현 |
|---|---|
| 홈 | `(tabs)/index.tsx` — "킵온" 워드마크 + 검색·알림 아이콘, 로고, "필요한 정보, 놓치지 않게 킵온.", 검색 pill, 둥근 사각형 카테고리 줄, 검토 필요 배너, 다음 일정 카드(최대 3개, 전체보기 → 알림), 최근 저장한 정보(전체보기 → 보관함) |
| 새 정보 추가 | `capture/index.tsx` — 받은 내용 카드, 자동 분류 미리보기, 큰 입력 상자, 동작 행(클립보드 붙여넣기·사진·파일·다른 앱에서 공유 안내), 후보 안내, 하단 "정리하기" 하나 |
| 정보 확인하기 | `capture/review.tsx` + `ItemEditor` — 요약 카드, 제목, 분류 칩, "추출된 정보" 표 카드(왼쪽 라벨 pill · 오른쪽 값 · 확인/수정/삭제), 버리기·저장하기 |
| 상세 정보 | `item/[id].tsx` — 머리 카드(아이콘·제목·저장일·분류 배지·고정), 값 표 카드(확인한 값은 체크, 코드는 가림 + 보기 + 복사), 출처·메모 카드, 알림 카드(만들기), 태그 pill, 하단 "보관함으로 이동 · 수정" |
| 알림 | `(tabs)/reminders.tsx` — pill 탭 "예정된 일정 / 지난 일정", 예약된 알림, 월별 묶음, 날짜 블록(월/일/요일) + 분류 배지 + D-day |
| 보관함 | `(tabs)/library.tsx` — 카테고리 칩, pill 탭 진행 중/완료/보관됨, 목록 행 |
| 마이 | `(tabs)/me.tsx` — 로컬 프로필, 통계(초록 숫자, 7일 내 기한은 빨강), 메뉴(알림·기한, 보관함, 저장·데이터 설정, 개인정보 처리방침, 오픈소스 라이선스, 문의하기), 도움말 행 |
| 하단 탭 | 홈 · 보관함 · (+) · 알림 · 마이 — 가운데 + 는 `/capture` |

## 시안과 다른 점 (의도)
- **태그 관리 메뉴 없음**: 태그 화면이 아직 없어 메뉴를 만들지 않음.
- **"지난 알림" → "지난 일정"**: 앱은 보낸 알림 기록을 남기지 않음. 지난 7일의 확인한 날짜를 보여 줌.
- **홈 카테고리**: 시안의 링크·텍스트·쿠폰·이미지·파일(입력 형식)이 아니라 앱의 실제 분류(장소·쇼핑·쿠폰·예약…)를 보여 줌.
- **목록의 금액**: 목록 행은 날짜만 보여 줌(금액은 상세에서). 가짜 값을 만들지 않음.
- **상세의 알림 스위치**: 알림은 날짜·시점을 골라 만드는 방식이라 켜고 끄는 스위치 대신 "만들기"와 목록을 둠.
- **로고**: 시안 화면의 잎 모양 로고 대신 피처 그래픽과 같은 트레이 아이콘을 씀.

## 컴포넌트
| 용도 | 구현 |
|---|---|
| PrimaryButton / SecondaryButton / IconButton(`compact` 지원) | `Buttons.tsx` |
| 카테고리 아이콘 / 타일 / 배지 | `CategoryIcon`, `CategoryTile`, `CategoryBadge` (`CategoryIcon.tsx`) |
| pill 탭, 동작 행, 섹션 제목 + 전체보기, 메뉴 행 | `SegmentTabs`, `ActionRow`, `SectionLink`, `ListRow` (`Navigation.tsx`) |
| 워드마크 | `BrandWordmark`(킵온 + 선택적 KeepOn), `BrandMark`(아이콘) — `Brand.tsx` |
| InboxItemRow | `components/inbox/InboxItemRow.tsx` (타일/썸네일, 날짜, 분류 배지·D-day) |
| ExtractedFieldRow / ConfidenceBadge | `components/items/ExtractedFieldRow.tsx`, `Badges.tsx` |
| EmptyState / ErrorState / InlineMessage / Card / BottomBar / BottomSheet | `Feedback.tsx`, `Layout.tsx` |

## 원칙
- 자동 값은 "후보"로 표시, 확인 전 값은 라벨을 노란색으로 + 신뢰도 배지 + 하단 요약. 확인한 값은 초록 체크(눌러서 확인 취소).
- 카테고리는 색 + 아이콘 + 글자 라벨을 함께 표시.
- 민감 번호는 기본 가림 + 보기 + 복사(누를 때만 클립보드에 씀).
- 시안의 연출 숫자(예: 28개, 12개)는 쓰지 않음: 실제 데이터와 실제 상태만 표시.
