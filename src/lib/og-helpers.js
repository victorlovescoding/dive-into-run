/**
 * @file OG metadata helper functions.
 * @description 產生 Open Graph description 所需的文字處理工具。
 */

const FALLBACK_DESCRIPTION = 'Dive Into Run 跑步社群平台';

/** @type {Record<string, string>} */
const HTML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/**
 * 移除 HTML 標籤和 Markdown 標記，回傳純文字。
 * @param {string} text - 含 HTML/Markdown 的原始文字。
 * @returns {string} 去除標記後的純文字。
 */
export function stripMarkup(text) {
  if (!text) return '';

  let result = text;

  // Remove HTML tags (including self-closing)
  result = result.replace(/<[^>]*>/g, '');

  // Remove Markdown heading markers (## Heading)
  result = result.replace(/^#{1,6}\s+/gm, '');

  // Remove Markdown bold/italic (**, __, *, _)
  result = result.replace(/(\*{1,2}|_{1,2})(.+?)\1/g, '$2');

  // Remove Markdown blockquote markers (> text)
  result = result.replace(/^>\s+/gm, '');

  // Remove Markdown list markers (- item, * item) at line start
  result = result.replace(/^[-*]\s+/gm, '');

  // Decode HTML entities
  result = result.replace(/&(?:amp|lt|gt|quot|#39);/g, (match) => HTML_ENTITIES[match] || match);

  return result;
}

/**
 * 截斷文字到指定長度，超過時加上省略號（…）。
 * @param {string} text - 要截斷的文字。
 * @param {number} maxLen - 最大字元數。
 * @returns {string} 截斷後的文字。
 */
export function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}\u2026`;
}

/**
 * @typedef {object} EventForOg
 * @property {string | { toDate: () => Date }} time - 活動時間。
 * @property {string} city - 活動所在縣市。
 * @property {string} district - 活動所在區域。
 */

/**
 * 產生活動頁的 OG description。
 * 格式：「YYYY/MM/DD · {city}{district}」
 * @param {EventForOg | null | undefined} event - Firestore 活動文件。
 * @returns {string} 格式化的 OG description。
 */
export function buildEventOgDescription(event) {
  if (!event) return FALLBACK_DESCRIPTION;

  const { time, city, district } = event;
  const date = typeof time === 'string' ? new Date(time) : (time?.toDate?.() ?? null);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return FALLBACK_DESCRIPTION;
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}/${mm}/${dd}`;

  const location = `${city || ''}${district || ''}`;
  const separator = location ? ' \u00b7 ' : '';

  return `\u300c${dateStr}${separator}${location}\u300d`;
}

const POST_EXCERPT_MAX_LEN = 80;

/**
 * @typedef {object} PostForOg
 * @property {string} title - 文章標題。
 * @property {string} content - 文章內容（可能含 HTML/Markdown）。
 */

/**
 * 產生文章頁的 OG description。
 * 格式：「{title} — {excerpt}」，excerpt 超過 80 字加「…」。
 * @param {PostForOg | null | undefined} post - Firestore 文章文件。
 * @returns {string} 格式化的 OG description。
 */
export function buildPostOgDescription(post) {
  if (!post) return FALLBACK_DESCRIPTION;

  const { title, content } = post;
  const plainText = stripMarkup(content || '');
  const excerpt = truncate(plainText, POST_EXCERPT_MAX_LEN);
  const separator = excerpt ? ' \u2014 ' : '';

  return `\u300c${title}${separator}${excerpt}\u300d`;
}
