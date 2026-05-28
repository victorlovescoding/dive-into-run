import { adminDb } from '@/config/server/firebase-admin-app';

const DEFAULT_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 50;
const RAW_READ_BUDGET_FACTOR = 3;

class InvalidMemberCommentsCursorError extends Error {
  constructor() {
    super('Invalid member comments cursor');
    this.name = 'InvalidMemberCommentsCursorError';
  }
}

/**
 * @typedef {object} ServerMemberCommentDocument
 * @property {string} id - Comment document ID.
 * @property {'post' | 'event'} source - Parent collection source.
 * @property {string} parentId - Parent post/event ID.
 * @property {string | null} parentTitle - Parent title, or null when missing.
 * @property {Record<string, unknown>} data - JSON-safe comment payload.
 * @property {string} cursor - Admin SDK document path cursor.
 */

/**
 * @typedef {object} ServerMemberCommentsPage
 * @property {ServerMemberCommentDocument[]} documents - Visible member comments.
 * @property {string | null} lastDoc - Cursor for the next page.
 */

/**
 * Checks whether a Firestore payload has been soft-deleted.
 * @param {Record<string, unknown>} data - Firestore document data.
 * @returns {boolean} Whether the payload has a deletedAt field.
 */
function isSoftDeletedData(data) {
  return Object.prototype.hasOwnProperty.call(data, 'deletedAt');
}

/**
 * Returns a bounded positive page size.
 * @param {unknown} value - Candidate page size.
 * @returns {number} Safe page size.
 */
function normalizePageSize(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(numberValue), MAX_PAGE_SIZE);
}

/**
 * Returns a bounded raw comment scan budget for one server request.
 * @param {unknown} value - Candidate raw read budget.
 * @param {number} pageSize - Safe public page size.
 * @returns {number} Raw comment read budget.
 */
function normalizeRawReadBudget(value, pageSize) {
  const fallback = pageSize * RAW_READ_BUDGET_FACTOR;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return fallback;
  return Math.max(1, Math.floor(numberValue));
}

/**
 * Checks whether a cursor path points to an allowed comment document path.
 * @param {string} cursor - Candidate cursor path.
 * @returns {boolean} Whether the path is a post/event comment path.
 */
function isAllowedCommentCursorPath(cursor) {
  return /^(posts|events)\/[^/]+\/comments\/[^/]+$/.test(cursor);
}

/**
 * Validates and loads a cursor snapshot for a member comment query.
 * @param {object} params - Cursor validation params.
 * @param {string} params.uid - Authenticated user uid.
 * @param {string | null} params.afterCursor - Candidate cursor path.
 * @param {(cursor: string) => Promise<{ exists?: boolean, data: () => Record<string, unknown> } | undefined | null>} params.fetchCursorSnapshot - Cursor snapshot loader.
 * @returns {Promise<{ exists?: boolean, data: () => Record<string, unknown> } | null>} Valid cursor snapshot.
 */
async function loadValidMemberCommentCursor({ uid, afterCursor, fetchCursorSnapshot }) {
  if (!afterCursor) return null;
  if (!isAllowedCommentCursorPath(afterCursor)) {
    throw new InvalidMemberCommentsCursorError();
  }

  const cursorSnapshot = await fetchCursorSnapshot(afterCursor);
  const cursorData = cursorSnapshot?.data() ?? {};
  if (!cursorSnapshot?.exists || cursorData.authorUid !== uid) {
    throw new InvalidMemberCommentsCursorError();
  }

  return cursorSnapshot;
}

/**
 * Serializes Firestore values crossing the API boundary.
 * @param {unknown} value - Firestore value.
 * @returns {unknown} JSON-safe value.
 */
