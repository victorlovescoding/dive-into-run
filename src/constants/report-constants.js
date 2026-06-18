export const REPORT_TARGET_TYPES = Object.freeze({
  POST: 'post',
  POST_COMMENT: 'postComment',
  EVENT: 'event',
  EVENT_COMMENT: 'eventComment',
});

export const REPORT_TARGET_TYPE_VALUES = Object.freeze(Object.values(REPORT_TARGET_TYPES));

export const REPORT_REASON_LABELS = Object.freeze({
  spam: '垃圾訊息',
  harassment: '騷擾或霸凌',
  hate: '仇恨或歧視',
  sexual: '色情內容',
  violence: '暴力或危險行為',
  illegal: '違法內容',
  misinformation: '不實或誤導',
  other: '其他',
});

export const REPORT_REASON_VALUES = Object.freeze(Object.keys(REPORT_REASON_LABELS));

export const REPORT_STATUS = Object.freeze({
  OPEN: 'open',
});

export const REPORT_DETAILS_MAX_LENGTH = 500;
export const REPORT_SOURCE_PATH_MAX_LENGTH = 1024;
export const REPORT_EXCERPT_MAX_LENGTH = 500;

export const REPORT_MESSAGES = Object.freeze({
  SUCCESS: '已收到你的檢舉，我們會進行審查。',
  GENERIC_ERROR: '檢舉送出失敗，請稍後再試。',
  DUPLICATE: '你已經檢舉過這則內容。',
  SELF_REPORT: '不能檢舉自己的內容。',
});

export const REPORT_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 'invalid_request',
  UNAUTHENTICATED: 'unauthenticated',
  SELF_REPORT_FORBIDDEN: 'self_report_forbidden',
  TARGET_UNAVAILABLE: 'target_unavailable',
  DUPLICATE_REPORT: 'duplicate_report',
  INTERNAL_ERROR: 'internal_error',
});

export const REPORT_SERVER_OWNED_FIELDS = Object.freeze([
  'reportId',
  'targetKey',
  'targetSnapshot',
  'reporterUid',
  'status',
  'createdAt',
]);
