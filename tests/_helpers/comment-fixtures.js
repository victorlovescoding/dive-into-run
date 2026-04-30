/**
 * 共用 comment fixture，給 hook / runtime 測試使用。
 * 避免在每個測試檔重複組同一份 CommentData / 歷史 snapshot 樣板。
 */

/**
 * @typedef {object} CommentFixture
 * @property {string} id - 留言 ID。
 * @property {string} authorUid - 留言者 UID。
 * @property {string} authorName - 留言者顯示名稱。
 * @property {string} authorPhotoURL - 留言者大頭貼。
 * @property {string} content - 留言內容。
 * @property {{ __ts: string }} createdAt - 建立時間 timestamp sentinel。
 * @property {{ __ts: string } | null} updatedAt - 編輯時間 timestamp sentinel。
 * @property {boolean} isEdited - 是否曾被編輯。
 */

/**
 * 建立 CommentData 樣板，可覆寫部分欄位。
 * @param {Partial<CommentFixture>} [overrides] - 要覆寫的欄位。
 * @returns {CommentFixture} comment 樣板。
 */
export function createCommentFixture(overrides = {}) {
  return {
    id: 'c1',
    authorUid: 'u1',
    authorName: 'Alice',
    authorPhotoURL: '',
    content: 'old',
    createdAt: { __ts: 'createdAt' },
    updatedAt: null,
    isEdited: false,
    ...overrides,
  };
}

/**
 * 建立留言歷史 snapshot 陣列，給 mockGetDocs 模擬 fetchEventCommentHistoryDocuments。
 * @param {Array<{ id: string, content: string, editedAtSentinel?: string }>} entries - 歷史條目。
 * @returns {Array<{ id: string, data: () => { content: string, editedAt: { __ts: string } } }>} snapshot 陣列。
 */
export function createHistorySnapshots(entries) {
  return entries.map((entry) => ({
    id: entry.id,
    data: () => ({
      content: entry.content,
      editedAt: { __ts: entry.editedAtSentinel ?? entry.id },
    }),
  }));
}
