import {
  getDocs,
  getDoc,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  doc,
} from 'firebase/firestore';
import { db } from '@/config/client/firebase-client';

/**
 * @typedef {import('firebase/firestore').QueryDocumentSnapshot} QueryDocumentSnapshot
 */

/**
 * @typedef {object} MyEventItem
 * @property {string} id - 活動 ID。
 * @property {string} title - 活動標題。
 * @property {import('firebase/firestore').Timestamp} time - 活動舉辦時間。
 * @property {string} location - 活動地點。
 * @property {string} city - 縣市。
 * @property {number} participantsCount - 目前報名人數。
 * @property {number} maxParticipants - 人數上限。
 * @property {string} hostUid - 主辦者 UID。
 */

/**
 * @typedef {object} MyCommentItem
 * @property {string} id - 留言 ID。
 * @property {'post' | 'event'} source - 來源類型。
 * @property {string} parentId - 所屬文章或活動 ID。
 * @property {string} parentTitle - 所屬文章或活動標題。
 * @property {string} text - 留言內容（正規化）。
 * @property {import('firebase/firestore').Timestamp} createdAt - 留言時間。
 */

/** @typedef {import('@/lib/firebase-posts').Post} Post */

/**
 * 取得使用者參加 + 主辦的所有活動 ID。
 * @param {string} uid - 使用者 UID。
 * @returns {Promise<{ participantIds: string[], hostedIds: string[] }>} 兩組活動 ID。
 */
export async function fetchMyEventIds(uid) {
  const [participantSnap, hostedSnap] = await Promise.all([
    getDocs(query(collectionGroup(db, 'participants'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'events'), where('hostUid', '==', uid))),
  ]);

  const participantIds = participantSnap.docs.map((d) => d.data().eventId);
  const hostedIds = hostedSnap.docs.map((d) => d.id);

  return { participantIds, hostedIds };
}

/**
 * 分頁取得使用者的活動列表，依活動時間由新到舊。
 *
 * 首次呼叫（prevResult 為 null）會做完整 fetch；後續呼叫透過 prevResult 取得快取直接 slice。
 * @param {string} uid - 使用者 UID。
 * @param {object} [options] - 分頁選項。
 * @param {{ allEvents: MyEventItem[], nextCursor: number | null, hostedIds: Set<string> } | null} [options.prevResult] - 前次呼叫的回傳結果。
 * @param {number} [options.pageSize] - 每頁筆數，預設 5。
 * @returns {Promise<{ items: MyEventItem[], nextCursor: number | null, hostedIds: Set<string>, allEvents: MyEventItem[] }>} 分頁結果。
 */
export async function fetchMyEvents(uid, options = {}) {
  const { prevResult = null, pageSize = 5 } = options;

  // Subsequent call — slice from cached array
  if (prevResult?.allEvents) {
    if (prevResult.nextCursor === null) {
      return {
        items: [],
        nextCursor: null,
        hostedIds: prevResult.hostedIds ?? new Set(),
        allEvents: prevResult.allEvents,
      };
    }
    const cachedEvents = prevResult.allEvents;
    const start = prevResult.nextCursor;
    const items = cachedEvents.slice(start, start + pageSize);
    const nextEnd = start + pageSize;
    const nextCursor = nextEnd < cachedEvents.length ? nextEnd : null;
    const { hostedIds } = prevResult;
    return { items, nextCursor, hostedIds, allEvents: cachedEvents };
  }

  // First call — full fetch
  const { participantIds, hostedIds: hostedIdsList } = await fetchMyEventIds(uid);

  // Deduplicate IDs
  const allIds = [...new Set([...participantIds, ...hostedIdsList])];

  // Batch getDoc
  const docResults = await Promise.all(allIds.map((id) => getDoc(doc(db, 'events', id))));

  // Filter existing docs, map to MyEventItem
  const allEvents = docResults
    .filter((snap) => snap.exists())
    .map((snap) => {
      const data = snap.data();
      return /** @type {MyEventItem} */ ({
        id: snap.id,
        ...data,
        participantsCount: data.participantsCount ?? 0,
      });
    });

  // Sort by time desc (client-side)
  allEvents.sort((a, b) => b.time.seconds - a.time.seconds);

  // Paginate
  const items = allEvents.slice(0, pageSize);
  const nextCursor = pageSize < allEvents.length ? pageSize : null;
  const hostedIds = new Set(hostedIdsList);

  return { items, nextCursor, hostedIds, allEvents };
}

