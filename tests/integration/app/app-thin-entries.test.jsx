import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PublicProfilePage, {
  generateMetadata as generateUserMetadata,
} from '@/app/users/[uid]/page';
import EventDetailPage, {
  generateMetadata as generateEventMetadata,
} from '@/app/events/[id]/page';
import PostDetailPage, {
  generateMetadata as generatePostMetadata,
} from '@/app/posts/[id]/page';
import ProfileClient from '@/app/users/[uid]/ProfileClient';
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import PostDetailClient from '@/app/posts/[id]/PostDetailClient';
import { notFound } from 'next/navigation';

const {
  mockAdminCollection,
  mockAdminDoc,
  mockAdminGet,
  mockClientDoc,
  mockClientGetDoc,
  mockNotFound,
} = vi.hoisted(() => ({
  mockAdminCollection: vi.fn(),
  mockAdminDoc: vi.fn(),
  mockAdminGet: vi.fn(),
  mockClientDoc: vi.fn(),
  mockClientGetDoc: vi.fn(),
  mockNotFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('firebase-admin', () => {
  const firestore = Object.assign(
    vi.fn(() => ({
      collection: mockAdminCollection,
    })),
    {
      FieldValue: {
        serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
      },
      Timestamp: {
        fromDate: vi.fn((date) => ({ toDate: () => date })),
      },
    },
  );
  const admin = {
    apps: [{}],
    auth: vi.fn(() => ({})),
    credential: {
      applicationDefault: vi.fn(() => ({})),
    },
    firestore,
    initializeApp: vi.fn(),
  };
  return { default: admin };
});

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'test-app' })),
}));

vi.mock('firebase/auth', () => ({
  connectAuthEmulator: vi.fn(),
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(
    function GoogleAuthProvider() {
      this.setCustomParameters = vi.fn();
    },
  ),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  connectStorageEmulator: vi.fn(),
  getStorage: vi.fn(() => ({})),
}));

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  collection: vi.fn((_db, ...segments) => ({ path: segments.join('/') })),
  collectionGroup: vi.fn((_db, groupId) => ({ path: groupId })),
  connectFirestoreEmulator: vi.fn(),
  deleteField: vi.fn(() => ({ __type: 'deleteField' })),
  doc: mockClientDoc,
  documentId: vi.fn(() => '__name__'),
  getDoc: mockClientGetDoc,
  getDocs: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  increment: vi.fn((value) => ({ __type: 'increment', value })),
  limit: vi.fn((count) => ({ type: 'limit', count })),
  orderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  startAfter: vi.fn((...cursor) => ({ type: 'startAfter', cursor })),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
  updateDoc: vi.fn(),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  writeBatch: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
}));

vi.mock('@/app/users/[uid]/ProfileClient', () => ({
  default: vi.fn(({ user }) => React.createElement('profile-client-boundary', { user })),
}));

vi.mock('@/app/events/[id]/eventDetailClient', () => ({
  default: vi.fn(({ id }) => React.createElement('event-detail-client-boundary', { id })),
}));

vi.mock('@/app/posts/[id]/PostDetailClient', () => ({
  default: vi.fn(({ postId }) => React.createElement('post-detail-client-boundary', { postId })),
}));

const mockedNotFound = /** @type {import('vitest').Mock} */ (/** @type {unknown} */ (notFound));
const mockedProfileClient = /** @type {import('vitest').Mock} */ (ProfileClient);
const mockedEventDetailClient = /** @type {import('vitest').Mock} */ (EventDetailClient);
const mockedPostDetailClient = /** @type {import('vitest').Mock} */ (PostDetailClient);

/**
 * @typedef {object} FirestoreSnapshot
 * @property {string} id - 文件 ID。
 * @property {() => boolean} exists - 文件是否存在。
 * @property {() => Record<string, unknown>} data - 文件資料。
 */

/**
 * 建立 browser Firestore SDK document snapshot mock。
 * @param {string} id - 文件 ID。
 * @param {Record<string, unknown> | null} data - 文件資料；null 表示不存在。
 * @returns {FirestoreSnapshot} 文件 snapshot。
 */
function createClientSnapshot(id, data) {
  return {
    id,
    exists: () => data !== null,
    data: () => data ?? {},
  };
}

