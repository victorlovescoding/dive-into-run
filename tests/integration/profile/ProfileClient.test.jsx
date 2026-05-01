/**
 * @file Integration tests for thin-entry `ProfileClient`.
 * @description
 * S027 後 page-level boundary 改為 `mock Firebase SDK/config + render thin entry`。
 * 這個 suite 只驗證：
 * 1. `ProfileClient` 會把 server `user` prop 交給 real `useProfileRuntime`
 * 2. thin entry 會把 runtime state 接到 `ProfileScreen`
 * 3. page-level tests 不再 mock legacy facade `@/lib/firebase-profile`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import ProfileClient from '@/app/users/[uid]/ProfileClient';

const firestoreMock = vi.hoisted(() => ({
  collection: vi.fn((db, path) => ({ type: 'collection', db, path })),
  collectionGroup: vi.fn((db, path) => ({ type: 'collectionGroup', db, path })),
  doc: vi.fn((db, collectionPath, id) => ({ type: 'doc', db, collectionPath, id })),
  getCountFromServer: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((count) => ({ type: 'limit', count })),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn((source, ...constraints) => ({ source, constraints })),
  setDoc: vi.fn(),
  startAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
}));

vi.mock('firebase/firestore', () => firestoreMock);

vi.mock('@/config/client/firebase-client', () => ({
  db: { app: 'test-firestore' },
}));

vi.mock('next/link', () => ({
  /**
   * @param {object} props - Mocked next/link props.
   * @param {string} props.href - 連結網址。
   * @param {import('react').ReactNode} props.children - 連結內容。
   * @returns {import('react').ReactElement} 普通 anchor 模擬。
   */
  default: ({ href, children, ...rest }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/users/[uid]/ProfileHeader', () => ({
  /**
   * @param {object} props - ProfileHeader props.
   * @param {{ uid: string, name: string, bio?: string }} props.user - Profile header user.
   * @returns {import('react').ReactElement} Mocked header.
   */
  default: ({ user }) => (
    <section aria-label="profile header mock">
      <h2>{user.name}</h2>
      <output aria-label="profile header uid">{user.uid}</output>
      {user.bio != null && <p>{user.bio}</p>}
    </section>
  ),
}));

vi.mock('@/app/users/[uid]/ProfileStats', () => ({
  /**
   * @param {object} props - ProfileStats props.
   * @param {{ hostedCount: number, joinedCount: number, totalDistanceKm: number | null }}
   *   props.stats - Stats object.
   * @returns {import('react').ReactElement} Mocked stats.
   */
  default: ({ stats }) => (
    <section aria-label="profile stats mock">
      <output aria-label="hosted count">{stats.hostedCount}</output>
      <output aria-label="joined count">{stats.joinedCount}</output>
      <output aria-label="total distance">
        {stats.totalDistanceKm === null ? 'hidden' : String(stats.totalDistanceKm)}
      </output>
    </section>
  ),
}));

vi.mock('@/app/users/[uid]/ProfileEventList', () => ({
  /**
   * @param {object} props - ProfileEventList props.
   * @param {string} props.uid - Target uid.
   * @returns {import('react').ReactElement} Mocked event list.
   */
  default: ({ uid }) => (
    <section aria-label="profile events mock">
      <output aria-label="profile events uid">{uid}</output>
    </section>
  ),
}));

/**
 * @typedef {object} MockPublicProfile
 * @property {string} uid - UID。
 * @property {string} name - 名稱。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 簡介。
 * @property {Date} createdAt - 加入日期。
 */

/**
 * 建立測試用 public profile。
 * @param {Partial<MockPublicProfile>} [overrides] - 覆蓋欄位。
 * @returns {MockPublicProfile} profile。
 */
function createProfile(overrides = {}) {
  return {
    uid: 'user-abc',
    name: 'Alice Runner',
    photoURL: 'https://example.com/alice.jpg',
    bio: '每天晨跑 5 公里。',
    createdAt: new Date(2024, 2, 15),
    ...overrides,
  };
}

/**
 * 建立 Firebase count aggregate snapshot。
 * @param {number} count - 回傳數量。
 * @returns {{ data: () => { count: number } }} count snapshot。
 */
function makeCountSnap(count) {
  return { data: () => ({ count }) };
}

