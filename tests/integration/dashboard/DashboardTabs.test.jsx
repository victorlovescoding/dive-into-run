import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDoc, getDocs } from 'firebase/firestore';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
    this.setCustomParameters = vi.fn();
  }),
  connectAuthEmulator: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  connectStorageEmulator: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
  connectFirestoreEmulator: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  collection: vi.fn((db, ...segments) => ({ type: 'collection', path: segments })),
  collectionGroup: vi.fn((db, id) => ({ type: 'collectionGroup', id })),
  query: vi.fn((source, ...constraints) => ({ source, constraints })),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  limit: vi.fn((count) => ({ type: 'limit', count })),
  startAfter: vi.fn((document) => ({ type: 'startAfter', document })),
  doc: vi.fn((db, ...segments) => ({
    type: 'doc',
    path: segments,
    id: segments[segments.length - 1],
  })),
}));

// Mock card components
vi.mock('@/components/DashboardEventCard', () => ({
  default: ({ event, isHost }) => (
    <div data-testid={`event-${event.id}`}>
      {event.title}
      {isHost && ' [主辦]'}
    </div>
  ),
}));
vi.mock('@/components/DashboardPostCard', () => ({
  default: ({ post }) => <div data-testid={`post-${post.id}`}>{post.title}</div>,
}));
vi.mock('@/components/DashboardCommentCard', () => ({
  default: ({ comment }) => <div data-testid={`comment-${comment.id}`}>{comment.text}</div>,
}));

const mockedGetDocs = /** @type {import('vitest').Mock} */ (getDocs);
const mockedGetDoc = /** @type {import('vitest').Mock} */ (getDoc);

const TEST_UID = 'test-uid-123';

/** @type {{ participants: any[], hostedEvents: any[], eventsById: Map<string, any>, posts: any[], comments: any[], parentTitles: Map<string, string> }} */
let firestoreData;

/**
 * 建立 mock event items。
 * @param {number} count - 數量。
 * @param {string} hostUid - 主辦者 UID。
 * @returns {any[]} mock 資料。
 */