/**
 * 建立 Admin SDK document snapshot mock。
 * @param {Record<string, unknown> | null} data - 文件資料；null 表示不存在。
 * @returns {{ exists: boolean, data: () => Record<string, unknown> }} 文件 snapshot。
 */
function createAdminSnapshot(data) {
  return {
    exists: data !== null,
    data: () => data ?? {},
  };
}

/**
 * 建立可轉成 Date 的 timestamp-like fixture。
 * @param {Date} date - 要回傳的日期。
 * @returns {{ toDate: () => Date }} timestamp-like 物件。
 */
function createTimestamp(date) {
  return { toDate: () => date };
}

/**
 * 設定 `users/{uid}` Admin SDK 讀取結果。
 * @param {Record<string, unknown> | null} data - profile 文件資料。
 * @returns {void}
 */
function setAdminUserSnapshot(data) {
  mockAdminGet.mockResolvedValueOnce(createAdminSnapshot(data));
}

/**
 * 設定 browser Firestore `getDoc` 讀取結果。
 * @param {string} id - 文件 ID。
 * @param {Record<string, unknown> | null} data - 文件資料。
 * @returns {void}
 */
function setClientDocumentSnapshot(id, data) {
  mockClientGetDoc.mockResolvedValueOnce(createClientSnapshot(id, data));
}

