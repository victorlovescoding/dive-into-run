/**
 * 建立 Timestamp-like 測試物件。
 * @param {string} iso - ISO 日期字串。
 * @returns {import('firebase/firestore').Timestamp} Timestamp-like。
 */
function createTimestamp(iso) {
  const date = new Date(iso);
  return /** @type {import('firebase/firestore').Timestamp} */ (
    /** @type {unknown} */ ({
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
      toDate: () => date,
      toMillis: () => date.getTime(),
      isEqual: () => false,
      toJSON: () => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }),
    })
  );
}

/**
 * 建立測試使用者。
 * @param {Partial<{ uid: string, name: string | null, email: string | null, photoURL: string | null, bio: string | null, getIdToken: () => Promise<string> }>} [overrides] - 覆寫欄位。
 * @returns {{ uid: string, name: string | null, email: string | null, photoURL: string | null, bio: string | null, getIdToken: () => Promise<string> }} 使用者。
 */
export function createTestUser(overrides = {}) {
  return {
    uid: 'user-1',
    name: 'Alice',
    email: 'alice@example.com',
    photoURL: 'https://example.com/alice.png',
    bio: null,
    getIdToken: async () => 'token-1',
    ...overrides,
  };
}

/**
 * 建立文章 fixture。
 * @param {number} index - 序號。
 * @param {Partial<import('@/service/post-service').Post>} [overrides] - 覆寫欄位。
 * @returns {import('@/service/post-service').Post} 文章 fixture。
 */
export function createPostFixture(index, overrides = {}) {
  return {
    id: `post-${index}`,
    authorUid: index % 2 === 0 ? 'user-2' : 'user-1',
    authorName: `Runner ${index}`,
    authorImgURL: `https://example.com/runner-${index}.png`,
    title: `Post ${index}`,
    content: `Content ${index}`,
    postAt: createTimestamp(`2030-01-${String(index).padStart(2, '0')}T07:00:00Z`),
    likesCount: index,
    commentsCount: index + 1,
    ...overrides,
  };
}

/**
 * 建立多筆文章 fixture。
 * @param {number} count - 筆數。
 * @param {number} [startIndex] - 起始序號。
 * @param {(index: number) => Partial<import('@/service/post-service').Post>} [getOverrides] - 每筆覆寫函式。
 * @returns {import('@/service/post-service').Post[]} 文章列表。
 */
export function createPostList(count, startIndex = 1, getOverrides) {
  return Array.from({ length: count }, (_, offset) => {
    const index = startIndex + offset;
    return createPostFixture(index, getOverrides ? getOverrides(index) : {});
  });
}

/**
 * 建立 Firestore-like document snapshot。
 * @param {string} id - 文件 ID。
 * @param {object | null} data - 文件資料。
 * @returns {{ id: string, ref: { id: string, path: string }, exists: () => boolean, data: () => object | null }} snapshot。
 */
export function createDocumentSnapshot(id, data) {
  return {
    id,
    ref: { id, path: `mock/${id}` },
    exists: () => data !== null,
    data: () => data,
  };
}

/**
 * 建立 Firestore-like query snapshot。
 * @param {Array<{ id: string, data: () => object | null, ref?: { id: string, path: string } }>} docs - 文件列表。
 * @returns {{ docs: Array<{ id: string, data: () => object | null, ref: { id: string, path: string } }>, size: number }} query snapshot。
 */
export function createQuerySnapshot(docs) {
  return {
    docs: docs.map((doc) => ({
      ...doc,
      ref: doc.ref ?? { id: doc.id, path: `mock/${doc.id}` },
    })),
    size: docs.length,
  };
}

/**
 * 建立 posts query document snapshot。
 * @param {import('@/service/post-service').Post} post - 文章資料。
 * @returns {{ id: string, data: () => import('@/service/post-service').Post, ref: { id: string, path: string } }} snapshot。
 */
export function createPostDoc(post) {
  return {
    id: String(post.id),
    data: () => post,
    ref: { id: String(post.id), path: `posts/${String(post.id)}` },
  };
}

/**
 * 建立 collection sub-doc snapshot，供 cascade delete 使用。
 * @param {string} path - 文件路徑。
 * @returns {{ id: string, data: () => object, ref: { id: string, path: string } }} snapshot。
 */
export function createCollectionDoc(path) {
  const id = path.split('/').at(-1) ?? 'doc';
  return {
    id,
    data: () => ({ id }),
    ref: { id, path },
  };
}

/**
 * 建立 getDocs dispatcher，依 query path 與 constraint 決定回傳資料。
 * @param {object} options - 設定。
 * @param {import('@/service/post-service').Post[]} [options.latestPosts] - 初始頁資料。
 * @param {import('@/service/post-service').Post[]} [options.nextPosts] - 下一頁資料。
 * @param {string[]} [options.likedPostIds] - 使用者已按讚文章 ID。
 * @param {Record<string, Array<{ id: string, data: () => object, ref: { id: string, path: string } }>>} [options.collectionDocs] - 指定 collection path 回傳內容。
 * @returns {(ref: { path?: string, constraints?: Array<{ type?: string }> }) => Promise<{ docs: Array<{ id: string, data: () => object | null, ref: { id: string, path: string } }>, size: number }>} dispatcher。
 */
export function createDocsDispatcher({
  latestPosts = [],
  nextPosts = [],
  likedPostIds = [],
  collectionDocs = {},
} = {}) {
  return async (ref) => {
    const path = String(ref?.path ?? '');
    const constraints = ref?.constraints ?? [];

    if (path === 'likes') {
      return createQuerySnapshot(
        likedPostIds.map((postId) =>
          createDocumentSnapshot(`${postId}-like`, { uid: 'user-1', postId }),
        ),
      );
    }

    if (path === 'posts' && constraints.some((constraint) => constraint?.type === 'startAfter')) {
      return createQuerySnapshot(nextPosts.map(createPostDoc));
    }

    if (path === 'posts') {
      return createQuerySnapshot(latestPosts.map(createPostDoc));
    }

    return createQuerySnapshot(collectionDocs[path] ?? []);
  };
}
