/**
 * @file Integration Test for EventCardMenu Component
 * @description
 * TDD RED phase — tests for a three-dot menu component that does NOT exist yet.
 * Covers: FR-001, FR-002, FR-003, FR-014.
 *
 * Component path (expected): src/components/EventCardMenu
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. Use `@testing-library/react` for components.
 * 3. Use `user-event` for interactions — NEVER low-level event helpers.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 * 6. AAA Pattern (Arrange, Act, Assert) is mandatory.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import EventCardMenu from '@/components/EventCardMenu';

/**
 * @typedef {object} EventData
 * @property {string} id - 活動 ID。
 * @property {string} hostUid - 主揪 UID。
 * @property {string} hostName - 主揪名稱。
 * @property {string} title - 活動標題。
 * @property {number} maxParticipants - 人數上限。
 * @property {number} participantsCount - 目前參加人數。
 * @property {number} remainingSeats - 剩餘名額。
 * @property {number} distanceKm - 距離。
 * @property {number} paceSec - 配速秒數。
 * @property {string} city - 縣市。
 * @property {string} district - 區域。
 * @property {string} meetPlace - 集合地點。
 * @property {string} time - 活動時間。
 * @property {string} registrationDeadline - 報名截止時間。
 */

/**
 * @typedef {object} User
 * @property {string} uid - 使用者 UID。
 */

/**
 * 建立預設的 mock event 資料。
 * @param {Partial<EventData>} [overrides] - 要覆蓋的欄位。
 * @returns {EventData} 完整的 mock event 資料。
 */
function createMockEvent(overrides = {}) {
  return {
    id: 'event-1',
    hostUid: 'host-uid-001',
    hostName: 'Test Host',
    title: '大安森林公園晨跑',
    maxParticipants: 10,
    participantsCount: 3,
    remainingSeats: 7,
    distanceKm: 5,
    paceSec: 360,
    city: '臺北市',
    district: '大安區',
    meetPlace: '大安森林公園 2 號出口',
    time: '2026-04-01T08:00',
    registrationDeadline: '2026-03-31T23:59',
    ...overrides,
  };
}

