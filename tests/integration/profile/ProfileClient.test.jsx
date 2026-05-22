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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthContext } from '@/runtime/providers/AuthProvider';
import ProfileClient from '@/app/users/[uid]/ProfileClient';
import { createPublicProfileDateFixture as createProfile } from '../../_helpers/profile-fixtures';

const firestoreMock = vi.hoisted(() => ({
  collection: vi.fn((db, ...segments) => ({ type: 'collection', db, path: segments.join('/') })),
  collectionGroup: vi.fn((db, path) => ({ type: 'collectionGroup', db, path })),
  doc: vi.fn((db, ...segments) => ({ type: 'doc', db, path: segments.join('/') })),
  getCountFromServer: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((count) => ({ type: 'limit', count })),
  orderBy: vi.fn((field, direction) => ({ type: 'orderBy', field, direction })),
  query: vi.fn((source, ...constraints) => ({ source, constraints })),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ type: 'serverTimestamp' })),
  setDoc: vi.fn(),
  startAfter: vi.fn((cursor) => ({ type: 'startAfter', cursor })),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
}));

vi.mock('firebase/firestore', () => firestoreMock);

vi.mock('@/config/client/firebase-client', () => ({
  db: { app: 'test-firestore' },
}));

vi.mock('next/image', () => ({
  /**
   * @param {object} props - Mocked next/image props.
   * @param {string} props.src - Image source.
   * @param {string} props.alt - Image alt text.
   * @returns {import('react').ReactElement} 普通 img 模擬。
   */
  default: ({ src, alt, ...rest }) => <img src={src} alt={alt} {...rest} />,
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
   * @param {number} [props.followersCount] - Followers count.
   * @param {number} [props.followingCount] - Following count.
   * @param {(direction: 'followers') => void} [props.onOpenFollowers] - Followers click handler.
   * @param {(direction: 'following') => void} [props.onOpenFollowing] - Following click handler.
   * @returns {import('react').ReactElement} Mocked stats.
   */
  default: ({ stats, followersCount = 0, followingCount = 0, onOpenFollowers, onOpenFollowing }) => (
    <section aria-label="profile stats mock">
      <output aria-label="hosted count">{stats.hostedCount}</output>
      <output aria-label="joined count">{stats.joinedCount}</output>
      <output aria-label="total distance">
        {stats.totalDistanceKm === null ? 'hidden' : String(stats.totalDistanceKm)}
      </output>
      <button type="button" onClick={() => onOpenFollowers?.('followers')}>
        {followersCount} 位追蹤者
      </button>
      <button type="button" onClick={() => onOpenFollowing?.('following')}>
        {followingCount} 位追蹤中
      </button>
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
 * @property {number} [followersCount] - Public follower count.
 */

/**
 * 建立 Firebase count aggregate snapshot。
 * @param {number} count - 回傳數量。
 * @returns {{ data: () => { count: number } }} count snapshot。
 */
function makeCountSnap(count) {
  return { data: () => ({ count }) };
}

/**
 * 建立 Firestore doc snapshot。
 * @param {boolean} exists - 是否存在。
 * @returns {{ exists: () => boolean }} doc snapshot。
 */
function makeDocSnap(exists) {
  return { exists: () => exists };
}

/**
 * 建立 Firestore query snapshot。
 * @param {Array<{ id: string, data: () => object }>} docs - docs。
 * @returns {{ docs: Array<{ id: string, data: () => object }>, size: number }} query snapshot。
 */
function makeQuerySnap(docs) {
  return { docs, size: docs.length };
}

/**
 * 建立 follower/following document snapshot。
 * @param {{ uid: string, name: string }} data - Follow row data。
 * @param {'followers'|'following'} direction - Payload direction。
 * @returns {{ id: string, data: () => object }} follow doc snapshot。
 */
function makeFollowDoc(data, direction) {
  const isFollowers = direction === 'followers';
  return {
    id: data.uid,
    data: () => ({
      followerUid: isFollowers ? data.uid : 'viewer-uid',
      followerName: isFollowers ? data.name : 'Viewer Runner',
      followerPhotoURL: '',
      targetUid: isFollowers ? 'target-uid' : data.uid,
      targetName: isFollowers ? 'Target Runner' : data.name,
      targetPhotoURL: '',
      createdAt: 'now',
    }),
  };
}

/**
 * 建立帶 followersCount 的 public profile。
 * @param {Partial<MockPublicProfile>} overrides - 覆寫欄位。
 * @returns {MockPublicProfile} public profile。
 */
function createProfileWithFollowers(overrides) {
  const { followersCount, ...profileOverrides } = overrides;
  return {
    ...createProfile(profileOverrides),
    followersCount,
  };
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
    firestoreMock.getDoc.mockResolvedValue(makeDocSnap(false));
    firestoreMock.getDocs.mockImplementation((source) => {
      const path = source?.source?.path ?? source?.path ?? '';
      if (path.endsWith('/followers')) {
        return Promise.resolve(
          makeQuerySnap([makeFollowDoc({ uid: 'follower-1', name: 'Follower One' }, 'followers')]),
        );
      }
      if (path.endsWith('/following')) {
        return Promise.resolve(
          makeQuerySnap([makeFollowDoc({ uid: 'following-1', name: 'Following One' }, 'following')]),
        );
      }
      return Promise.resolve(makeQuerySnap([]));
    });
    firestoreMock.runTransaction.mockResolvedValue({ following: true, stateChanged: false });
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

  it('shows public follow counts and modal list rows to signed-out visitors without a follow button', async () => {
    const browser = userEvent.setup();
    const user = createProfileWithFollowers({ uid: 'target-uid', followersCount: 5 });

    renderProfileClient({ user });

    expect(await screen.findByRole('button', { name: '5 位追蹤者' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 位追蹤中' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '追蹤' })).not.toBeInTheDocument();

    await browser.click(screen.getByRole('button', { name: '5 位追蹤者' }));

    const dialog = await screen.findByRole('dialog', { name: '追蹤者' });
    const row = within(dialog).getByRole('listitem', { name: /Follower One/ });
    expect(within(row).getByRole('link', { name: 'Follower One' })).toHaveAttribute(
      'href',
      '/users/follower-1',
    );
    expect(within(row).queryByRole('button', { name: /追蹤/ })).not.toBeInTheDocument();
  });

  it('lets a signed-in non-self viewer follow and unfollow from the profile page', async () => {
    const browser = userEvent.setup();
    const user = createProfileWithFollowers({
      uid: 'target-uid',
      name: 'Target Runner',
      followersCount: 2,
    });

    renderProfileClient({ user, currentUser: { uid: 'viewer-uid' } });

    await browser.click(await screen.findByRole('button', { name: '追蹤' }));

    expect(screen.getByRole('button', { name: '追蹤中' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3 位追蹤者' })).toBeInTheDocument();

    firestoreMock.runTransaction.mockResolvedValueOnce({ following: false, stateChanged: true });
    await browser.click(screen.getByRole('button', { name: '追蹤中' }));

    expect(screen.getByRole('button', { name: '追蹤' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 位追蹤者' })).toBeInTheDocument();
  });

  it('disables the follow button with a pending label during mutation', async () => {
    const browser = userEvent.setup();
    let resolveMutation = /** @type {(value: { following: boolean, stateChanged: boolean }) => void} */ (
      () => {}
    );
    const pendingMutation = new Promise((resolve) => {
      resolveMutation = resolve;
    });
    firestoreMock.runTransaction.mockReturnValueOnce(pendingMutation);

    renderProfileClient({
      user: createProfileWithFollowers({ uid: 'target-uid', followersCount: 0 }),
      currentUser: { uid: 'viewer-uid' },
    });

    await browser.click(await screen.findByRole('button', { name: '追蹤' }));

    expect(screen.getByRole('button', { name: '追蹤中' })).toBeDisabled();

    resolveMutation({ following: true, stateChanged: true });
  });

  it('rolls back optimistic follow state and shows a toast when follow fails', async () => {
    const browser = userEvent.setup();
    firestoreMock.runTransaction.mockRejectedValueOnce(new Error('write failed'));

    renderProfileClient({
      user: createProfileWithFollowers({ uid: 'target-uid', followersCount: 4 }),
      currentUser: { uid: 'viewer-uid' },
    });

    await browser.click(await screen.findByRole('button', { name: '追蹤' }));

    expect(await screen.findByText('追蹤失敗，請稍後再試。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '追蹤' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4 位追蹤者' })).toBeInTheDocument();
  });

  it('hides follow controls on the signed-in viewer self profile', async () => {
    renderProfileClient({
      user: createProfileWithFollowers({ uid: 'viewer-uid', followersCount: 3 }),
      currentUser: { uid: 'viewer-uid' },
    });

    expect(await screen.findByRole('button', { name: '3 位追蹤者' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '追蹤' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '追蹤中' })).not.toBeInTheDocument();
  });
});