/**
 * 設定下一次 profile stats 讀取結果。
 * @param {number} hostedCount - 主辦活動數。
 * @param {number} joinedCount - 參加活動數。
 */
function mockProfileStats(hostedCount, joinedCount) {
  firestoreMock.getCountFromServer
    .mockResolvedValueOnce(makeCountSnap(hostedCount))
    .mockResolvedValueOnce(makeCountSnap(joinedCount));
}

/**
 * 用 AuthContext 包住 ProfileClient，讓 real runtime 判斷 isSelf。
 * @param {object} options - Render options。
 * @param {MockPublicProfile} options.user - ProfileClient user prop。
 * @param {{ uid: string } | null} [options.currentUser] - 目前登入使用者。
 * @returns {import('@testing-library/react').RenderResult} render result。
 */
function renderProfileClient({ user, currentUser = null }) {
  const authUser = currentUser
    ? {
        uid: currentUser.uid,
        name: null,
        email: null,
        photoURL: null,
        bio: null,
        getIdToken: () => Promise.resolve(''),
      }
    : null;
  return render(
    <AuthContext.Provider value={{ user: authUser, setUser: () => {}, loading: false }}>
      <ProfileClient user={user} />
    </AuthContext.Provider>,
  );
}

describe('Integration: ProfileClient thin entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileStats(3, 7);
  });

  it('passes the server user uid into the real profile stats query', async () => {
    const user = createProfile({ uid: 'user-xyz' });

    renderProfileClient({ user });

    expect(await screen.findByRole('region', { name: 'profile stats mock' })).toBeInTheDocument();
    expect(firestoreMock.where).toHaveBeenCalledWith('hostUid', '==', 'user-xyz');
    expect(firestoreMock.where).toHaveBeenCalledWith('uid', '==', 'user-xyz');
  });

  it('renders header, stats, and event list from runtime boundary', async () => {
    renderProfileClient({ user: createProfile() });

    expect(screen.getByRole('region', { name: 'profile header mock' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Alice Runner' })).toBeInTheDocument();
    expect(screen.getByLabelText('profile header uid')).toHaveTextContent('user-abc');
    expect(screen.getByText('每天晨跑 5 公里。')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'profile stats mock' })).toBeInTheDocument();
    expect(screen.getByLabelText('hosted count')).toHaveTextContent('3');
    expect(screen.getByLabelText('joined count')).toHaveTextContent('7');
    expect(screen.getByLabelText('total distance')).toHaveTextContent('hidden');
    expect(screen.getByLabelText('profile events uid')).toHaveTextContent('user-abc');
  });

  it('shows loading state when runtime reports stats loading', () => {
    firestoreMock.getCountFromServer.mockImplementation(() => new Promise(() => {}));

    renderProfileClient({ user: createProfile() });

    expect(screen.getByRole('region', { name: 'profile header mock' })).toBeInTheDocument();
    expect(screen.getByText(/載入中/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'profile stats mock' })).not.toBeInTheDocument();
  });

  it('shows error state when runtime reports stats error', async () => {
    firestoreMock.getCountFromServer.mockReset();
    firestoreMock.getCountFromServer.mockRejectedValueOnce(new Error('count failed'));

    renderProfileClient({ user: createProfile() });

    expect(await screen.findByText('無法載入統計')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'profile stats mock' })).not.toBeInTheDocument();
  });

  it('passes null totalDistanceKm through to ProfileStats', async () => {
    renderProfileClient({ user: createProfile() });

    expect(await screen.findByLabelText('total distance')).toHaveTextContent('hidden');
  });

  it('shows self-profile banner and edit link when runtime marks own profile', () => {
    const user = createProfile({ uid: 'user-self' });

    renderProfileClient({ user, currentUser: { uid: 'user-self' } });

    expect(screen.getByRole('complementary', { name: '這是你的公開檔案' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '編輯個人資料' })).toHaveAttribute('href', '/member');
  });

  it('does not show self-profile banner when runtime marks another profile', () => {
    renderProfileClient({ user: createProfile({ uid: 'user-other' }), currentUser: { uid: 'me' } });

    expect(
      screen.queryByRole('complementary', { name: '這是你的公開檔案' }),
    ).not.toBeInTheDocument();
  });
});
