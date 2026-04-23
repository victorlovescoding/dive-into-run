/**
 * @file Integration tests for thin-entry `ProfileClient`.
 * @description
 * S023 後 page-level boundary 改為 `mock runtime hook + render thin entry`。
 * 這個 suite 只驗證：
 * 1. `ProfileClient` 會把 server `user` prop 傳給 `useProfileRuntime`
 * 2. thin entry 會把 runtime state 接到 `ProfileScreen`
 * 3. page-level tests 不再 mock legacy facade `@/lib/firebase-profile`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/runtime/hooks/useProfileRuntime', () => ({
  default: vi.fn(),
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
   * @returns {import('react').ReactElement} Mocked event list.
   */
  default: ({ uid }) => <div data-testid="profile-events-mock">{uid}</div>,
}));

import useProfileRuntime from '@/runtime/hooks/useProfileRuntime';
import ProfileClient from '@/app/users/[uid]/ProfileClient';

const mockedUseProfileRuntime = /** @type {import('vitest').Mock} */ (useProfileRuntime);

/**
 * @typedef {object} MockPublicProfile
 * @property {string} uid - UID。
 * @property {string} name - 名稱。
 * @property {string} photoURL - 頭像 URL。
 * @property {string} [bio] - 簡介。
 * @property {Date} createdAt - 加入日期。
 */

/**
 * @typedef {object} MockRuntime
 * @property {string} profileUid - profile uid。
 * @property {Omit<MockPublicProfile, 'createdAt'> & { createdAt: { toDate: () => Date } }} headerUser - header user。
 * @property {{ hostedCount: number, joinedCount: number, totalDistanceKm: number | null } | null} stats - stats。
 * @property {boolean} isStatsLoading - stats 是否載入中。
 * @property {string | null} statsError - 錯誤訊息。
 * @property {boolean} isSelf - 是否為本人檔案。
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
 * 建立 runtime mock。
 * @param {Partial<MockRuntime>} [overrides] - 覆蓋欄位。
 * @returns {MockRuntime} runtime。
 */
function createRuntime(overrides = {}) {
  const profile = createProfile();
  return {
    profileUid: profile.uid,
    headerUser: { ...profile, createdAt: { toDate: () => profile.createdAt } },
    stats: { hostedCount: 3, joinedCount: 7, totalDistanceKm: 52.5 },
    isStatsLoading: false,
    statsError: null,
    isSelf: false,
    ...overrides,
  };
}

describe('Integration: ProfileClient thin entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseProfileRuntime.mockReturnValue(createRuntime());
  });

  it('passes the server user prop into useProfileRuntime', () => {
    const user = createProfile({ uid: 'user-xyz' });

    render(<ProfileClient user={user} />);

    expect(mockedUseProfileRuntime).toHaveBeenCalledTimes(1);
    expect(mockedUseProfileRuntime).toHaveBeenCalledWith(user);
  });

  it('renders header, stats, and event list from runtime boundary', () => {
    render(<ProfileClient user={createProfile()} />);

    expect(screen.getByTestId('profile-header-mock')).toBeInTheDocument();
    expect(screen.getByTestId('header-name')).toHaveTextContent('Alice Runner');
    expect(screen.getByTestId('header-uid')).toHaveTextContent('user-abc');
    expect(screen.getByTestId('header-bio')).toHaveTextContent('每天晨跑 5 公里。');
    expect(screen.getByTestId('profile-stats-mock')).toBeInTheDocument();
    expect(screen.getByTestId('stats-hosted')).toHaveTextContent('3');
    expect(screen.getByTestId('stats-joined')).toHaveTextContent('7');
    expect(screen.getByTestId('stats-distance')).toHaveTextContent('52.5');
    expect(screen.getByTestId('profile-events-mock')).toHaveTextContent('user-abc');
  });

  it('shows loading state when runtime reports stats loading', () => {
    mockedUseProfileRuntime.mockReturnValue(
      createRuntime({
        stats: null,
        isStatsLoading: true,
      }),
    );

    render(<ProfileClient user={createProfile()} />);

    expect(screen.getByTestId('profile-header-mock')).toBeInTheDocument();
    expect(screen.getByText(/載入中/)).toBeInTheDocument();
    expect(screen.queryByTestId('profile-stats-mock')).not.toBeInTheDocument();
  });

  it('shows error state when runtime reports stats error', () => {
    mockedUseProfileRuntime.mockReturnValue(
      createRuntime({
        stats: null,
        isStatsLoading: false,
        statsError: '無法載入統計',
      }),
    );

    render(<ProfileClient user={createProfile()} />);

    expect(screen.getByText('無法載入統計')).toBeInTheDocument();
    expect(screen.queryByTestId('profile-stats-mock')).not.toBeInTheDocument();
  });

  it('passes null totalDistanceKm through to ProfileStats', () => {
    mockedUseProfileRuntime.mockReturnValue(
      createRuntime({
        stats: { hostedCount: 3, joinedCount: 7, totalDistanceKm: null },
      }),
    );

    render(<ProfileClient user={createProfile()} />);

    expect(screen.getByTestId('stats-distance')).toHaveTextContent('hidden');
  });

  it('shows self-profile banner and edit link when runtime marks own profile', () => {
    mockedUseProfileRuntime.mockReturnValue(
      createRuntime({
        isSelf: true,
      }),
    );

    render(<ProfileClient user={createProfile({ uid: 'user-self' })} />);

    expect(screen.getByRole('complementary', { name: '這是你的公開檔案' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '編輯個人資料' })).toHaveAttribute('href', '/member');
  });

  it('does not show self-profile banner when runtime marks another profile', () => {
    render(<ProfileClient user={createProfile({ uid: 'user-other' })} />);

    expect(
      screen.queryByRole('complementary', { name: '這是你的公開檔案' }),
    ).not.toBeInTheDocument();
  });
});
