/**
 * @file Integration tests for `ProfileClient` — client orchestrator for public profile page.
 * @description
 * Covers Phase 2 (US1) orchestration responsibilities **and** Phase 5 (US4)
 * self-profile banner behaviour for `src/app/users/[uid]/ProfileClient.jsx`.
 *
 * ProfileClient responsibilities:
 *   - Receives `user` prop from the server component.
 *   - Calls `getProfileStats(uid)` on mount, drives loading / error.
 *   - Renders ProfileHeader + ProfileStats + ProfileEventList when ready.
 *   - Propagates `user` and `stats` into sub-components via props.
 *   - (US4) When the visitor's `AuthContext.user.uid` matches the profile uid,
 *     renders a "這是你的公開檔案" banner with an "編輯個人資料" link
 *     pointing to `/member`.
 *
 * Because Phase 2 wires the full page together, we mock the sub-components at
 * the boundary so this suite only asserts ProfileClient's orchestration
 * responsibilities — not the visual output of each child component (which is
 * covered by ProfileHeader / ProfileStats / ProfileEventList tests respectively).
 *
 * Rules:
 * 1. Mock `@/lib/firebase-profile`, sub-components, and `@/contexts/AuthContext`.
 * 2. `@testing-library/react` + `getByRole` / `getByText`.
 * 3. AAA Pattern; strict JSDoc; no `container.querySelector`.
 */

import { createContext } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { getProfileStats } from '@/lib/firebase-profile';

/* ==========================================================================
   Module mocks
   ========================================================================== */

vi.mock('@/lib/firebase-profile', () => ({
  getProfileStats: vi.fn(),
  getHostedEvents: vi.fn(),
}));

/**
 * @typedef {object} MockAuthUser
 * @property {string} uid - 登入使用者 UID。
 */

/**
 * @typedef {object} MockAuthContextValue
 * @property {MockAuthUser | null} user - 登入使用者，未登入時為 null。
 * @property {boolean} loading - 認證載入狀態。
 */

/**
 * 提供給測試的 mock AuthContext。每個 test case 透過 `<MockAuthContext.Provider>`
 * 注入不同的 user 狀態，用來覆蓋 ProfileClient 對 `useContext(AuthContext)` 的依賴。
 * @type {import('react').Context<MockAuthContextValue>}
 */
const MockAuthContext = createContext({ user: null, loading: false });

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: MockAuthContext,
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

// Mock sub-components to capture the props ProfileClient passes in.
vi.mock('@/app/users/[uid]/ProfileHeader', () => ({
  /**
   * @param {object} props - ProfileHeader props.
   * @param {{ uid: string, name: string, bio?: string }} props.user - Profile.
   * @returns {import('react').ReactElement} Mocked header.
   */
  default: ({ user }) => (
    <div data-testid="profile-header-mock">
      <span data-testid="header-name">{user.name}</span>
      <span data-testid="header-uid">{user.uid}</span>
      {user.bio != null && <span data-testid="header-bio">{user.bio}</span>}
    </div>
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
    <div data-testid="profile-stats-mock">
      <span data-testid="stats-hosted">{stats.hostedCount}</span>
      <span data-testid="stats-joined">{stats.joinedCount}</span>
      <span data-testid="stats-distance">
        {stats.totalDistanceKm === null ? 'hidden' : String(stats.totalDistanceKm)}
      </span>
    </div>
  ),
}));

vi.mock('@/app/users/[uid]/ProfileEventList', () => ({
  /**
   * @param {object} props - ProfileEventList props.
   * @param {string} props.uid - Target uid.
   * @returns {import('react').ReactElement} Mocked list.
   */
  default: ({ uid }) => <div data-testid="profile-events-mock">{uid}</div>,
}));

const mockedGetProfileStats = /** @type {import('vitest').Mock} */ (
  /** @type {unknown} */ (getProfileStats)
);

/* ==========================================================================
   Test data
   ========================================================================== */

/**
 * @typedef {object} MockPublicProfile
 * @property {string} uid - UID。
 * @property {string} name - 名稱。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 簡介。
 * @property {{ toDate: () => Date }} createdAt - 加入日期。
 */

/**
 * @typedef {object} MockProfileStats
 * @property {number} hostedCount - 開團數。
 * @property {number} joinedCount - 參團數。
 * @property {number | null} totalDistanceKm - 累計公里。
 */

/**
 * 建立測試用 public profile。
 * @param {Partial<MockPublicProfile>} [overrides] - 覆蓋欄位。
 * @returns {MockPublicProfile} Profile 物件。
 */
