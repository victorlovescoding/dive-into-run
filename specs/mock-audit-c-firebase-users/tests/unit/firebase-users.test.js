/**
 * @file Unit Test for src/lib/firebase-users.js
 * @description
 * Self-test for firebase-users — 覆蓋 Session C mock-audit 黑洞（0/26 lines → 26/26）。
 * 不 mock `@/lib/firebase-users`，mock 邊界在 `firebase/firestore` + `@/lib/firebase-client`。
 * 對應 4 exports：loginCheckUserData、updateUserName、watchUserProfile、updateUserPhotoURL。
 *
 * Pattern 對齊 specs/005-event-comments/tests/unit/firebase-comments.test.js。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loginCheckUserData,
  updateUserName,
  watchUserProfile,
  updateUserPhotoURL,
} from '@/lib/firebase-users';

// ---------------------------------------------------------------------------
// Module-level mocks (via vi.hoisted so they exist when vi.mock factory runs)
// ---------------------------------------------------------------------------

const { mockDoc, mockGetDoc, mockSetDoc, mockOnSnapshot, mockServerTimestamp } = vi.hoisted(() => ({
  mockDoc: vi.fn(() => 'mock-doc-ref'),
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockOnSnapshot: vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  onSnapshot: mockOnSnapshot,
  serverTimestamp: mockServerTimestamp,
}));

vi.mock('@/lib/firebase-client', () => ({ db: 'mock-db' }));

// ---------------------------------------------------------------------------
// Typedefs
// ---------------------------------------------------------------------------

/**
 * @typedef {object} MockFbUser
 * @property {string} uid - Firebase Auth 使用者 UID。
 * @property {string} displayName - 使用者顯示名稱。
 * @property {string} email - 使用者 email。
 * @property {string} photoURL - 大頭貼 URL。
 */

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('firebase-users › loginCheckUserData', () => {
  /** @type {MockFbUser} */
  const fbUser = {
    uid: 'user-1',
    displayName: 'Alice',
    email: 'alice@example.com',
    photoURL: 'https://example.com/alice.jpg',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mock-doc-ref');
  });

  it('doc 已存在時不呼叫 setDoc', async () => {
    // Arrange
    mockGetDoc.mockResolvedValueOnce(
      /** @type {import('firebase/firestore').DocumentSnapshot} */ (
        /** @type {unknown} */ ({ exists: () => true })
      ),
    );

    // Act
    await loginCheckUserData(fbUser);

    // Assert
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('doc 不存在時 setDoc 帶完整 user 欄位 + merge', async () => {
    // Arrange
    mockGetDoc.mockResolvedValueOnce(
      /** @type {import('firebase/firestore').DocumentSnapshot} */ (
        /** @type {unknown} */ ({ exists: () => false })
      ),
    );
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Act
    await loginCheckUserData(fbUser);

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'users', 'user-1');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [docRef, payload, options] = mockSetDoc.mock.calls[0];
    expect(docRef).toBe('mock-doc-ref');
    expect(payload).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
      uid: 'user-1',
      photoURL: 'https://example.com/alice.jpg',
      createdAt: { _serverTimestamp: true },
    });
    expect(options).toEqual({ merge: true });

    warnSpy.mockRestore();
  });

  it('getDoc reject 時 re-throw 並 console.error', async () => {
    // Arrange
    const boom = new Error('boom');
    mockGetDoc.mockRejectedValueOnce(boom);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act & Assert
    await expect(loginCheckUserData(fbUser)).rejects.toThrow('boom');
    expect(errSpy).toHaveBeenCalledWith(boom);

    errSpy.mockRestore();
  });
});

