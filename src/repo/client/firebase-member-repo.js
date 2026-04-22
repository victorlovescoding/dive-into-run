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
 * @typedef {import('firebase/firestore').QueryConstraint} QueryConstraint
 */

/**
 * @typedef {object} MemberFirestoreDocument
 * @property {string} id - Firestore document ID.
 * @property {Record<string, unknown>} data - Raw Firestore payload.
 */

/**
 * @typedef {object} MemberCommentDocument
 * @property {string} id - Comment document ID.
 * @property {'post' | 'event'} source - Parent collection source.
 * @property {string} parentId - Parent post/event ID.
 * @property {Record<string, unknown>} data - Raw comment payload.
 */

/**
 * @typedef {object} ParentTitleLookup
 * @property {string} parentId - Parent post/event ID.
 * @property {'post' | 'event'} source - Parent collection source.
 */

/**
 * @typedef {object} ParentTitleRecord
 * @property {string} parentId - Parent post/event ID.
 * @property {string | null} title - Parent title; null when parent doc is missing.
 */

/**
 * @typedef {object} PagedFirestoreDocumentsResult
 * @property {MemberFirestoreDocument[]} documents - Plain Firestore documents.
 * @property {QueryDocumentSnapshot | null} lastDoc - Firestore cursor for next page.
 */

/**
 * Returns the event ids where the user joined as participant.
 * @param {string} uid - Target user uid.
 * @returns {Promise<string[]>} Event ids collected from `participants` collectionGroup.
 */
export async function fetchParticipantEventIdsByUid(uid) {
  const snap = await getDocs(query(collectionGroup(db, 'participants'), where('uid', '==', uid)));
  return snap.docs.map((document) => document.data().eventId);
}

/**
 * Returns the event ids hosted by the user.
 * @param {string} uid - Target user uid.
 * @returns {Promise<string[]>} Hosted event ids.
 */
export async function fetchHostedEventIdsByUid(uid) {
  const snap = await getDocs(query(collection(db, 'events'), where('hostUid', '==', uid)));
  return snap.docs.map((document) => document.id);
}

/**
 * Fetches event documents by id and returns plain payloads for service/runtime layers.
 * Missing documents are filtered out here so upper layers only handle existing events.
 * @param {string[]} eventIds - Event ids to fetch.
 * @returns {Promise<MemberFirestoreDocument[]>} Existing event documents.
 */
export async function fetchEventDocumentsByIds(eventIds) {
  const snapshots = await Promise.all(eventIds.map((eventId) => getDoc(doc(db, 'events', eventId))));

  return snapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) => ({
      id: snapshot.id,
      data: /** @type {Record<string, unknown>} */ (snapshot.data() ?? {}),
    }));
}

/**
 * Fetches one page of posts authored by the target user.
 * @param {string} uid - Target user uid.
 * @param {object} [options] - Paging options.
 * @param {QueryDocumentSnapshot | null} [options.afterDoc] - Firestore cursor from previous page.
 * @param {number} [options.pageSize] - Number of items per page.
 * @returns {Promise<PagedFirestoreDocumentsResult>} Plain post documents plus next cursor.
 */
export async function fetchPostDocumentsPageByAuthorUid(uid, options = {}) {
  const { afterDoc = null, pageSize = 5 } = options;

  /** @type {QueryConstraint[]} */
  const constraints = [where('authorUid', '==', uid), orderBy('postAt', 'desc'), limit(pageSize)];

  if (afterDoc) {
    constraints.push(startAfter(afterDoc));
  }

  const snap = await getDocs(query(collection(db, 'posts'), ...constraints));

  return {
    documents: snap.docs.map((document) => ({
      id: document.id,
      data: /** @type {Record<string, unknown>} */ (document.data() ?? {}),
    })),
    lastDoc: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null,
  };
}

/**
 * Fetches one page of comment documents authored by the target user.
 * Firestore path traversal stays in repo so upper layers receive a normalized source/parent identity.
 * @param {string} uid - Target user uid.
 * @param {object} [options] - Paging options.
 * @param {QueryDocumentSnapshot | null} [options.afterDoc] - Firestore cursor from previous page.
 * @param {number} [options.pageSize] - Number of items per page.
 * @returns {Promise<{ documents: MemberCommentDocument[], lastDoc: QueryDocumentSnapshot | null }>} Normalized comment docs plus next cursor.
 */
export async function fetchCommentDocumentsPageByAuthorUid(uid, options = {}) {
  const { afterDoc = null, pageSize = 5 } = options;

  /** @type {QueryConstraint[]} */
  const constraints = [
    where('authorUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ];

  if (afterDoc) {
    constraints.push(startAfter(afterDoc));
  }

  const snap = await getDocs(query(collectionGroup(db, 'comments'), ...constraints));

  return {
    documents: snap.docs.map((document) => {
      const parentDoc = document.ref.parent.parent;
      const parentCollection = parentDoc?.parent?.id;

      return {
        id: document.id,
        source: parentCollection === 'posts' ? 'post' : 'event',
        parentId: parentDoc?.id ?? '',
        data: /** @type {Record<string, unknown>} */ (document.data() ?? {}),
      };
    }),
    lastDoc: snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null,
  };
}

/**
 * Fetches parent titles for posts/events referenced by member comments.
 * @param {ParentTitleLookup[]} lookups - Parent identifiers to resolve.
 * @returns {Promise<ParentTitleRecord[]>} Parent ids with resolved titles.
 */
export async function fetchParentTitlesByRefs(lookups) {
  const snapshots = await Promise.all(
    lookups.map(({ parentId, source }) =>
      getDoc(doc(db, source === 'post' ? 'posts' : 'events', parentId)),
    ),
  );

  return snapshots.map((snapshot) => ({
    parentId: snapshot.id,
    title: snapshot.exists() ? /** @type {string | null} */ (snapshot.data().title ?? null) : null,
  }));
}
