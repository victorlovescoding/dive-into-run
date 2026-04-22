import { vi, describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  writeBatch: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(),
  onSnapshot: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));
vi.mock('@/lib/firebase-events', () => ({ fetchParticipants: vi.fn() }));
vi.mock('@/lib/notification-helpers', () => ({ buildNotificationMessage: vi.fn() }));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { getDocs } from 'firebase/firestore';
import { fetchDistinctCommentAuthors } from '@/lib/firebase-notifications';

// ---------------------------------------------------------------------------
// Typed aliases
// ---------------------------------------------------------------------------
const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);

// ---------------------------------------------------------------------------
// fetchDistinctCommentAuthors
// ---------------------------------------------------------------------------
describe('fetchDistinctCommentAuthors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應回傳 comments collection 中不重複的 authorUid 陣列', async () => {
    // Arrange
    const commentsRef = /** @type {import('firebase/firestore').CollectionReference} */ ({});
    mockedGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ authorUid: 'uid-a' }) },
        { data: () => ({ authorUid: 'uid-b' }) },
        { data: () => ({ authorUid: 'uid-c' }) },
      ],
    });

    // Act
    const result = await fetchDistinctCommentAuthors(commentsRef);

    // Assert
    expect(mockedGetDocs).toHaveBeenCalledWith(commentsRef);
    expect(result).toEqual(['uid-a', 'uid-b', 'uid-c']);
  });

  it('collection 為空時應回傳空陣列', async () => {
    // Arrange
    const commentsRef = /** @type {import('firebase/firestore').CollectionReference} */ ({});
    mockedGetDocs.mockResolvedValue({ docs: [] });

    // Act
    const result = await fetchDistinctCommentAuthors(commentsRef);

    // Assert
    expect(mockedGetDocs).toHaveBeenCalledWith(commentsRef);
    expect(result).toEqual([]);
  });

  it('同一作者留言多次時應只出現一次', async () => {
    // Arrange
    const commentsRef = /** @type {import('firebase/firestore').CollectionReference} */ ({});
    mockedGetDocs.mockResolvedValue({
      docs: [
        { data: () => ({ authorUid: 'uid-x' }) },
        { data: () => ({ authorUid: 'uid-y' }) },
        { data: () => ({ authorUid: 'uid-x' }) },
        { data: () => ({ authorUid: 'uid-y' }) },
        { data: () => ({ authorUid: 'uid-x' }) },
      ],
    });

    // Act
    const result = await fetchDistinctCommentAuthors(commentsRef);

    // Assert
    expect(result).toHaveLength(2);
    expect(result).toContain('uid-x');
    expect(result).toContain('uid-y');
  });
});
