import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Shared mock state
// ---------------------------------------------------------------------------
const mockShowToast = vi.fn();
const mockRemoveToast = vi.fn();
const mockReplace = vi.fn();
const mockPush = vi.fn();
let mockSearchParams = new URLSearchParams();

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------
vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast, removeToast: mockRemoveToast }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/events',
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null,
}));

vi.mock('next/link', () => ({
  default: ({ children, ...rest }) => <a {...rest}>{children}</a>,
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({
  auth: {},
  db: {},
  provider: {},
}));

// SDK boundary mock: 真正的行為控制點。
// 路徑由 collection/doc 第一個 collection segment 決定，整條 use-case → repo → SDK 真實執行。
vi.mock('firebase/firestore', () => {
  /**
   * Build a Firestore-like document snapshot for the SDK mock.
   * @param {string} id - Document id.
   * @param {object | null} data - Doc data, null marks missing.
   * @returns {object} doc snapshot stub。
   */
  const createDocSnapshot = (id, data) => ({
    id,
    ref: { id, path: `mock/${id}` },
    exists: () => data !== null,
    data: () => data,
  });

  /**
   * Build a Firestore-like query snapshot for the SDK mock.
   * @param {Array<{ id: string, data: () => unknown }>} docs - doc snapshots。
   * @returns {object} query snapshot stub。
   */
  const createQuerySnapshot = (docs) => ({
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach(cb) {
      docs.forEach(cb);
    },
  });

  const collection = vi.fn((_db, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  }));

  const doc = vi.fn((base, ...segments) => {
    if (base?.type === 'collection' && segments.length === 0) {
      return { id: 'generated-id', path: `${base.path}/generated-id` };
    }
    if (base?.type === 'collection') {
      return {
        id: String(segments.at(-1)),
        path: [base.path, ...segments].join('/'),
      };
    }
    return { id: String(segments.at(-1)), path: segments.join('/') };
  });

  const query = vi.fn((firstPart, ...rest) => ({
    type: 'query',
    path: firstPart?.path,
    parts: [firstPart, ...rest],
  }));

  const collectionGroup = vi.fn((_db, name) => ({
    type: 'collectionGroup',
    path: name,
  }));

  const getDocs = vi.fn(async () => createQuerySnapshot([]));
  const getDoc = vi.fn(async (ref) => createDocSnapshot(ref?.id ?? 'unknown', null));
  const addDoc = vi.fn(async () => ({ id: 'generated-id' }));
  const updateDoc = vi.fn(async () => undefined);
  const deleteDoc = vi.fn(async () => undefined);

  const runTransaction = vi.fn(async (_db, callback) =>
    callback({
      get: vi.fn(async (ref) => createDocSnapshot(ref?.id ?? 'unknown', null)),
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }),
  );

  const writeBatch = vi.fn(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(async () => undefined),
  }));

  return {
    addDoc,
    updateDoc,
    deleteDoc,
    getDoc,
    getDocs,
    collection,
    collectionGroup,
    doc,
    query,
    where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
    orderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
    limit: vi.fn((n) => ({ type: 'limit', n })),
    startAfter: vi.fn((...cursor) => ({ type: 'startAfter', cursor })),
    documentId: vi.fn(() => '__name__'),
    serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
    increment: vi.fn((value) => ({ __type: 'increment', value })),
    deleteField: vi.fn(() => ({ __type: 'deleteField' })),
    runTransaction,
    writeBatch,
    Timestamp: {
      fromDate: vi.fn((d) => ({ toDate: () => d, __type: 'timestamp' })),
      now: vi.fn(() => ({ toDate: () => new Date(), __type: 'timestamp' })),
    },
    // 測試用工具：let tests reach the helpers without re-importing
    __helpers: { createDocSnapshot, createQuerySnapshot },
  };
});

// ---------------------------------------------------------------------------
// Imports (after vi.mock — Vitest hoists mocks above these)
// ---------------------------------------------------------------------------
import { addDoc, updateDoc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import EventDeleteConfirm from '@/components/EventDeleteConfirm';
import RunTogetherPage from '@/app/events/page';
import PostPage from '@/app/posts/page';
import { asMock } from '../../_helpers/mock-helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TEST_USER = {
  uid: 'u1',
  name: 'Test User',
  email: 'test@example.com',
  photoURL: null,
  getIdToken: vi.fn().mockResolvedValue('token'),
};