function serializeFirestoreValue(value) {
  if (value && typeof value === 'object') {
    if (typeof /** @type {{ toDate?: unknown }} */ (value).toDate === 'function') {
      return /** @type {{ toDate: () => Date }} */ (value).toDate().toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => serializeFirestoreValue(item));
    }

    return Object.fromEntries(
      Object.entries(/** @type {Record<string, unknown>} */ (value)).map(([key, nestedValue]) => [
        key,
        serializeFirestoreValue(nestedValue),
      ]),
    );
  }

  return value;
}

/**
 * Serializes a Firestore document payload for API responses.
 * @param {Record<string, unknown>} data - Raw Firestore data.
 * @returns {Record<string, unknown>} JSON-safe data.
 */
function serializeFirestoreData(data) {
  return /** @type {Record<string, unknown>} */ (serializeFirestoreValue(data));
}

/**
 * Builds visible comment documents from Admin SDK collectionGroup snapshots.
 * Deleted comments are excluded. Post comments are excluded when the parent post
 * is missing or soft-deleted. Event comments keep the existing direct-comment behavior.
 * @param {Array<{ id: string, ref: { path: string, parent: { parent?: { id: string, path: string, parent?: { id?: string } } | null } }, data: () => Record<string, unknown> }>} snapshots - Comment snapshots.
 * @param {object} deps - Helper dependencies.
 * @param {(ref: { path: string }) => Promise<{ exists: boolean, data: () => Record<string, unknown> }>} deps.fetchParentSnapshot - Parent snapshot loader.
 * @returns {Promise<ServerMemberCommentDocument[]>} Visible normalized comments.
 */
export async function buildVisibleMemberCommentDocuments(snapshots, { fetchParentSnapshot }) {
  const normalized = await Promise.all(
    snapshots.map(async (snapshot) => {
      const data = snapshot.data() ?? {};
      if (isSoftDeletedData(data)) return null;

      const parentRef = snapshot.ref.parent.parent;
      const parentCollection = parentRef?.parent?.id;
      if (!parentRef || (parentCollection !== 'posts' && parentCollection !== 'events')) {
        return null;
      }

      const parentSnapshot = await fetchParentSnapshot(parentRef);
      const parentData = parentSnapshot.exists ? parentSnapshot.data() ?? {} : {};

      if (parentCollection === 'posts' && (!parentSnapshot.exists || isSoftDeletedData(parentData))) {
        return null;
      }

      return {
        id: snapshot.id,
        source: /** @type {'post' | 'event'} */ (parentCollection === 'posts' ? 'post' : 'event'),
        parentId: parentRef.id,
        parentTitle: typeof parentData.title === 'string' ? parentData.title : null,
        data: serializeFirestoreData(data),
        cursor: snapshot.ref.path,
      };
    }),
  );

  return /** @type {ServerMemberCommentDocument[]} */ (
    normalized.filter((document) => document !== null)
  );
}

/**
 * Loads one raw Admin SDK page after a cursor snapshot.
 * @param {object} params - Query params.
 * @param {string} params.uid - Authenticated user uid.
 * @param {object | null} params.afterSnapshot - Previous comment document snapshot.
 * @param {number} params.pageSize - Raw query page size.
 * @returns {Promise<Array<{ id: string, ref: { path: string, parent: { parent?: { id: string, path: string, parent?: { id?: string } } | null } }, data: () => Record<string, unknown> }>>} Raw comment snapshots.
 */
async function fetchRawCommentPageAfterSnapshot({ uid, afterSnapshot, pageSize }) {
  let query = adminDb
    .collectionGroup('comments')
    .where('authorUid', '==', uid)
    .orderBy('createdAt', 'desc')
    .limit(pageSize);

  if (afterSnapshot) {
    query = query.startAfter(afterSnapshot);
  }

  const snapshot = await query.get();
  return snapshot.docs;
}