function createProfile(overrides = {}) {
  return {
    uid: 'user-abc',
    name: 'Alice Runner',
    photoURL: 'https://example.com/alice.jpg',
    bio: '每天晨跑 5 公里。',
    createdAt: { toDate: () => new Date(2024, 2, 15) },
    ...overrides,
  };
}

/**
 * 建立測試用 stats。
 * @param {Partial<MockProfileStats>} [overrides] - 覆蓋欄位。
 * @returns {MockProfileStats} Stats 物件。
 */
function createStats(overrides = {}) {
  return {
    hostedCount: 3,
    joinedCount: 7,
    totalDistanceKm: 52.5,
    ...overrides,
  };
}

/**
 * 動態載入 ProfileClient 元件。
 * @returns {Promise<(props: { user: MockPublicProfile }) => import('react').ReactElement>}
 *   ProfileClient 元件。
 */
async function importProfileClient() {
  const mod = await import('@/app/users/[uid]/ProfileClient');
  return /** @type {(props: { user: MockPublicProfile }) => import('react').ReactElement} */ (
    mod.default
  );
}

/**
 * 用 mock AuthContext.Provider 包裹 ProfileClient 後 render，讓單一測試
 * 可以注入「已登入」「未登入」「登入但是別人」三種情境。
 * @param {import('react').ReactElement} ui - 要 render 的元素。
 * @param {MockAuthContextValue} authValue - mock context 值。
 * @returns {ReturnType<typeof render>} testing-library render 結果。
 */
function renderWithAuth(ui, authValue) {
  return render(<MockAuthContext.Provider value={authValue}>{ui}</MockAuthContext.Provider>);
}

/* ==========================================================================
   Tests
   ========================================================================== */