/**
 * 分頁取得使用者發表的文章。
 * @param {string} uid - 使用者 UID。
 * @param {object} [options] - 分頁選項。
 * @param {{ lastDoc: QueryDocumentSnapshot | null } | null} [options.prevResult] - 前次呼叫的回傳結果。
 * @param {number} [options.pageSize] - 每頁筆數，預設 5。
 * @returns {Promise<{ items: Post[], lastDoc: QueryDocumentSnapshot | null }>} 分頁結果。
 */
export async function fetchMyPosts(uid, options = {}) {
  const { prevResult = null, pageSize = 5 } = options;
  const afterDoc = prevResult?.lastDoc ?? null;

  /** @type {import('firebase/firestore').QueryConstraint[]} */
  const constraints = [where('authorUid', '==', uid), orderBy('postAt', 'desc'), limit(pageSize)];

  if (afterDoc) {
    constraints.push(startAfter(afterDoc));
  }

  const snap = await getDocs(query(collection(db, 'posts'), ...constraints));

  const items = snap.docs.map((d) => /** @type {Post} */ ({ id: d.id, ...d.data() }));

  const lastDoc = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;

  return { items, lastDoc };
}

/**
 * 分頁取得使用者在文章與活動下的所有留言。
 * @param {string} uid - 使用者 UID。
 * @param {object} [options] - 分頁選項。
 * @param {{ lastDoc: QueryDocumentSnapshot | null, titleCache?: Map<string, string> } | null} [options.prevResult] - 前次呼叫的回傳結果。
 * @param {number} [options.pageSize] - 每頁筆數，預設 5。
 * @returns {Promise<{ items: MyCommentItem[], lastDoc: QueryDocumentSnapshot | null, titleCache: Map<string, string> }>} 分頁結果。
 */
export async function fetchMyComments(uid, options = {}) {
  const { prevResult = null, pageSize = 5 } = options;
  const afterDoc = prevResult?.lastDoc ?? null;
  const titleCache = prevResult?.titleCache ?? new Map();

  /** @type {import('firebase/firestore').QueryConstraint[]} */
  const constraints = [
    where('authorUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];

  if (afterDoc) {
    constraints.push(startAfter(afterDoc));
  }

  const snap = await getDocs(query(collectionGroup(db, 'comments'), ...constraints));

  // Determine source and normalize text for each comment
  const rawItems = snap.docs.map((d) => {
    const data = d.data();
    const parentCollection = d.ref.parent.parent.parent.id;
    /** @type {'post' | 'event'} */
    const source = parentCollection === 'posts' ? 'post' : 'event';
    const parentId = d.ref.parent.parent.id;
    const text = source === 'post' ? data.comment : data.content;

    return {
      id: d.id,
      source,
      parentId,
      text,
      createdAt: data.createdAt,
      /** @type {string} */
      parentTitle: '',
    };
  });

  // Collect unique parentIds that need title fetching
  const idsToFetch = [
    ...new Set(rawItems.map((item) => item.parentId).filter((id) => !titleCache.has(id))),
  ];

  // Batch getDoc for parent titles
  if (idsToFetch.length > 0) {
    const parentResults = await Promise.all(
      idsToFetch.map((id) => {
        // Determine collection from the items that reference this id
        const referencing = rawItems.find((item) => item.parentId === id);
        const col = referencing?.source === 'post' ? 'posts' : 'events';
        return getDoc(doc(db, col, id));
      }),
    );

    parentResults.forEach((parentSnap) => {
      const snapId = parentSnap.id;
      if (parentSnap.exists()) {
        titleCache.set(snapId, parentSnap.data().title);
      } else {
        titleCache.set(snapId, '(已刪除)');
      }
    });
  }

  // Assign titles from cache
  const items = rawItems.map(
    (item) =>
      /** @type {MyCommentItem} */ ({
        ...item,
        parentTitle: titleCache.get(item.parentId) ?? '(已刪除)',
      }),
  );

  const lastDoc = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;

  return { items, lastDoc, titleCache };
}
