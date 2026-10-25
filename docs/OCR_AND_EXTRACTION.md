# OCR 및 정보 추출

## 현재 상태 (2026-10-25)
| 범위 | 상태 |
|---|---|
| Android 이미지 OCR (ML Kit 한국어 번들 모델) | **코드 구현**, 네이티브 빌드·실기기 **미검증** |
| Android PDF (앞 3쪽 렌더링 후 OCR) | **코드 구현**, 미검증. 텍스트 PDF도 렌더링해 같은 엔진으로 읽음(내장 텍스트 직접 추출은 하지 않음) |
| iOS | 미연결 — 항상 "이 기기·버전에서는 글자 인식을 쓸 수 없어요" |
| 웹·Expo Go | 네이티브 모듈 없음 → 미연결 |
| OCR 결과 → 규칙 추출 연결 | 구현·단위 테스트(가짜 provider) 통과 |
| 정확도 | **측정 없음** |

### 구조
- 네이티브: `modules/ddalggak-ocr/android/.../DdalggakOcrModule.kt` — `recognizeImage(uri, maxSide)`, `recognizePdf(uri, maxPages, maxSide)`, `isAvailable()`. 오류는 코드만(`ERR_OCR_MEMORY`, `ERR_OCR_FILE`, `ERR_OCR_DECODE`, `ERR_OCR_PDF_PROTECTED`, `ERR_OCR_PDF_INVALID`, `ERR_OCR_ENGINE`), 메시지에 경로·글자를 넣지 않음.
- JS: `modules/ddalggak-ocr/index.ts`(`requireOptionalNativeModule`) → `src/features/ocr/mlkit-provider.ts`(OcrProvider) → `ocr-service.ts`의 `runOcr()`가 기본으로 선택. 모듈이 없으면 `unavailable-provider`.
- `runOcr`는 절대 throw하지 않음: `done / empty / unavailable / unsupported-type / failed(reason)`. 60초 타임아웃.
- 이미지 처리: 2의 거듭제곱 샘플링으로 긴 변 ≤ 3072px, EXIF 회전 반영(ML Kit 권장: 글자당 16px 이상). HEIC는 Android 9+의 BitmapFactory 지원에 의존.
- 캡처: 원본 복사·검증 → OCR → 공유 텍스트와 OCR 텍스트를 각각 규칙 추출(OCR은 `method: 'ocr'`, 신뢰도 최대 medium) → 모두 **확인 전 후보**. OCR 실패·빈 결과에도 원본과 입력 텍스트는 저장.
- 나중에 읽기/다시 시도: 검토 화면의 "이미지 글자 읽기 / 다시 시도"(`analyzeAttachments`) — 보관된 첨부로 다시 인식하고 `mergeReanalysis`로 합쳐 사용자가 확인·수정·직접 입력한 값은 그대로 둠. 상대 날짜는 캡처일 기준.
- 설정: "이미지·PDF 글자 인식"(ocrEnabled) 끄면 호출 안 함. "이미지 원문 텍스트 저장"(storeOcrText) 끄면 `ocr_text`를 저장하지 않음(추출 필드의 근거 줄은 남음).
- 네트워크: 앱은 이미지를 업로드하지 않음. ML Kit 자체의 진단 정보 전송은 PRIVACY.md 참고.

### Android 기기 QA 절차 (미실행)
1. `npx eas-cli@latest build --profile development --platform android`(또는 preview APK) — 네이티브 모듈이 포함된 새 빌드 필요.
2. 직접 만든 합성 이미지(쿠폰·영수증·예약·포스터, 회전된 사진, 작은 글자, 흐린 사진)와 텍스트 PDF·스캔 PDF·암호 PDF 준비(실제 개인 자료 금지).
3. 갤러리 공유/사진 선택으로 각 파일 → 저장하기 → 날짜·금액·코드 후보와 근거 확인, 틀린 값 수정 → 저장.
4. 임시 저장 → 검토 → "이미지 글자 읽기" → 수정한 값이 유지되는지.
5. 설정에서 글자 인식 끄기 → "설정에서 꺼 두었어요" 안내 확인.
6. 처리 시간·메모리·APK 크기 증가를 기록해 이 문서에 실측값으로 남김.

## OCR 엔진 후보와 POC 계획
| 후보 | 장점 | 확인할 것 |
|---|---|---|
| iOS Vision (`VNRecognizeTextRequest`) | OS 내장, 기기 내 처리, 추가 모델 다운로드 없음 | 한국어 지원 revision·최소 iOS 버전, Expo Modules로 Swift 브리지 작성 비용 |
| Android ML Kit Text Recognition v2 (Korean) | 한국어 스크립트 전용 모델, 오프라인 | 번들 모델 vs Play 서비스 다운로드(첫 실행 오프라인 여부), 앱 용량 증가, Google API 약관 |
| Tesseract + kor.traineddata | 오픈소스(Apache-2.0) | 학습 데이터 라이선스, RN 연결, 메모리/속도, 한국어 정확도 |