/**
 * Wraps children with AuthContext providing a test user.
 * @param {object} props - Component props.
 * @param {import('react').ReactNode} props.children - Child elements.
 * @param {object | null} [props.user] - Override user value.
 * @returns {import('react').ReactElement} Provider wrapper.
 */
function AuthWrapper({ children, user = TEST_USER }) {
  const value = { user, setUser: vi.fn(), loading: false };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Build a Firestore-like document snapshot for tests.
 * @param {string} id - Document id.
 * @param {object | null} data - Document data; null marks missing doc.
 * @returns {object} snapshot stub。
 */
function docSnapshot(id, data) {
  return {
    id,
    ref: { id, path: `mock/${id}` },
    exists: () => data !== null,
    data: () => data,
  };
}

/**
 * Build a Firestore-like query snapshot for tests.
 * @param {Array<{ id: string, data: () => unknown }>} docs - Doc snapshots.
 * @returns {object} query snapshot stub。
 */
function querySnapshot(docs) {
  return {
    docs,
    size: docs.length,
    empty: docs.length === 0,
    forEach(cb) {
      docs.forEach(cb);
    },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  mockSearchParams = new URLSearchParams();

  // Default: 空 list / missing doc / write success — 個別測試以 mockResolvedValueOnce 覆寫。
  asMock(getDocs).mockResolvedValue(querySnapshot([]));
  asMock(getDoc).mockResolvedValue(docSnapshot('unknown', null));
  asMock(addDoc).mockResolvedValue({ id: 'generated-id' });
  asMock(updateDoc).mockResolvedValue(undefined);
  asMock(writeBatch).mockReturnValue({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  });

  // jsdom 的 <dialog> 不一定有 showModal / close；補 polyfill 避免 runtime error
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
  }
});

// ===========================================================================
// Group 1: EventDeleteConfirm — no deleteError prop
// ===========================================================================
describe('EventDeleteConfirm — no deleteError prop', () => {
  it('renders without error and has no alert role element', () => {
    render(<EventDeleteConfirm eventId="e1" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    // The dialog should render
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('確定要刪除活動？')).toBeInTheDocument();

    // No alert role (deleteError was removed)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// Group 2: Events page — search params toast
// ===========================================================================
describe('Events page — search params toast', () => {
  it('calls showToast with the toast search param value on mount', async () => {
    mockSearchParams = new URLSearchParams('?toast=活動已刪除');

    render(
      <AuthWrapper>
        <RunTogetherPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('活動已刪除');
    });

    expect(mockReplace).toHaveBeenCalledWith('/events', { scroll: false });
  });

  it('does not call showToast when no toast param exists', async () => {
    mockSearchParams = new URLSearchParams();

    render(
      <AuthWrapper>
        <RunTogetherPage />
      </AuthWrapper>,
    );

    // Wait for initial effects to settle
    await waitFor(() => {
      expect(mockShowToast).not.toHaveBeenCalled();
    });
  });
});

// ===========================================================================
// Group 3: Posts page — search params toast
// ===========================================================================
describe('Posts page — search params toast', () => {
  it('calls showToast with the toast search param value on mount', async () => {
    mockSearchParams = new URLSearchParams('?toast=文章已刪除');

    render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('文章已刪除');
    });

    expect(mockReplace).toHaveBeenCalledWith('/posts', { scroll: false });
  });

  it('does not call showToast when no toast param exists', async () => {
    mockSearchParams = new URLSearchParams();

    render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(mockShowToast).not.toHaveBeenCalled();
    });
  });
});

