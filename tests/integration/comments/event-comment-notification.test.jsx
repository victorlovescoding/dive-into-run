/**
 * @file Integration Test — CommentSection onCommentAdded callback
 * @description
 * TDD RED phase — tests that CommentSection invokes an `onCommentAdded`
 * callback with the new comment's ID after a comment is successfully submitted.
 *
 * This callback will be used by the parent page to trigger notification
 * creation for event comment threads.
 *
 * Expected behavior (not yet implemented):
 * 1. CommentSection accepts an `onCommentAdded` callback prop.
 * 2. After `addComment` succeeds, `onCommentAdded(commentId)` is called.
 * 3. The hook `useCommentMutations` accepts an `onSuccess` callback internally.
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. Use `@testing-library/react` for rendering.
 * 3. Use `user-event` for interactions — NEVER low-level event helpers.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 * 6. AAA pattern (Arrange, Act, Assert) is mandatory.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthContext } from '@/contexts/AuthContext';
import CommentSection from '@/components/CommentSection';
import { addDoc, getDocs } from 'firebase/firestore';

/* ==========================================================================
   Mocks
   ========================================================================== */

const firestoreMock = vi.hoisted(() => {
  class MockTimestamp {
    /**
     * @param {Date} date - Timestamp date value.
     */
    constructor(date) {
      this.date = date;
    }

    /**
     * @returns {Date} Date value.
     */
    toDate() {
      return this.date;
    }

    /**
     * @returns {MockTimestamp} Current timestamp.
     */
    static now() {
      return new MockTimestamp(new Date(2026, 3, 2, 15, 0));
    }

    /**
     * @param {Date} date - Date value.
     * @returns {MockTimestamp} Timestamp value.
     */
    static fromDate(date) {
      return new MockTimestamp(date);
    }
  }

  return {
    Timestamp: MockTimestamp,
    serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
    collection: vi.fn((_, ...segments) => ({
      kind: 'collection',
      path: segments.join('/'),
    })),
    doc: vi.fn((base, ...segments) => {
      const path =
        base?.kind === 'collection'
          ? [base.path, ...segments].filter(Boolean).join('/')
          : segments.join('/');
      const id = segments.at(-1) || 'generated-history-id';
      return { kind: 'doc', id, path };
    }),
    query: vi.fn((ref, ...constraints) => ({ kind: 'query', ref, constraints })),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    addDoc: vi.fn(),
    orderBy: vi.fn((field, direction) => ({ kind: 'orderBy', field, direction })),
    limit: vi.fn((count) => ({ kind: 'limit', count })),
    startAfter: vi.fn((snapshot) => ({ kind: 'startAfter', snapshot })),
    runTransaction: vi.fn(),
    writeBatch: vi.fn(),
  };
});

vi.mock('firebase/firestore', () => firestoreMock);

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('@/contexts/AuthContext', async () => {
  const { createContext } = await import('react');
  return { AuthContext: createContext({ user: null }) };
});

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock('@/components/CommentCard', () => ({ default: () => <div /> }));
vi.mock('@/components/CommentEditModal', () => ({ default: () => null }));
vi.mock('@/components/CommentDeleteConfirm', () => ({ default: () => null }));
vi.mock('@/components/CommentHistoryModal', () => ({ default: () => null }));

/**
 * Mock CommentInput — exposes `onSubmit` via a simple form so integration
 * tests can trigger comment submission with a button click.
 */
vi.mock('@/components/CommentInput', () => ({
  default: ({ onSubmit, isSubmitting }) => (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit('test comment');
      }}
    >
      <button type="submit" disabled={isSubmitting}>
        送出
      </button>
    </form>
  ),
}));

/* Cast mock for .mockResolvedValue */
const mockedAddDoc = /** @type {import('vitest').Mock} */ (addDoc);
const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);

/* ==========================================================================
   Type Definitions
   ========================================================================== */

/**
 * @typedef {object} MockUser
 * @property {string} uid - 使用者 UID。
 * @property {string} name - 使用者名稱。
 * @property {string} email - 使用者電子信箱。
 * @property {string} photoURL - 使用者大頭貼 URL。
 * @property {string | null} bio - 使用者簡介。
 * @property {() => Promise<string>} getIdToken - 取得 ID token。
 */

/* ==========================================================================
   Test Fixtures
   ========================================================================== */

/** @type {MockUser} */
const MOCK_USER = {
  uid: 'user1',
  name: 'Test User',
  email: 'test@example.com',
  photoURL: 'http://photo.jpg',
  bio: null,
  getIdToken: () => Promise.resolve('mock-token'),
};

const MOCK_EVENT_ID = 'event1';
const MOCK_COMMENT_ID = 'new-comment-123';

/* ==========================================================================
   Tests
   ========================================================================== */

describe('CommentSection — onCommentAdded 回呼', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDocs.mockResolvedValue({ docs: [] });
    mockedAddDoc.mockResolvedValue({ id: MOCK_COMMENT_ID });
  });

  it('送出留言後呼叫 onCommentAdded 回呼', async () => {
    // Arrange
    const mockOnCommentAdded = vi.fn();
    const user = userEvent.setup();

    render(
      <AuthContext.Provider value={{ user: MOCK_USER, setUser: vi.fn(), loading: false }}>
        <CommentSection eventId={MOCK_EVENT_ID} onCommentAdded={mockOnCommentAdded} />
      </AuthContext.Provider>,
    );

    // Act
    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    // Assert
    await vi.waitFor(() => {
      expect(mockOnCommentAdded).toHaveBeenCalledWith(MOCK_COMMENT_ID);
    });
  });

  it('傳入正確的 commentId', async () => {
    // Arrange
    const mockOnCommentAdded = vi.fn();
    const user = userEvent.setup();

    render(
      <AuthContext.Provider value={{ user: MOCK_USER, setUser: vi.fn(), loading: false }}>
        <CommentSection eventId={MOCK_EVENT_ID} onCommentAdded={mockOnCommentAdded} />
      </AuthContext.Provider>,
    );

    // Act
    const submitBtn = screen.getByRole('button', { name: '送出' });
    await user.click(submitBtn);

    // Assert
    await vi.waitFor(() => {
      expect(mockOnCommentAdded).toHaveBeenCalledWith(MOCK_COMMENT_ID);
    });
  });
});