describe('App thin entries metadata and RSC handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminCollection.mockReturnValue({ doc: mockAdminDoc });
    mockAdminDoc.mockReturnValue({ get: mockAdminGet });
    mockClientDoc.mockImplementation((_db, collectionName, id) => ({
      path: `${collectionName}/${String(id)}`,
      id: String(id),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('users/[uid]/page', () => {
    it('generates profile metadata from the public profile document', async () => {
      // Arrange
      setAdminUserSnapshot({
        uid: 'runner-1',
        name: 'Ada Runner',
        photoURL: 'https://example.com/ada.png',
        bio: 'Morning tempo runs.',
        createdAt: createTimestamp(new Date('2025-03-01T00:00:00.000Z')),
      });

      // Act
      const metadata = await generateUserMetadata({ params: Promise.resolve({ uid: 'runner-1' }) });

      // Assert
      expect(metadata).toEqual({
        title: 'Ada Runner — Dive into Run',
        description: 'Morning tempo runs.',
        openGraph: {
          title: 'Ada Runner — Dive into Run',
          description: 'Morning tempo runs.',
          images: [{ url: 'https://example.com/ada.png' }],
        },
      });
      expect(mockAdminCollection).toHaveBeenCalledWith('users');
      expect(mockAdminDoc).toHaveBeenCalledWith('runner-1');
    });

    it('returns fallback metadata when the profile is missing', async () => {
      // Arrange
      setAdminUserSnapshot(null);

      // Act
      const metadata = await generateUserMetadata({ params: Promise.resolve({ uid: 'missing' }) });

      // Assert
      expect(metadata).toEqual({
        title: '找不到使用者 — Dive into Run',
        description: '找不到此使用者的公開檔案。',
      });
    });

    it('delegates missing profiles to Next notFound', async () => {
      // Arrange
      setAdminUserSnapshot(null);

      // Act
      const action = PublicProfilePage({ params: Promise.resolve({ uid: 'missing' }) });

      // Assert
      await expect(action).rejects.toThrow('NEXT_NOT_FOUND');
      expect(mockedNotFound).toHaveBeenCalled();
    });

    it('serializes profile timestamps and hands the profile to ProfileClient', async () => {
      // Arrange
      const createdAt = new Date('2025-04-15T08:30:00.000Z');
      setAdminUserSnapshot({
        uid: 'runner-2',
        name: 'Grace Runner',
        photoURL: 'https://example.com/grace.png',
        bio: 'Trail crew lead.',
        createdAt: createTimestamp(createdAt),
      });

      // Act
      const element = await PublicProfilePage({ params: Promise.resolve({ uid: 'runner-2' }) });

      // Assert
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(ProfileClient);
      expect(element.props.user).toEqual({
        uid: 'runner-2',
        name: 'Grace Runner',
        photoURL: 'https://example.com/grace.png',
        bio: 'Trail crew lead.',
        createdAt,
      });
      expect(element.props.user.createdAt).toBeInstanceOf(Date);
      expect(mockedProfileClient).not.toHaveBeenCalled();
    });
  });

  describe('events/[id]/page', () => {
    it('generates event metadata from event detail data', async () => {
      // Arrange
      setClientDocumentSnapshot('event-1', {
        title: 'Saturday Long Run',
        time: createTimestamp(new Date('2026-05-09T00:00:00.000Z')),
        city: '臺北市',
        district: '大安區',
      });

      // Act
      const metadata = await generateEventMetadata({ params: Promise.resolve({ id: 'event-1' }) });

      // Assert
      expect(metadata).toMatchObject({
        title: 'Saturday Long Run',
        description: '「2026/05/09 · 臺北市大安區」',
        openGraph: {
          title: 'Saturday Long Run',
          description: '「2026/05/09 · 臺北市大安區」',
          images: ['/og-default.png'],
          url: '/events/event-1',
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Saturday Long Run',
          description: '「2026/05/09 · 臺北市大安區」',
          images: ['/og-default.png'],
        },
      });
      expect(mockClientDoc).toHaveBeenCalledWith({}, 'events', 'event-1');
    });

    it('uses fallback event metadata when the event is missing', async () => {
      // Arrange
      setClientDocumentSnapshot('missing', null);

      // Act
      const metadata = await generateEventMetadata({ params: Promise.resolve({ id: 'missing' }) });

      // Assert
      expect(metadata).toMatchObject({
        title: 'Dive Into Run',
        description: 'Dive Into Run 跑步社群平台',
        openGraph: {
          url: '/events/missing',
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Dive Into Run',
        },
      });
    });

    it('hands the normalized route id to EventDetailClient', async () => {
      // Arrange
      const numericRouteParams = /** @type {Promise<{ id: string }>} */ (
        /** @type {unknown} */ (Promise.resolve({ id: 123 }))
      );

      // Act
      const element = await EventDetailPage({ params: numericRouteParams });

      // Assert
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(EventDetailClient);
      expect(element.props.id).toBe('123');
      expect(mockedEventDetailClient).not.toHaveBeenCalled();
    });
  });

  describe('posts/[id]/page', () => {
    it('generates post metadata from post detail data', async () => {
      // Arrange
      setClientDocumentSnapshot('post-1', {
        title: 'Race Notes',
        content: '<p>Intervals and <strong>hill repeats</strong>.</p>',
      });

      // Act
      const metadata = await generatePostMetadata({ params: Promise.resolve({ id: 'post-1' }) });

      // Assert
      expect(metadata).toMatchObject({
        title: 'Race Notes',
        description: '「Race Notes — Intervals and hill repeats.」',
        openGraph: {
          title: 'Race Notes',
          description: '「Race Notes — Intervals and hill repeats.」',
          images: ['/og-default.png'],
          url: '/posts/post-1',
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Race Notes',
          description: '「Race Notes — Intervals and hill repeats.」',
          images: ['/og-default.png'],
        },
      });
      expect(mockClientDoc).toHaveBeenCalledWith({}, 'posts', 'post-1');
    });

    it('uses fallback post metadata when the post is missing', async () => {
      // Arrange
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      setClientDocumentSnapshot('missing', null);

      // Act
      const metadata = await generatePostMetadata({ params: Promise.resolve({ id: 'missing' }) });

      // Assert
      expect(metadata).toMatchObject({
        title: 'Dive Into Run',
        description: 'Dive Into Run 跑步社群平台',
        openGraph: {
          url: '/posts/missing',
        },
        twitter: {
          card: 'summary_large_image',
          title: 'Dive Into Run',
        },
      });
    });

    it('hands the route postId to PostDetailClient', async () => {
      // Act
      const element = await PostDetailPage({ params: Promise.resolve({ id: 'post-2' }) });

      // Assert
      expect(React.isValidElement(element)).toBe(true);
      expect(element.type).toBe(PostDetailClient);
      expect(element.props.postId).toBe('post-2');
      expect(mockedPostDetailClient).not.toHaveBeenCalled();
    });
  });
});