describe('firebase-users › updateUserName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mock-doc-ref');
  });

  it('正常路徑 → setDoc 帶 trim 後的 name + nameChangedAt + merge', async () => {
    // Act
    await updateUserName('u1', '  Alice  ');

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'users', 'u1');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [docRef, payload, options] = mockSetDoc.mock.calls[0];
    expect(docRef).toBe('mock-doc-ref');
    expect(payload).toEqual({ name: 'Alice', nameChangedAt: { _serverTimestamp: true } });
    expect(options).toEqual({ merge: true });
  });

  it('空 uid 時 throw "沒有uid"', async () => {
    await expect(updateUserName('', 'Alice')).rejects.toThrow('沒有uid');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('空 name 時 throw "沒有名字"', async () => {
    await expect(updateUserName('u1', '')).rejects.toThrow('沒有名字');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('null / undefined / whitespace-only name 都走 "?? \'\'"+trim fallback 並 throw "沒有名字"', async () => {
    await expect(
      updateUserName('u1', /** @type {string} */ (/** @type {unknown} */ (null))),
    ).rejects.toThrow('沒有名字');
    await expect(
      updateUserName('u1', /** @type {string} */ (/** @type {unknown} */ (undefined))),
    ).rejects.toThrow('沒有名字');
    await expect(updateUserName('u1', '   ')).rejects.toThrow('沒有名字');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

describe('firebase-users › watchUserProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mock-doc-ref');
  });

  it('正常呼叫時回傳 onSnapshot 的 unsubscribe 函式', () => {
    // Arrange
    const unsub = vi.fn();
    mockOnSnapshot.mockReturnValueOnce(unsub);

    // Act
    const result = watchUserProfile('u1', vi.fn(), vi.fn());

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'users', 'u1');
    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    expect(result).toBe(unsub);
  });

  it('空 uid 時同步 throw "uid required"', () => {
    expect(() => watchUserProfile('', vi.fn(), vi.fn())).toThrow('uid required');
    expect(mockOnSnapshot).not.toHaveBeenCalled();
  });

  it('onSnapshot success callback 拿到 snap.data() 有值時 onData 被呼叫帶該值', () => {
    // Arrange
    mockOnSnapshot.mockReturnValueOnce(vi.fn());
    const onData = vi.fn();

    // Act
    watchUserProfile('u1', onData, vi.fn());
    const successCb = mockOnSnapshot.mock.calls[0][1];
    successCb({ data: () => ({ name: 'Alice' }) });

    // Assert
    expect(onData).toHaveBeenCalledWith({ name: 'Alice' });
  });

  it('snap.data() === undefined 時 onData 收到 null', () => {
    // Arrange
    mockOnSnapshot.mockReturnValueOnce(vi.fn());
    const onData = vi.fn();

    // Act
    watchUserProfile('u1', onData, vi.fn());
    const successCb = mockOnSnapshot.mock.calls[0][1];
    successCb({ data: () => undefined });

    // Assert
    expect(onData).toHaveBeenCalledWith(null);
  });

  it('onSnapshot error callback 觸發時 onError 被呼叫', () => {
    // Arrange
    mockOnSnapshot.mockReturnValueOnce(vi.fn());
    const onError = vi.fn();
    const err = new Error('snapshot failed');

    // Act
    watchUserProfile('u1', vi.fn(), onError);
    const errorCb = mockOnSnapshot.mock.calls[0][2];
    errorCb(err);

    // Assert
    expect(onError).toHaveBeenCalledWith(err);
  });
});

describe('firebase-users › updateUserPhotoURL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDoc.mockReturnValue('mock-doc-ref');
  });

  it('正常路徑 → setDoc 帶 photoURL + photoUpdatedAt + merge', async () => {
    // Act
    await updateUserPhotoURL('https://example.com/new.jpg', 'u1');

    // Assert
    expect(mockDoc).toHaveBeenCalledWith('mock-db', 'users', 'u1');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [docRef, payload, options] = mockSetDoc.mock.calls[0];
    expect(docRef).toBe('mock-doc-ref');
    expect(payload).toEqual({
      photoURL: 'https://example.com/new.jpg',
      photoUpdatedAt: { _serverTimestamp: true },
    });
    expect(options).toEqual({ merge: true });
  });

  it('空 url 時 throw "沒有url"', async () => {
    await expect(updateUserPhotoURL('', 'u1')).rejects.toThrow('沒有url');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('空 uid 時 throw "沒有uid"', async () => {
    await expect(updateUserPhotoURL('https://example.com/x.jpg', '')).rejects.toThrow('沒有uid');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});