// ===========================================================================
// Group 4: Events page — CRUD handler toast calls
// ===========================================================================
describe('Events page — CRUD handler toast calls', () => {
  /**
   * 從目前 DOM 找指定 name 屬性的 form control（用 testing-library role queries + getAttribute filter）。
   * paceMinutes/paceSeconds label 為空、city/district 共用 label，無法直接以 getByLabelText/getByRole(name) 對應。
   * @param {string} controlName - form control 的 name 屬性。
   * @param {'combobox' | 'textbox' | 'spinbutton'} role - WAI-ARIA role of the control.
   * @returns {HTMLElement} 找到的元素，找不到時 throw。
   */
  function findFormControl(controlName, role) {
    const candidates = screen.getAllByRole(role);
    const found = candidates.find((el) => el.getAttribute('name') === controlName);
    if (!found) {
      throw new Error(`form control "${controlName}" (role=${role}) not found`);
    }
    return found;
  }

  /**
   * 真實 createEvent → service.normalizeEventPayload 會驗 form raw 欄位；
   * 用 userEvent 把 EventCreateForm 必填欄位填滿合法值，避免 validation throw 蓋掉 SDK error path。
   * @param {ReturnType<typeof userEvent.setup>} user - userEvent instance.
   */
  async function fillCreateEventForm(user) {
    // datetime-local 用 ISO 截 yyyy-MM-ddTHH:mm
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const isoLocal = (d) => d.toISOString().slice(0, 16);

    await user.type(screen.getByLabelText(/活動名稱/), 'Morning Run');
    await user.type(screen.getByLabelText(/活動時間/), isoLocal(dayAfter));
    await user.type(screen.getByLabelText(/報名截止時間/), isoLocal(tomorrow));

    // city / district 共用同一 label「活動區域」，testing-library 會回 first match (city)。
    // 注意：cityOptions 來自真實 taiwan-locations，「臺」(U+81FA) 而非「台」(U+53F0)
    await user.selectOptions(findFormControl('city', 'combobox'), '臺北市');
    await user.selectOptions(screen.getByRole('combobox', { name: '選擇區域' }), '信義區');

    await user.type(screen.getByLabelText(/集合地點/), '北捷市政府站');
    await user.selectOptions(screen.getByLabelText(/跑步類型/), 'easy_run');
    await user.type(screen.getByLabelText(/距離/), '5');

    // PaceSelector: paceMinutes / paceSeconds（label 為空，依 name 屬性查）
    await user.selectOptions(findFormControl('paceMinutes', 'combobox'), '06');
    await user.selectOptions(findFormControl('paceSeconds', 'combobox'), '00');

    // planRoute 是 radio group；選「否」即可。
    await user.click(screen.getByLabelText(/^\s*否/));
  }

  it('shows success toast after creating an event', async () => {
    // SDK 行為控制：addDoc resolve → real createEvent → success toast。
    asMock(addDoc).mockResolvedValueOnce({ id: 'new-event-1' });

    render(
      <AuthWrapper>
        <RunTogetherPage />
      </AuthWrapper>,
    );

    const createButton = screen.getByRole('button', { name: /新增跑步揪團/ });
    const user = userEvent.setup();
    await user.click(createButton);

    await fillCreateEventForm(user);

    const submitButton = screen.getByRole('button', { name: /建立活動|建立中/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('建立活動成功');
    });
    expect(addDoc).toHaveBeenCalled();
  });

  it('shows error toast when creating an event fails', async () => {
    // SDK 行為控制：addDoc reject → real createEvent throw → error toast。
    asMock(addDoc).mockRejectedValueOnce(new Error('Network error'));

    render(
      <AuthWrapper>
        <RunTogetherPage />
      </AuthWrapper>,
    );

    const createButton = screen.getByRole('button', { name: /新增跑步揪團/ });
    const user = userEvent.setup();
    await user.click(createButton);

    await fillCreateEventForm(user);

    const submitButton = screen.getByRole('button', { name: /建立活動|建立中/ });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('建立活動失敗，請稍後再試', 'error');
    });
  });

  it('renders fetched event title (update toast 走 EventEditForm，這裡只驗 list 載入)', async () => {
    // SDK 行為控制：getDocs (events list) 回 1 筆。
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    asMock(getDocs).mockResolvedValueOnce(
      querySnapshot([
        docSnapshot('ev-1', {
          title: 'Morning Run',
          hostUid: 'u1',
          city: '台北市',
          district: '信義區',
          distanceKm: 5,
          maxParticipants: 10,
          participantsCount: 0,
          time: { toDate: () => tomorrow },
          registrationDeadline: { toDate: () => tomorrow },
        }),
      ]),
    );

    render(
      <AuthWrapper>
        <RunTogetherPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Morning Run')).toBeInTheDocument();
    });

    // updateEvent 入口在 EventEditForm；list page 不直接觸發。
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('shows success toast after deleting an event', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const eventDoc = docSnapshot('ev-del-1', {
      title: 'Run to Delete',
      hostUid: 'u1',
      city: '台北市',
      district: '大安區',
      distanceKm: 3,
      maxParticipants: 5,
      participantsCount: 0,
      time: { toDate: () => tomorrow },
      registrationDeadline: { toDate: () => tomorrow },
    });

    // 1st getDocs: events list；後續 deleteEventTree 內部還會呼叫 participants/comments
    // getDocs（預設仍是空 list）。
    asMock(getDocs).mockResolvedValueOnce(querySnapshot([eventDoc]));

    // useEventParticipation.fetchJoinedParticipantDocuments 與 deleteEventTree 都會呼叫 getDoc，
    // 用 path 分流：top-level events/<id> → exists、participants subcollection → not exists。
    asMock(getDoc).mockImplementation(async (ref) => {
      const segments = String(ref?.path ?? '').split('/');
      if (segments[0] === 'events' && segments.length === 2) {
        return eventDoc;
      }
      return docSnapshot(ref?.id ?? 'unknown', null);
    });

    render(
      <AuthWrapper>
        <RunTogetherPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Run to Delete')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const menuButton = screen.getByRole('button', { name: '更多操作' });
    await user.click(menuButton);

    const deleteMenuItem = screen.getByRole('menuitem', { name: /刪除/ });
    await user.click(deleteMenuItem);

    const confirmButton = screen.getByRole('button', { name: /確認刪除/ });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('活動已刪除');
    });
    expect(getDoc).toHaveBeenCalled();
  });

  it('shows error toast when deleting an event fails', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const eventDoc = docSnapshot('ev-fail-del', {
      title: 'Fail Delete',
      hostUid: 'u1',
      city: '台北市',
      district: '中正區',
      distanceKm: 10,
      maxParticipants: 20,
      participantsCount: 0,
      time: { toDate: () => tomorrow },
      registrationDeadline: { toDate: () => tomorrow },
    });

    asMock(getDocs).mockResolvedValueOnce(querySnapshot([eventDoc]));

    // 全程 getDoc 都回 missing：useEventParticipation join check 不影響邏輯；
    // deleteEventTree 對 events/ev-fail-del 拿到 missing → throw EVENT_NOT_FOUND_MESSAGE → error toast。
    asMock(getDoc).mockResolvedValue(docSnapshot('ev-fail-del', null));

    render(
      <AuthWrapper>
        <RunTogetherPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Fail Delete')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const menuButton = screen.getByRole('button', { name: '更多操作' });
    await user.click(menuButton);

    const deleteMenuItem = screen.getByRole('menuitem', { name: /刪除/ });
    await user.click(deleteMenuItem);

    const confirmButton = screen.getByRole('button', { name: /確認刪除/ });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('刪除活動失敗，請稍後再試', 'error');
    });
  });

  it('shows error toast when toggling create form while not logged in', async () => {
    render(
      <AuthWrapper user={null}>
        <RunTogetherPage />
      </AuthWrapper>,
    );

    const createButton = screen.getByRole('button', { name: /新增跑步揪團/ });
    const user = userEvent.setup();
    await user.click(createButton);

    expect(mockShowToast).toHaveBeenCalledWith('發起活動前請先登入', 'error');
  });
});