/**
 * Fetches a visible member comments page with cursor validation and a raw scan budget.
 * @param {object} params - Page params.
 * @param {string} params.uid - Authenticated user uid.
 * @param {string | null} [params.afterCursor] - Previous API cursor.
 * @param {number} [params.pageSize] - Public page size.
 * @param {number} [params.rawReadBudget] - Maximum raw comment docs scanned in this request.
 * @param {(cursor: string) => Promise<{ exists?: boolean, data: () => Record<string, unknown> } | undefined | null>} params.fetchCursorSnapshot - Cursor snapshot loader.
 * @param {(params: { uid: string, afterSnapshot: object | null, pageSize: number }) => Promise<Array<{ id: string, ref: { path: string, parent: { parent?: { id: string, path: string, parent?: { id?: string } } | null } }, data: () => Record<string, unknown> }>>} params.fetchRawCommentPage - Raw comment page loader.
 * @param {(ref: { path: string }) => Promise<{ exists: boolean, data: () => Record<string, unknown> }>} params.fetchParentSnapshot - Parent snapshot loader.
 * @returns {Promise<ServerMemberCommentsPage>} Visible comments page.
 */
export async function fetchVisibleMemberCommentDocumentsPage({
  uid,
  afterCursor = null,
  pageSize = DEFAULT_PAGE_SIZE,
  rawReadBudget,
  fetchCursorSnapshot,
  fetchRawCommentPage,
  fetchParentSnapshot,
}) {
  const safePageSize = normalizePageSize(pageSize);
  let remainingRawReads = normalizeRawReadBudget(rawReadBudget, safePageSize);
  let afterSnapshot = await loadValidMemberCommentCursor({
    uid,
    afterCursor,
    fetchCursorSnapshot,
  });
  /** @type {ServerMemberCommentDocument[]} */
  const documents = [];
  let continuationCursor = null;

  /**
   * Loads raw pages until the visible page is full, the raw query ends, or the budget is spent.
   * @returns {Promise<void>} Completion.
   */
  async function loadNextPage() {
    if (documents.length >= safePageSize || remainingRawReads <= 0) return;

    const rawDocuments = await fetchRawCommentPage({
      uid,
      afterSnapshot,
      pageSize: Math.min(safePageSize, remainingRawReads),
    });

    if (rawDocuments.length === 0) {
      continuationCursor = null;
      return;
    }

    remainingRawReads -= rawDocuments.length;
    const visibleDocuments = await buildVisibleMemberCommentDocuments(rawDocuments, {
      fetchParentSnapshot,
    });

    for (const document of visibleDocuments) {
      documents.push(document);
      if (documents.length >= safePageSize) break;
    }

    const lastRawDocument = rawDocuments[rawDocuments.length - 1];
    afterSnapshot = lastRawDocument;
    continuationCursor = lastRawDocument?.ref?.path ?? null;

    if (rawDocuments.length < safePageSize) {
      continuationCursor = null;
      return;
    }

    await loadNextPage();
  }

  await loadNextPage();

  return {
    documents,
    lastDoc:
      documents.length >= safePageSize
        ? documents[documents.length - 1]?.cursor ?? null
        : continuationCursor,
  };
}

/**
 * Fetches one server-authorized page of visible member comments.
 * @param {object} params - Page params.
 * @param {string} params.uid - Authenticated user uid.
 * @param {string | null} [params.afterCursor] - Previous API cursor.
 * @param {number} [params.pageSize] - Public page size.
 * @returns {Promise<ServerMemberCommentsPage>} Visible comments page.
 */
export async function fetchMemberCommentDocumentsPageByAuthorUid({
  uid,
  afterCursor = null,
  pageSize = DEFAULT_PAGE_SIZE,
}) {
  return fetchVisibleMemberCommentDocumentsPage({
    uid,
    afterCursor,
    pageSize,
    fetchCursorSnapshot: (cursor) => adminDb.doc(cursor).get(),
    fetchRawCommentPage: fetchRawCommentPageAfterSnapshot,
    fetchParentSnapshot: (ref) => adminDb.doc(ref.path).get(),
  });
}

export { InvalidMemberCommentsCursorError };