function makeEvents(count, hostUid = 'other') {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i + 1}`,
    title: `Event ${i + 1}`,
    time: { seconds: 9999999999 - i, toMillis: () => (9999999999 - i) * 1000 },
    location: `Location ${i + 1}`,
    city: 'Taipei',
    participantsCount: 3,
    maxParticipants: 10,
    hostUid,
  }));
}

/**
 * 建立 collectionGroup comments 需要的 ref.parent.parent shape。
 * @param {'posts' | 'events'} parentCollection - Parent collection id。
 * @param {string} parentId - Parent document id。
 * @returns {{ parent: { parent: { id: string, parent: { id: string } } } }} Comment ref。
 */
function makeCommentRef(parentCollection, parentId) {
  return {
    parent: {
      parent: {
        id: parentId,
        parent: { id: parentCollection },
      },
    },
  };
}

/**
 * 建立 query snapshot。
 * @param {any[]} docs - Firestore document snapshots。
 * @returns {{ docs: any[] }} Query snapshot。
 */
function makeQuerySnapshot(docs) {
  return { docs };
}

/**
 * 建立 query document snapshot。
 * @param {string} id - Document id。
 * @param {Record<string, unknown>} data - Document data。
 * @param {object} [extra] - Extra fields。
 * @returns {any} Query document snapshot。
 */
function makeQueryDoc(id, data, extra = {}) {
  return {
    id,
    data: () => data,
    ...extra,
  };
}

/**
 * 找出 query descriptor 的 where 條件。
 * @param {any} descriptor - Mock query descriptor。
 * @param {string} field - Field name。
 * @returns {any | undefined} where constraint。
 */
function findWhere(descriptor, field) {
  return descriptor.constraints.find(
    (constraint) => constraint.type === 'where' && constraint.field === field,
  );
}

/**
 * Mock Firestore getDocs，讓 runtime/use-case/service/repo 真實執行。
 * @param {any} descriptor - Mock query descriptor。
 * @returns {Promise<{ docs: any[] }>} Query snapshot。
 */
async function resolveGetDocs(descriptor) {
  const { source } = descriptor;

  if (source.type === 'collectionGroup' && source.id === 'participants') {
    const uid = findWhere(descriptor, 'uid')?.value;
    return makeQuerySnapshot(
      firestoreData.participants
        .filter((participant) => participant.uid === uid)
        .map((participant) => makeQueryDoc(participant.eventId, participant)),
    );
  }

  if (source.type === 'collection' && source.path[0] === 'events') {
    const hostUid = findWhere(descriptor, 'hostUid')?.value;
    return makeQuerySnapshot(
      firestoreData.hostedEvents
        .filter((event) => event.hostUid === hostUid)
        .map((event) => makeQueryDoc(event.id, event)),
    );
  }

  if (source.type === 'collection' && source.path[0] === 'posts') {
    const authorUid = findWhere(descriptor, 'authorUid')?.value;
    return makeQuerySnapshot(
      firestoreData.posts
        .filter((post) => post.authorUid === authorUid)
        .map((post) => makeQueryDoc(post.id, post)),
    );
  }

  if (source.type === 'collectionGroup' && source.id === 'comments') {
    const authorUid = findWhere(descriptor, 'authorUid')?.value;
    return makeQuerySnapshot(
      firestoreData.comments
        .filter((comment) => comment.authorUid === authorUid)
        .map((comment) =>
          makeQueryDoc(comment.id, comment, {
            ref: makeCommentRef(comment.parentCollection, comment.parentId),
          }),
        ),
    );
  }

  return makeQuerySnapshot([]);
}

/**
 * Mock Firestore getDoc。
 * @param {any} documentRef - Mock document ref。
 * @returns {Promise<any>} Document snapshot。
 */
async function resolveGetDoc(documentRef) {
  const [collectionId, documentId] = documentRef.path;
  const data =
    collectionId === 'events'
      ? firestoreData.eventsById.get(documentId)
      : { title: firestoreData.parentTitles.get(documentId) };

  return {
    id: documentId,
    exists: () => Boolean(data),
    data: () => data,
  };
}

/**
 * 設定 Firestore fixture。
 * @param {Partial<typeof firestoreData>} overrides - 覆蓋資料。
 * @returns {void}
 */
function setFirestoreData(overrides = {}) {
  firestoreData = {
    participants: [],
    hostedEvents: [],
    eventsById: new Map(),
    posts: [],
    comments: [],
    parentTitles: new Map(),
    ...overrides,
  };
}

describe('DashboardTabs', () => {
  /** @type {ReturnType<typeof userEvent.setup>} */
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup();
    setFirestoreData();
    mockedGetDocs.mockImplementation(resolveGetDocs);
    mockedGetDoc.mockImplementation(resolveGetDoc);
  });

  /**
   * 動態 import DashboardTabs 元件。
   * @returns {Promise<typeof import('@/components/DashboardTabs').default>} 元件。
   */
  async function importComponent() {
    const mod = await import('@/components/DashboardTabs');
    return mod.default;
  }

  // --- 1. 渲染三個 tab buttons ---
  it('renders three tab buttons', async () => {
    // Arrange
    const DashboardTabs = await importComponent();

    // Act
    render(<DashboardTabs uid={TEST_UID} />);

    // Assert
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent('我的活動');
    expect(tabs[1]).toHaveTextContent('我的文章');
    expect(tabs[2]).toHaveTextContent('我的留言');
  });

  // --- 2. 預設 active tab 是「我的活動」 ---
  it('has "my events" as default active tab', async () => {
    // Arrange
    const DashboardTabs = await importComponent();

    // Act
    render(<DashboardTabs uid={TEST_UID} />);

    // Assert
    const eventsTab = screen.getByRole('tab', { name: '我的活動' });
    expect(eventsTab).toHaveAttribute('aria-selected', 'true');

    const postsTab = screen.getByRole('tab', { name: '我的文章' });
    expect(postsTab).toHaveAttribute('aria-selected', 'false');

    const commentsTab = screen.getByRole('tab', { name: '我的留言' });
    expect(commentsTab).toHaveAttribute('aria-selected', 'false');
  });

  // --- 3. 點擊「我的文章」tab 切換 active ---
  it('switches active tab when clicking "my posts"', async () => {
    // Arrange
    const DashboardTabs = await importComponent();
    render(<DashboardTabs uid={TEST_UID} />);

    // Act
    await user.click(screen.getByRole('tab', { name: '我的文章' }));

    // Assert
    expect(screen.getByRole('tab', { name: '我的文章' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '我的活動' })).toHaveAttribute('aria-selected', 'false');
  });

  // --- 4. 點擊「我的留言」tab 切換 active ---
  it('switches active tab when clicking "my comments"', async () => {
    // Arrange
    const DashboardTabs = await importComponent();
    render(<DashboardTabs uid={TEST_UID} />);

    // Act
    await user.click(screen.getByRole('tab', { name: '我的留言' }));

    // Assert
    expect(screen.getByRole('tab', { name: '我的留言' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '我的活動' })).toHaveAttribute('aria-selected', 'false');
  });

  // --- 5. Tab 有正確的 aria attributes ---
  it('has correct ARIA attributes on tabs and panels', async () => {
    // Arrange
    const DashboardTabs = await importComponent();

    // Act
    render(<DashboardTabs uid={TEST_UID} />);

    // Assert — tabs
    const eventsTab = screen.getByRole('tab', { name: '我的活動' });
    expect(eventsTab).toHaveAttribute('id', 'tab-events');
    expect(eventsTab).toHaveAttribute('aria-controls', 'panel-events');

    const postsTab = screen.getByRole('tab', { name: '我的文章' });
    expect(postsTab).toHaveAttribute('id', 'tab-posts');
    expect(postsTab).toHaveAttribute('aria-controls', 'panel-posts');

    const commentsTab = screen.getByRole('tab', { name: '我的留言' });
    expect(commentsTab).toHaveAttribute('id', 'tab-comments');
    expect(commentsTab).toHaveAttribute('aria-controls', 'panel-comments');

    // Assert — tablist
    expect(screen.getByRole('tablist')).toBeInTheDocument();

    // Assert — panels
    const panels = screen.getAllByRole('tabpanel', { hidden: true });
    expect(panels).toHaveLength(3);
    expect(panels[0]).toHaveAttribute('id', 'panel-events');
    expect(panels[0]).toHaveAttribute('aria-labelledby', 'tab-events');
    expect(panels[1]).toHaveAttribute('id', 'panel-posts');
    expect(panels[1]).toHaveAttribute('aria-labelledby', 'tab-posts');
    expect(panels[2]).toHaveAttribute('id', 'panel-comments');
    expect(panels[2]).toHaveAttribute('aria-labelledby', 'tab-comments');
  });

  // --- 6. 載入中顯示 loading ---
  it('shows loading state on initial fetch', async () => {
    // Arrange
    mockedGetDocs.mockImplementation(() => new Promise(() => {}));
    const DashboardTabs = await importComponent();

    // Act
    render(<DashboardTabs uid={TEST_UID} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('載入中…')).toBeInTheDocument();
    });
  });

  // --- 7. 載入完成顯示 event items ---
  it('renders event items after successful fetch', async () => {
    // Arrange
    const events = makeEvents(2, TEST_UID);
    setFirestoreData({
      participants: events.map((event) => ({ uid: TEST_UID, eventId: event.id })),
      hostedEvents: events,
      eventsById: new Map(events.map((event) => [event.id, event])),
    });

    const DashboardTabs = await importComponent();

    // Act
    render(<DashboardTabs uid={TEST_UID} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('event-e1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('event-e1')).toHaveTextContent('Event 1 [主辦]');
    expect(screen.getByTestId('event-e2')).toHaveTextContent('Event 2 [主辦]');
  });

  // --- 8. 空資料顯示 empty state ---
  it('shows empty state when no events', async () => {
    // Arrange
    const DashboardTabs = await importComponent();

    // Act
    render(<DashboardTabs uid={TEST_UID} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('尚未參加任何活動')).toBeInTheDocument();
    });
  });

  // --- 9. 載入失敗顯示 error + retry 按鈕 ---
  it('shows error state and retries on failure', async () => {
    // Arrange
    mockedGetDocs.mockRejectedValueOnce(new Error('network error'));

    const DashboardTabs = await importComponent();

    // Act
    render(<DashboardTabs uid={TEST_UID} />);

    // Assert — error message visible
    await waitFor(() => {
      expect(screen.getByText('載入失敗')).toBeInTheDocument();
    });

    // Assert — retry button present
    const retryButton = screen.getByRole('button', { name: '重試' });
    expect(retryButton).toBeInTheDocument();

    // Arrange — retry succeeds
    const events = makeEvents(1);
    setFirestoreData({
      participants: events.map((event) => ({ uid: TEST_UID, eventId: event.id })),
      eventsById: new Map(events.map((event) => [event.id, event])),
    });
    mockedGetDocs.mockImplementation(resolveGetDocs);

    // Act — click retry
    await user.click(retryButton);

    // Assert — items show up
    await waitFor(() => {
      expect(screen.getByTestId('event-e1')).toBeInTheDocument();
    });
  });

  // --- 10. 資料全部載完顯示「已顯示全部」 ---
  it('shows end hint when all data is loaded', async () => {
    // Arrange — items < pageSize(5) → hasMore = false
    const events = makeEvents(2);
    setFirestoreData({
      participants: events.map((event) => ({ uid: TEST_UID, eventId: event.id })),
      eventsById: new Map(events.map((event) => [event.id, event])),
    });

    const DashboardTabs = await importComponent();

    // Act
    render(<DashboardTabs uid={TEST_UID} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('已顯示全部')).toBeInTheDocument();
    });
  });

  // --- 11. Posts tab 的 empty state ---
  it('shows posts empty state', async () => {
    // Arrange
    const DashboardTabs = await importComponent();
    render(<DashboardTabs uid={TEST_UID} />);

    // Act — switch to posts tab
    await user.click(screen.getByRole('tab', { name: '我的文章' }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText('尚未發表任何文章')).toBeInTheDocument();
    });
  });

  // --- 12. Comments tab 的 empty state ---
  it('shows comments empty state', async () => {
    // Arrange
    const DashboardTabs = await importComponent();
    render(<DashboardTabs uid={TEST_UID} />);

    // Act — switch to comments tab
    await user.click(screen.getByRole('tab', { name: '我的留言' }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText('尚未留過任何言')).toBeInTheDocument();
    });
  });

  // --- 13. Events tab 正確傳 isHost ---
  it('passes isHost correctly to DashboardEventCard', async () => {
    // Arrange — e1 is hosted by TEST_UID, e2 is not
    const events = [
      ...makeEvents(1, TEST_UID),
      {
        id: 'e2',
        title: 'Event 2',
        time: { seconds: 1000, toMillis: () => 1000000 },
        location: 'B',
        city: 'TN',
        participantsCount: 1,
        maxParticipants: 5,
        hostUid: 'other-uid',
      },
    ];
    setFirestoreData({
      participants: events.map((event) => ({ uid: TEST_UID, eventId: event.id })),
      hostedEvents: [events[0]],
      eventsById: new Map(events.map((event) => [event.id, event])),
    });

    const DashboardTabs = await importComponent();

    // Act
    render(<DashboardTabs uid={TEST_UID} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('event-e1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('event-e1')).toHaveTextContent('Event 1 [主辦]');
    expect(screen.getByTestId('event-e2')).toHaveTextContent('Event 2');
    expect(screen.getByTestId('event-e2')).not.toHaveTextContent('[主辦]');
  });

  // === Keyboard navigation (WAI-ARIA Tabs pattern) ===
  describe('keyboard navigation', () => {
    /**
     * 動態 import DashboardTabs 元件。
     * @returns {Promise<typeof import('@/components/DashboardTabs').default>} 元件。
     */
    async function importComponent() {
      const mod = await import('@/components/DashboardTabs');
      return mod.default;
    }

    it('navigates to next tab with ArrowRight', async () => {
      const DashboardTabs = await importComponent();
      render(<DashboardTabs uid={TEST_UID} />);
      const user = userEvent.setup();

      const eventsTab = screen.getByRole('tab', { name: '我的活動' });
      await user.click(eventsTab);
      await user.keyboard('{ArrowRight}');

      expect(screen.getByRole('tab', { name: '我的文章' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: '我的文章' })).toHaveFocus();
    });

    it('navigates to previous tab with ArrowLeft', async () => {
      const DashboardTabs = await importComponent();
      render(<DashboardTabs uid={TEST_UID} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('tab', { name: '我的文章' }));
      await user.keyboard('{ArrowLeft}');

      expect(screen.getByRole('tab', { name: '我的活動' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: '我的活動' })).toHaveFocus();
    });

    it('wraps around from last to first with ArrowRight', async () => {
      const DashboardTabs = await importComponent();
      render(<DashboardTabs uid={TEST_UID} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('tab', { name: '我的留言' }));
      await user.keyboard('{ArrowRight}');

      expect(screen.getByRole('tab', { name: '我的活動' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: '我的活動' })).toHaveFocus();
    });

    it('wraps around from first to last with ArrowLeft', async () => {
      const DashboardTabs = await importComponent();
      render(<DashboardTabs uid={TEST_UID} />);
      const user = userEvent.setup();

      const eventsTab = screen.getByRole('tab', { name: '我的活動' });
      await user.click(eventsTab);
      await user.keyboard('{ArrowLeft}');

      expect(screen.getByRole('tab', { name: '我的留言' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: '我的留言' })).toHaveFocus();
    });

    it('moves to first tab with Home key', async () => {
      const DashboardTabs = await importComponent();
      render(<DashboardTabs uid={TEST_UID} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('tab', { name: '我的留言' }));
      await user.keyboard('{Home}');

      expect(screen.getByRole('tab', { name: '我的活動' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: '我的活動' })).toHaveFocus();
    });

    it('moves to last tab with End key', async () => {
      const DashboardTabs = await importComponent();
      render(<DashboardTabs uid={TEST_UID} />);
      const user = userEvent.setup();

      const eventsTab = screen.getByRole('tab', { name: '我的活動' });
      await user.click(eventsTab);
      await user.keyboard('{End}');

      expect(screen.getByRole('tab', { name: '我的留言' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(screen.getByRole('tab', { name: '我的留言' })).toHaveFocus();
    });

    it('active tab has tabIndex 0, inactive tabs have tabIndex -1', async () => {
      const DashboardTabs = await importComponent();
      render(<DashboardTabs uid={TEST_UID} />);
      const user = userEvent.setup();

      // Default: events tab active
      expect(screen.getByRole('tab', { name: '我的活動' })).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('tab', { name: '我的文章' })).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('tab', { name: '我的留言' })).toHaveAttribute('tabindex', '-1');

      // Switch to posts tab
      await user.click(screen.getByRole('tab', { name: '我的文章' }));

      expect(screen.getByRole('tab', { name: '我的活動' })).toHaveAttribute('tabindex', '-1');
      expect(screen.getByRole('tab', { name: '我的文章' })).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('tab', { name: '我的留言' })).toHaveAttribute('tabindex', '-1');
    });
  });
});