// ===========================================================================
// Group 5: Posts page — CRUD handler toast calls
// ===========================================================================
describe('Posts page — CRUD handler toast calls', () => {
  /**
   * Build a doc snapshot shaped like Firestore post for hydratePosts.
   * @param {string} id - post id.
   * @param {object} fields - post fields.
   * @returns {object} doc snapshot.
   */
  function postDoc(id, fields) {
    return docSnapshot(id, {
      title: fields.title ?? '',
      content: fields.content ?? '',
      authorUid: fields.authorUid ?? 'u1',
      likesCount: fields.likesCount ?? 0,
      commentsCount: fields.commentsCount ?? 0,
      postAt: { toDate: () => new Date('2026-04-01T00:00:00Z') },
      ...fields,
    });
  }

  it('shows success toast after creating a post', async () => {
    // initial load: empty
    asMock(getDocs).mockResolvedValueOnce(querySnapshot([]));

    // createPost: addDoc(posts) → returns ref with id 'new-post-1'
    asMock(addDoc).mockResolvedValueOnce({ id: 'new-post-1' });

    // getPostDetail: getDoc(posts/new-post-1) → exists with data
    asMock(getDoc).mockResolvedValueOnce(
      postDoc('new-post-1', { title: 'New Post', content: 'Content' }),
    );

    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const user = userEvent.setup();

    render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
    });

    const composeButton = screen.getByRole('button', { name: /分享你的跑步故事/ });
    await user.click(composeButton);

    const titleInput = screen.getByPlaceholderText('標題');
    const contentInput = screen.getByPlaceholderText('分享你的想法...');
    await user.type(titleInput, 'New Post');
    await user.type(contentInput, 'Content');

    const submitButton = screen.getByRole('button', { name: '發布' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('發佈文章成功');
    });
    expect(addDoc).toHaveBeenCalled();

    scrollToSpy.mockRestore();
  });

  it('shows error toast when creating a post fails', async () => {
    asMock(getDocs).mockResolvedValueOnce(querySnapshot([]));
    // createPost: addDoc reject → real createPost throw → error toast
    asMock(addDoc).mockRejectedValueOnce(new Error('Create failed'));

    const user = userEvent.setup();

    render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(getDocs).toHaveBeenCalled();
    });

    const composeButton = screen.getByRole('button', { name: /分享你的跑步故事/ });
    await user.click(composeButton);

    const titleInput = screen.getByPlaceholderText('標題');
    const contentInput = screen.getByPlaceholderText('分享你的想法...');
    await user.type(titleInput, 'Fail Post');
    await user.type(contentInput, 'Fail content');

    const submitButton = screen.getByRole('button', { name: '發布' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('發佈文章失敗，請稍後再試', 'error');
    });
  });

  it('shows success toast after updating a post', async () => {
    asMock(getDocs).mockResolvedValueOnce(
      querySnapshot([postDoc('post-edit-1', { title: 'Old Title', content: 'Old Content' })]),
    );

    const user = userEvent.setup();

    render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Old Title')).toBeInTheDocument();
    });

    const menuButton = screen.getByRole('button', { name: '更多選項' });
    await user.click(menuButton);

    const editButton = screen.getByRole('menuitem', { name: '編輯' });
    await user.click(editButton);

    const titleInput = screen.getByPlaceholderText('標題');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated Title');

    const submitButton = screen.getByRole('button', { name: '更新' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(updateDoc).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith('更新文章成功');
    });
  });

  it('shows error toast when updating a post fails', async () => {
    asMock(getDocs).mockResolvedValueOnce(
      querySnapshot([
        postDoc('post-fail-edit', { title: 'Edit Fail Title', content: 'Edit Fail Content' }),
      ]),
    );
    // updateDoc reject → real updatePost throw → error toast
    asMock(updateDoc).mockRejectedValueOnce(new Error('Update failed'));

    const user = userEvent.setup();

    render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Edit Fail Title')).toBeInTheDocument();
    });

    const menuButton = screen.getByRole('button', { name: '更多選項' });
    await user.click(menuButton);

    const editButton = screen.getByRole('menuitem', { name: '編輯' });
    await user.click(editButton);

    // Make the form dirty so submit button is enabled
    const titleInput = screen.getByPlaceholderText('標題');
    await user.clear(titleInput);
    await user.type(titleInput, 'Changed Title');

    const submitButton = screen.getByRole('button', { name: '更新' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('更新文章失敗，請稍後再試', 'error');
    });
  });

  it('shows success toast after deleting a post', async () => {
    const post = postDoc('post-del-1', { title: 'Delete Me', content: 'To be deleted' });
    asMock(getDocs).mockResolvedValueOnce(querySnapshot([post]));

    // deletePostTree: getDoc(postRef) → exists
    asMock(getDoc).mockResolvedValueOnce(post);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Delete Me')).toBeInTheDocument();
    });

    const menuButton = screen.getByRole('button', { name: '更多選項' });
    await user.click(menuButton);

    const deleteButton = screen.getByRole('menuitem', { name: '刪除' });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('文章已刪除');
    });

    confirmSpy.mockRestore();
  });

  it('shows error toast when deleting a post fails', async () => {
    const post = postDoc('post-fail-del', {
      title: 'Fail Delete Post',
      content: 'Cannot be deleted',
    });
    asMock(getDocs).mockResolvedValueOnce(querySnapshot([post]));

    // deletePostTree: getDoc(postRef) → missing → throw POST_NOT_FOUND_MESSAGE → catch → error toast
    asMock(getDoc).mockResolvedValueOnce(docSnapshot('post-fail-del', null));

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <AuthWrapper>
        <PostPage />
      </AuthWrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText('Fail Delete Post')).toBeInTheDocument();
    });

    const menuButton = screen.getByRole('button', { name: '更多選項' });
    await user.click(menuButton);

    const deleteButton = screen.getByRole('menuitem', { name: '刪除' });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('刪除文章失敗，請稍後再試', 'error');
    });

    confirmSpy.mockRestore();
  });
});