describe('Integration: ProfileClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- 整合渲染: 三個子元件全部出現 ---
  it('renders Header, Stats and EventList after stats load', async () => {
    // Arrange
    const profile = createProfile();
    const stats = createStats();
    mockedGetProfileStats.mockResolvedValueOnce(stats);

    const ProfileClient = await importProfileClient();

    // Act
    render(<ProfileClient user={profile} />);

    // Assert — Header 立即渲染（拿到 user prop）
    expect(screen.getByTestId('profile-header-mock')).toBeInTheDocument();
    expect(screen.getByTestId('header-name')).toHaveTextContent('Alice Runner');
    expect(screen.getByTestId('header-uid')).toHaveTextContent('user-abc');
    expect(screen.getByTestId('header-bio')).toHaveTextContent('每天晨跑 5 公里。');

    // Stats 非同步 — 需等 getProfileStats 解開
    await waitFor(() => {
      expect(screen.getByTestId('profile-stats-mock')).toBeInTheDocument();
    });
    expect(screen.getByTestId('stats-hosted')).toHaveTextContent('3');
    expect(screen.getByTestId('stats-joined')).toHaveTextContent('7');
    expect(screen.getByTestId('stats-distance')).toHaveTextContent('52.5');

    // EventList 也應渲染，且拿到正確 uid
    expect(screen.getByTestId('profile-events-mock')).toHaveTextContent('user-abc');
  });

  // --- 呼叫 service layer ---
  it('calls getProfileStats with the correct uid on mount', async () => {
    // Arrange
    mockedGetProfileStats.mockResolvedValueOnce(createStats());
    const ProfileClient = await importProfileClient();

    // Act
    render(<ProfileClient user={createProfile({ uid: 'user-xyz' })} />);

    // Assert
    await waitFor(() => {
      expect(mockedGetProfileStats).toHaveBeenCalledTimes(1);
    });
    expect(mockedGetProfileStats).toHaveBeenCalledWith('user-xyz');
  });

  // --- Loading state ---
  it('shows a loading state while getProfileStats is pending', async () => {
    // Arrange — hang forever
    mockedGetProfileStats.mockImplementationOnce(() => new Promise(() => {}));

    const ProfileClient = await importProfileClient();

    // Act
    render(<ProfileClient user={createProfile()} />);

    // Assert — Header 會立刻出現，但 stats 區應顯示 loading
    expect(screen.getByTestId('profile-header-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-stats-mock')).not.toBeInTheDocument();
    expect(screen.getByText(/載入中/)).toBeInTheDocument();
  });

  // --- Error state ---
  it('shows an error state when getProfileStats rejects', async () => {
    // Arrange
    mockedGetProfileStats.mockRejectedValueOnce(new Error('stats failed'));

    const ProfileClient = await importProfileClient();

    // Act
    render(<ProfileClient user={createProfile()} />);

    // Assert — Header 仍渲染
    expect(screen.getByTestId('profile-header-mock')).toBeInTheDocument();

    // Stats 不渲染，改顯示錯誤訊息
    await waitFor(() => {
      expect(screen.getByText(/載入失敗|無法載入/)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('profile-stats-mock')).not.toBeInTheDocument();
  });

  // --- bio undefined 不會炸 ---
  it('renders even when profile bio is undefined', async () => {
    // Arrange
    const profile = createProfile({ bio: undefined });
    mockedGetProfileStats.mockResolvedValueOnce(createStats());

    const ProfileClient = await importProfileClient();

    // Act
    render(<ProfileClient user={profile} />);

    // Assert — Header mock 的 bio span 不應出現
    expect(screen.getByTestId('profile-header-mock')).toBeInTheDocument();
    expect(screen.queryByTestId('header-bio')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('profile-stats-mock')).toBeInTheDocument();
    });
  });

  // --- totalDistanceKm null 正確傳給 Stats ---
  it('passes null totalDistanceKm through to ProfileStats untouched', async () => {
    // Arrange
    mockedGetProfileStats.mockResolvedValueOnce(createStats({ totalDistanceKm: null }));
    const ProfileClient = await importProfileClient();

    // Act
    render(<ProfileClient user={createProfile()} />);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('stats-distance')).toHaveTextContent('hidden');
    });
  });

  /* ------------------------------------------------------------------------
     Phase 5 (US4) — self profile banner
     ------------------------------------------------------------------------ */

  // --- 已登入且造訪自己的檔案：顯示 banner ---
  it('shows 這是你的公開檔案 banner when currentUser.uid matches profile uid', async () => {
    // Arrange
    const profile = createProfile({ uid: 'user-self' });
    mockedGetProfileStats.mockResolvedValueOnce(createStats());
    const ProfileClient = await importProfileClient();

    // Act
    renderWithAuth(<ProfileClient user={profile} />, {
      user: { uid: 'user-self' },
      loading: false,
    });

    // Assert
    const banner = screen.getByRole('complementary', { name: '這是你的公開檔案' });
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('這是你的公開檔案');

    // 等 stats effect 解開，避免 act() warning 污染 console
    await waitFor(() => {
      expect(screen.getByTestId('profile-stats-mock')).toBeInTheDocument();
    });
  });

  // --- 已登入但造訪別人的檔案：不顯示 banner ---
  it('does not show banner when currentUser.uid differs from profile uid', async () => {
    // Arrange
    const profile = createProfile({ uid: 'user-other' });
    mockedGetProfileStats.mockResolvedValueOnce(createStats());
    const ProfileClient = await importProfileClient();

    // Act
    renderWithAuth(<ProfileClient user={profile} />, {
      user: { uid: 'user-self' },
      loading: false,
    });

    // Assert
    expect(
      screen.queryByRole('complementary', { name: '這是你的公開檔案' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('這是你的公開檔案')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('profile-stats-mock')).toBeInTheDocument();
    });
  });

  // --- 未登入：不顯示 banner ---
  it('does not show banner when currentUser is null (not logged in)', async () => {
    // Arrange
    const profile = createProfile({ uid: 'user-self' });
    mockedGetProfileStats.mockResolvedValueOnce(createStats());
    const ProfileClient = await importProfileClient();

    // Act
    renderWithAuth(<ProfileClient user={profile} />, {
      user: null,
      loading: false,
    });

    // Assert
    expect(
      screen.queryByRole('complementary', { name: '這是你的公開檔案' }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('profile-stats-mock')).toBeInTheDocument();
    });
  });

  // --- banner 內含「編輯個人資料」連結，導向 /member ---
  it('renders 編輯個人資料 link to /member in banner', async () => {
    // Arrange
    const profile = createProfile({ uid: 'user-self' });
    mockedGetProfileStats.mockResolvedValueOnce(createStats());
    const ProfileClient = await importProfileClient();

    // Act
    renderWithAuth(<ProfileClient user={profile} />, {
      user: { uid: 'user-self' },
      loading: false,
    });

    // Assert
    const editLink = screen.getByRole('link', { name: '編輯個人資料' });
    expect(editLink).toBeInTheDocument();
    expect(editLink).toHaveAttribute('href', '/member');

    await waitFor(() => {
      expect(screen.getByTestId('profile-stats-mock')).toBeInTheDocument();
    });
  });
});
