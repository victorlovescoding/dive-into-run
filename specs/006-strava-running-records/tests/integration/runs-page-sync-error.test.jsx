import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthContext } from '@/contexts/AuthContext';

// Mock Firebase to avoid initialization errors
vi.mock('@/lib/firebase-client', () => ({
  db: {},
  auth: {},
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
}));
vi.mock('@/lib/firebase-users', () => ({
  loginCheckUserData: vi.fn(),
  watchUserProfile: vi.fn(),
}));

// Mock hooks
vi.mock('@/hooks/useStravaConnection', () => ({
  default: vi.fn(),
}));
vi.mock('@/hooks/useStravaActivities', () => ({
  default: vi.fn(),
}));
vi.mock('@/hooks/useStravaSync', () => ({
  default: vi.fn(),
}));

// Mock child components — RunsActivityList renders activity names to verify cached data visibility
vi.mock('@/components/RunsLoginGuide', () => ({
  default: () => <div data-testid="login-guide">請先登入</div>,
}));
vi.mock('@/components/RunsConnectGuide', () => ({
  default: () => <div data-testid="connect-guide">連結 Strava</div>,
}));
vi.mock('@/components/RunsActivityList', () => ({
  default: ({ activities }) => (
    <ul data-testid="activity-list">
      {activities.map((a) => (
        <li key={a.stravaId}>{a.name}</li>
      ))}
    </ul>
  ),
}));

import useStravaConnection from '@/hooks/useStravaConnection';
import useStravaActivities from '@/hooks/useStravaActivities';
import useStravaSync from '@/hooks/useStravaSync';
import RunsPage from '@/app/runs/page';

const mockedUseConnection = /** @type {import('vitest').Mock} */ (useStravaConnection);
const mockedUseActivities = /** @type {import('vitest').Mock} */ (useStravaActivities);
const mockedUseSync = /** @type {import('vitest').Mock} */ (useStravaSync);

/**
 * @typedef {object} MockActivity
 * @property {string} stravaId - Strava 活動 ID。
 * @property {string} name - 活動名稱。
 * @property {number} distance - 距離（公尺）。
 */

/** @type {MockActivity[]} */
const mockActivities = [
  { stravaId: '100', name: '晨跑 5K', distance: 5000 },
  { stravaId: '101', name: '河濱慢跑', distance: 8000 },
];

const connectedUser = {
  uid: 'u1',
  name: 'Test',
  email: null,
  photoURL: null,
  getIdToken: vi.fn().mockResolvedValue('mock-token'),
};

/**
 * 用 AuthContext.Provider 包裝元件並渲染。
 * @param {import('react').ReactElement} ui - 要渲染的元件。
 * @param {object} [options] - 選項。
 * @param {object | null} [options.user] - 模擬使用者。
 * @param {boolean} [options.loading] - auth 載入狀態。
 * @returns {import('@testing-library/react').RenderResult} render 結果。
 */
function renderWithAuth(ui, { user = null, loading = false } = {}) {
  return render(
    <AuthContext.Provider value={{ user, setUser: vi.fn(), loading }}>{ui}</AuthContext.Provider>,
  );
}

describe('RunsPage sync error handling', () => {
  beforeEach(() => {
    mockedUseConnection.mockReturnValue({
      connection: { connected: true, athleteName: 'John Runner', lastSyncAt: null },
      isLoading: false,
      error: null,
    });
    mockedUseActivities.mockReturnValue({
      activities: mockActivities,
      isLoading: false,
      error: null,
      loadMore: vi.fn(),
      hasMore: false,
      isLoadingMore: false,
      refresh: vi.fn(),
    });
    mockedUseSync.mockReturnValue({
      sync: vi.fn(),
      isSyncing: false,
      cooldownRemaining: 0,
      error: null,
    });
  });

  it('should display sync error message when sync fails', () => {
    // Arrange
    mockedUseSync.mockReturnValue({
      sync: vi.fn(),
      isSyncing: false,
      cooldownRemaining: 0,
      error: '同步失敗，請稍後再試',
    });

    // Act
    renderWithAuth(<RunsPage />, { user: connectedUser });

    // Assert
    expect(screen.getByText('同步失敗，請稍後再試')).toBeInTheDocument();
  });

  it('should still display cached activities when sync fails', () => {
    // Arrange
    mockedUseSync.mockReturnValue({
      sync: vi.fn(),
      isSyncing: false,
      cooldownRemaining: 0,
      error: '同步失敗，請稍後再試',
    });

    // Act
    renderWithAuth(<RunsPage />, { user: connectedUser });

    // Assert — cached activities remain visible
    expect(screen.getByText('晨跑 5K')).toBeInTheDocument();
    expect(screen.getByText('河濱慢跑')).toBeInTheDocument();
    // Assert — sync error is also visible alongside activities
    expect(screen.getByText('同步失敗，請稍後再試')).toBeInTheDocument();
  });

  it('should not display sync error when sync succeeds', () => {
    // Arrange — default beforeEach has error: null, no override needed

    // Act
    renderWithAuth(<RunsPage />, { user: connectedUser });

    // Assert
    expect(screen.queryByText('同步失敗，請稍後再試')).not.toBeInTheDocument();
    expect(screen.queryByText(/同步失敗/)).not.toBeInTheDocument();
  });
});