POC 절차: ① 직접 만든 합성 이미지(영수증·쿠폰·예약·포스터·보증서·웹 캡처·흐림/기울임/저해상도) 20장 준비 ② 각 엔진으로 텍스트 추출 ③ `tests/extraction-fixtures` 기대값과 비교해 필드 정답률 **실측** ④ 처리 시간·메모리·앱 용량 기록 ⑤ 결과를 이 문서와 `DECISIONS.md`에 기록. 측정하지 않은 정확도 수치는 쓰지 않는다.

연결 방식 후보: Expo Modules API로 얇은 로컬 모듈(`modules/ocr`)을 작성해 iOS는 Vision, Android는 ML Kit을 호출 → `setOcrProvider()`로 등록. 서드파티 RN 패키지를 쓸 경우 SDK 58/RN 0.88 호환성과 라이선스를 먼저 확인.

## 파이프라인
1. `normalizeText`: CRLF→LF, NFKC(전각 숫자→ASCII), 물결/대시 통일, 숫자 사이 `O→0`, `l/I/|→1`, 공백 정리. 원문은 별도 보존.
2. 날짜(`date-parser.ts`)
   - 절대: `2026년 10월 17일`, `2026.10.17`, `2026-10-17`, `2026/10/17`, `26.10.17`(medium)
   - 연도 없음: `10월 17일`, `10.17`, `10/17` → 올해(60일 이상 지났으면 내년), **low + 확인 필요**. 요일 표기가 맞으면 medium, 틀리면 모호.
   - `03/04`처럼 슬래시 + 둘 다 12 이하 → 모호.
   - 상대: `오늘`, `내일`, `모레`, `이번/다음 주 X요일`, `D-7` → 캡처일 기준이라 **low**.
   - 시간: `18:00`, `오후 7시`, `오전 10시 30분`, `7시 반`, `(토) 19:30`.
   - 의미(role): 날짜에 **가장 가까운** 라벨로 결정(유효기간/예약/주문/구매/배송/반품/보증/발행/행사). `~10.31`·`까지`는 종료일(유효기간 줄이면 만료일).
   - "마지막 날짜 = 만료일" 같은 위치 추측은 하지 않음.
   - `7일 이내 반품`은 **문구로만** 저장, 날짜를 계산하지 않음.
3. 금액(`money-parser.ts`): `1,000원`, `₩10,000`, `KRW 25000`, `3만원`, `1.5만 원`, `$10.99`, `10.99 USD`. 정수 최소 단위로 저장. 라벨로 합계/결제/공급가액/부가세/할인/가격 구분. 쉼표 그룹이 깨지면 low.
4. 코드(`code-parser.ts`): 라벨이 있을 때만 쿠폰/주문/예약/티켓 번호(숫자 포함 필수). **인증번호·OTP·비밀번호·CVC 줄은 추출하지 않음.** 전화번호는 구분자가 있을 때만. 주소는 도로명 패턴(low), 상호는 `상호:` 라벨.
5. 분류(`category-classifier.ts`): 키워드·도메인·필드 신호 점수 → 후보 목록. UI는 "~일 가능성이 높아요 / ~일 수도 있어요"로만 표현.
6. 신뢰도·확인: `high` 외에는 확인 필요. 역할 미상·연도 추정·상대·모호 날짜는 항상 확인 필요. 사용자 확인/수정/직접 입력 필드는 재분석이 덮어쓰지 않음(`mergeReanalysis`).

## 테스트
- `tests/unit/date-parser.test.ts`, `money-and-codes.test.ts`, `url-and-category.test.ts`, `policies.test.ts`
- `tests/extraction-fixtures/fixtures.json`: 직접 작성한 **가상 텍스트 8건**(영수증, 쿠폰, 예약, 행사, 보증서, 쇼핑 공유, 한영 혼합, OCR 손상 흉내). 실제 OCR 이미지 정확도 측정은 아님.
- `tests/unit/ocr-and-capture.test.ts`: 가짜 provider로 성공·빈 결과·오류·타임아웃·미지원 형식·PDF 경로, OCR 텍스트 → 날짜/금액/코드 추출, 확인 전 상태 유지, OTP·비밀번호 제외, 제목 코드 마스킹, 원문 저장 끄기, OCR 실패 시 원본·입력 텍스트 보존, 재분석이 사용자 값을 덮어쓰지 않음. **네이티브 엔진 자체는 테스트하지 않음.**
