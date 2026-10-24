/** User-facing error categories. Messages are plain Korean guidance, never stack traces. */
export type AppErrorCode =
  | 'share-empty'
  | 'share-unsupported'
  | 'file-access-lost'
  | 'file-too-large'
  | 'file-type-mismatch'
  | 'ocr-unavailable'
  | 'ocr-failed'
  | 'permission-denied'
  | 'notification-denied'
  | 'notification-failed'
  | 'reminder-limit'
  | 'storage-failed'
  | 'db-failed'
  | 'import-invalid'
  | 'validation'
  | 'unknown';

const MESSAGES: Record<AppErrorCode, string> = {
  'share-empty': '공유된 내용이 비어 있어요. 링크나 텍스트를 직접 붙여 넣거나 파일을 선택해 주세요.',
  'share-unsupported': '이 형식은 아직 지원하지 않아요. 텍스트·링크·이미지·PDF를 보내 주세요.',
  'file-access-lost': '공유된 파일에 더 이상 접근할 수 없어요. 원래 앱에서 다시 공유하거나 파일을 직접 선택해 주세요.',
  'file-too-large': '파일이 너무 커요. 25MB 이하의 파일을 선택해 주세요.',
  'file-type-mismatch': '파일 내용이 확장자와 달라요. 다른 파일을 선택해 주세요.',
  'ocr-unavailable': '이 기기에서는 아직 글자 인식을 사용할 수 없어요. 제목과 날짜를 직접 입력해 저장할 수 있어요.',
  'ocr-failed': '글자를 읽지 못했어요. 다시 시도하거나 직접 입력해 주세요.',
  'permission-denied': '권한이 거부됐어요. 기기 설정 > 딸깍에서 권한을 허용할 수 있어요.',
  'notification-denied': '알림 권한이 꺼져 있어요. 기한은 앱의 기한 탭에서 계속 확인할 수 있어요.',
  'notification-failed': '알림을 예약하지 못했어요. 기한은 앱의 기한 탭에서 확인할 수 있어요.',
  'reminder-limit': '예약된 알림이 너무 많아요. 지난 알림을 정리한 뒤 다시 시도해 주세요.',
  'storage-failed': '기기 저장 공간에 쓰지 못했어요. 저장 공간을 확인한 뒤 다시 시도해 주세요.',
  'db-failed': '로컬 데이터베이스를 열지 못했어요. 앱을 다시 시작해 주세요.',
  'import-invalid': '가져올 파일 형식이 올바르지 않아요. 딸깍에서 내보낸 JSON 파일인지 확인해 주세요.',
  validation: '입력값을 확인해 주세요.',
  unknown: '알 수 없는 문제가 생겼어요. 다시 시도해 주세요.',
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  constructor(code: AppErrorCode, message?: string, readonly cause?: unknown) {
    super(message ?? MESSAGES[code]);
    this.code = code;
    this.name = 'AppError';
  }
  get userMessage(): string {
    return this.message || MESSAGES[this.code];
  }
}

export function messageFor(code: AppErrorCode): string {
  return MESSAGES[code];
}

export function toUserMessage(err: unknown): string {
  if (err instanceof AppError) return err.userMessage;
  return MESSAGES.unknown;
}

/**
 * Logs without sensitive data: never OCR text, URLs, codes, file paths or payload contents.
 * Release builds log only the category; dev builds add the raw error message.
 */
export function logError(scope: string, err: unknown): void {
  const code = err instanceof AppError ? err.code : 'unknown';
  const name = err instanceof Error ? err.name : typeof err;
  const cause = err instanceof AppError ? err.cause : err;
  const detail = typeof __DEV__ !== 'undefined' && __DEV__ && cause instanceof Error ? `: ${cause.message}` : '';
  console.warn(`[ddalggak:${scope}] ${code} (${name})${detail}`);
}