describe('Integration: EventCardMenu', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- FR-001: 三點按鈕僅創建人可見 ---

  it('should render three-dot button when user is the event creator (FR-001)', () => {
    // Arrange
    /** @type {User} */
    const currentUser = { uid: 'host-uid-001' };
    const event = createMockEvent();

    render(
      <EventCardMenu
        event={event}
        currentUserUid={currentUser.uid}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Act
    const menuButton = screen.getByRole('button', { name: /更多操作/i });

    // Assert
    expect(menuButton).toBeInTheDocument();
  });

  it('should NOT render three-dot button when user is NOT the creator (FR-001)', () => {
    // Arrange
    /** @type {User} */
    const currentUser = { uid: 'other-user-999' };
    const event = createMockEvent();

    const { container } = render(
      <EventCardMenu
        event={event}
        currentUserUid={currentUser.uid}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Act & Assert
    expect(screen.queryByRole('button', { name: /更多操作/i })).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });

  it('should NOT render three-dot button when user is not logged in (Edge Case)', () => {
    // Arrange
    const event = createMockEvent();

    const { container } = render(
      <EventCardMenu event={event} currentUserUid={null} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );

    // Act & Assert
    expect(screen.queryByRole('button', { name: /更多操作/i })).not.toBeInTheDocument();
    expect(container.innerHTML).toBe('');
  });

  // --- FR-002: 下拉選單顯示「編輯活動」和「刪除活動」 ---

  it('should show dropdown with "編輯活動" and "刪除活動" when three-dot is clicked (FR-002)', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent();

    render(
      <EventCardMenu
        event={event}
        currentUserUid="host-uid-001"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Act
    const menuButton = screen.getByRole('button', { name: /更多操作/i });
    await user.click(menuButton);

    // Assert
    expect(screen.getByRole('menuitem', { name: /編輯活動/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /刪除活動/i })).toBeInTheDocument();
  });

  it('should NOT show dropdown before three-dot button is clicked', () => {
    // Arrange
    const event = createMockEvent();

    render(
      <EventCardMenu
        event={event}
        currentUserUid="host-uid-001"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Act & Assert
    expect(screen.queryByRole('menuitem', { name: /編輯活動/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /刪除活動/i })).not.toBeInTheDocument();
  });

  // --- FR-003: 點擊選單外部區域，下拉選單關閉 ---

  it('should close dropdown when clicking outside (FR-003)', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent();

    render(
      <div>
        <EventCardMenu
          event={event}
          currentUserUid="host-uid-001"
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
        <button type="button">外部按鈕</button>
      </div>,
    );

    // 先打開選單
    const menuButton = screen.getByRole('button', { name: /更多操作/i });
    await user.click(menuButton);
    expect(screen.getByRole('menuitem', { name: /編輯活動/i })).toBeInTheDocument();

    // Act — 點擊外部
    const outsideButton = screen.getByRole('button', { name: /外部按鈕/i });
    await user.click(outsideButton);

    // Assert — 選單應已關閉
    expect(screen.queryByRole('menuitem', { name: /編輯活動/i })).not.toBeInTheDocument();
  });

  // --- Callback Tests ---

  it('should call onEdit with event when "編輯活動" is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent();
    /** @type {import('vitest').Mock} */
    const mockOnEdit = vi.fn();

    render(
      <EventCardMenu
        event={event}
        currentUserUid="host-uid-001"
        onEdit={mockOnEdit}
        onDelete={vi.fn()}
      />,
    );

    // Act
    const menuButton = screen.getByRole('button', { name: /更多操作/i });
    await user.click(menuButton);

    const editItem = screen.getByRole('menuitem', { name: /編輯活動/i });
    await user.click(editItem);

    // Assert
    expect(mockOnEdit).toHaveBeenCalledWith(event);
    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it('should call onDelete with event when "刪除活動" is clicked', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent();
    /** @type {import('vitest').Mock} */
    const mockOnDelete = vi.fn();

    render(
      <EventCardMenu
        event={event}
        currentUserUid="host-uid-001"
        onEdit={vi.fn()}
        onDelete={mockOnDelete}
      />,
    );

    // Act
    const menuButton = screen.getByRole('button', { name: /更多操作/i });
    await user.click(menuButton);

    const deleteItem = screen.getByRole('menuitem', { name: /刪除活動/i });
    await user.click(deleteItem);

    // Assert
    expect(mockOnDelete).toHaveBeenCalledWith(event);
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('should close dropdown after selecting a menu item', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent();

    render(
      <EventCardMenu
        event={event}
        currentUserUid="host-uid-001"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    // Act
    const menuButton = screen.getByRole('button', { name: /更多操作/i });
    await user.click(menuButton);

    const editItem = screen.getByRole('menuitem', { name: /編輯活動/i });
    await user.click(editItem);

    // Assert — 選單關閉
    expect(screen.queryByRole('menuitem', { name: /編輯活動/i })).not.toBeInTheDocument();
  });

  // --- FR-014: 同一時間只能開啟一個下拉選單 ---

  it('should toggle dropdown off when clicking three-dot button again', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent();

    render(
      <EventCardMenu
        event={event}
        currentUserUid="host-uid-001"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const menuButton = screen.getByRole('button', { name: /更多操作/i });

    // Act — 打開
    await user.click(menuButton);
    expect(screen.getByRole('menuitem', { name: /編輯活動/i })).toBeInTheDocument();

    // Act — 再點一次關閉
    await user.click(menuButton);

    // Assert
    expect(screen.queryByRole('menuitem', { name: /編輯活動/i })).not.toBeInTheDocument();
  });
});
