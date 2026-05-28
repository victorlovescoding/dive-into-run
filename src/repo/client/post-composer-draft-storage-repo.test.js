import { describe, expect, test, vi } from 'vitest';

import {
  getPostComposerDraftKey,
  loadPostComposerDraft,
  POST_COMPOSER_DRAFT_MAX_AGE_MS,
  removePostComposerDraft,
  savePostComposerDraft,
} from './post-composer-draft-storage-repo';

/**
 * @param {Record<string, string>} [initialEntries] - Initial key/value pairs.
 * @returns {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
 *   read(key: string): string | null,
 * }} In-memory storage shim for tests.
 */
function createMemoryStorage(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));

  return {
    getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
    setItem: vi.fn((key, value) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key) => {
      store.delete(key);
    }),
    read(key) {
      return store.has(key) ? store.get(key) : null;
    },
  };
}

/**
 * @param {() => void} callback - Assertions to run while localStorage access throws.
 * @returns {void}
 */
function withThrowingGlobalLocalStorage(callback) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('localStorage unavailable');
    },
  });

  try {
    callback();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', originalDescriptor);
    } else {
      delete globalThis.localStorage;
    }
  }
}

describe('post composer draft storage repo', () => {
  test('returns create draft key for null postId', () => {
    expect(getPostComposerDraftKey({ uid: 'u1', postId: null })).toBe(
      'post-composer:draft:create:u1',
    );
  });

  test('returns edit draft key for postId', () => {
    expect(getPostComposerDraftKey({ uid: 'u1', postId: 'p1' })).toBe(
      'post-composer:draft:edit:u1:p1',
    );
  });

  test('missing uid returns null and does not touch storage', () => {
    const storage = createMemoryStorage();

    expect(getPostComposerDraftKey({ uid: '', postId: null })).toBeNull();
    expect(loadPostComposerDraft({ uid: '', postId: null, storage })).toBeNull();

    savePostComposerDraft({
      uid: '',
      postId: null,
      title: 'Title',
      content: 'Body',
      storage,
    });
    removePostComposerDraft({ uid: '', postId: null, storage });

    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  test('saving a create draft stores only title, content, and updatedAt', () => {
    const storage = createMemoryStorage();
    const now = new Date('2026-05-28T10:00:00.000Z');

    savePostComposerDraft({
      uid: 'u1',
      postId: null,
      title: 'Draft title',
      content: 'Draft content',
      now,
      storage,
    });

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith(
      'post-composer:draft:create:u1',
      expect.any(String),
    );

    const savedPayload = JSON.parse(storage.read('post-composer:draft:create:u1'));
    expect(Object.keys(savedPayload).sort()).toEqual(['content', 'title', 'updatedAt']);
    expect(savedPayload).toEqual({
      title: 'Draft title',
      content: 'Draft content',
      updatedAt: '2026-05-28T10:00:00.000Z',
    });
  });

  test('loading a valid draft returns title, content, and updatedAt', () => {
    const updatedAt = '2026-05-28T10:00:00.000Z';
    const storage = createMemoryStorage({
      'post-composer:draft:create:u1': JSON.stringify({
        title: 'Draft title',
        content: 'Draft content',
        updatedAt,
      }),
    });

    expect(
      loadPostComposerDraft({
        uid: 'u1',
        postId: null,
        now: new Date('2026-05-29T10:00:00.000Z'),
        storage,
      }),
    ).toEqual({
      title: 'Draft title',
      content: 'Draft content',
      updatedAt,
    });
  });

  test('removing an edit draft does not remove another edit draft', () => {
    const p1Key = 'post-composer:draft:edit:u1:p1';
    const p2Key = 'post-composer:draft:edit:u1:p2';
    const storage = createMemoryStorage({
      [p1Key]: 'p1 draft',
      [p2Key]: 'p2 draft',
    });

    removePostComposerDraft({ uid: 'u1', postId: 'p1', storage });

    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledWith(p1Key);
    expect(storage.read(p1Key)).toBeNull();
    expect(storage.read(p2Key)).toBe('p2 draft');
  });

  test('invalid JSON is removed and returns null', () => {
    const key = 'post-composer:draft:create:u1';
    const storage = createMemoryStorage({ [key]: '{invalid' });

    expect(
      loadPostComposerDraft({
        uid: 'u1',
        postId: null,
        now: new Date('2026-05-28T10:00:00.000Z'),
        storage,
      }),
    ).toBeNull();

    expect(storage.removeItem).toHaveBeenCalledWith(key);
    expect(storage.read(key)).toBeNull();
  });

  test.each([
    ['title', { title: 123, content: 'Body', updatedAt: '2026-05-28T10:00:00.000Z' }],
    ['content', { title: 'Title', content: null, updatedAt: '2026-05-28T10:00:00.000Z' }],
    ['updatedAt', { title: 'Title', content: 'Body', updatedAt: false }],
  ])('payloads with non-string %s are removed and return null', (_field, payload) => {
    const key = 'post-composer:draft:create:u1';
    const storage = createMemoryStorage({ [key]: JSON.stringify(payload) });

    expect(
      loadPostComposerDraft({
        uid: 'u1',
        postId: null,
        now: new Date('2026-05-28T10:00:00.000Z'),
        storage,
      }),
    ).toBeNull();

    expect(storage.removeItem).toHaveBeenCalledWith(key);
    expect(storage.read(key)).toBeNull();
  });

  test('draft older than max age is removed and returns null', () => {
    const now = new Date('2026-05-28T10:00:00.000Z');
    const expiredUpdatedAt = new Date(now.getTime() - POST_COMPOSER_DRAFT_MAX_AGE_MS - 1);
    const key = 'post-composer:draft:create:u1';
    const storage = createMemoryStorage({
      [key]: JSON.stringify({
        title: 'Old title',
        content: 'Old content',
        updatedAt: expiredUpdatedAt.toISOString(),
      }),
    });

    expect(loadPostComposerDraft({ uid: 'u1', postId: null, now, storage })).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(key);
    expect(storage.read(key)).toBeNull();
  });

  test('storage setItem, getItem, and removeItem exceptions do not throw', () => {
    expect(() =>
      savePostComposerDraft({
        uid: 'u1',
        postId: null,
        title: 'Title',
        content: 'Body',
        storage: {
          setItem() {
            throw new Error('setItem failed');
          },
        },
      }),
    ).not.toThrow();

    expect(() =>
      loadPostComposerDraft({
        uid: 'u1',
        postId: null,
        storage: {
          getItem() {
            throw new Error('getItem failed');
          },
          removeItem: vi.fn(),
        },
      }),
    ).not.toThrow();

    expect(() =>
      loadPostComposerDraft({
        uid: 'u1',
        postId: null,
        storage: {
          getItem: () => '{invalid',
          removeItem() {
            throw new Error('removeItem failed');
          },
        },
      }),
    ).not.toThrow();

    expect(() =>
      removePostComposerDraft({
        uid: 'u1',
        postId: null,
        storage: {
          removeItem() {
            throw new Error('removeItem failed');
          },
        },
      }),
    ).not.toThrow();
  });

  test('throwing global localStorage accessor does not throw without storage override', () => {
    withThrowingGlobalLocalStorage(() => {
      expect(() =>
        savePostComposerDraft({
          uid: 'u1',
          postId: null,
          title: 'Title',
          content: 'Body',
        }),
      ).not.toThrow();

      expect(() => loadPostComposerDraft({ uid: 'u1', postId: null })).not.toThrow();
      expect(loadPostComposerDraft({ uid: 'u1', postId: null })).toBeNull();

      expect(() => removePostComposerDraft({ uid: 'u1', postId: 'p1' })).not.toThrow();
    });
  });
});
