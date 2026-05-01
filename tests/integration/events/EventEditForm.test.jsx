/**
 * @file Integration Test for EventEditForm Component
 * @description
 * TDD RED phase — tests for the event edit form that does NOT exist yet.
 * The edit form reuses the create form structure but with prefilled data,
 * different button labels, and dirty-state detection.
 *
 * Covers: FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-015.
 *
 * Component path (expected): src/components/EventEditForm
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
import EventEditForm from '@/components/EventEditForm';

/**
 * @typedef {object} EditableEventData
 * @property {string} id - 活動 ID。
 * @property {string} title - 活動標題。
 * @property {string} time - 活動時間 (datetime-local 格式)。
 * @property {string} registrationDeadline - 報名截止時間。
 * @property {string} city - 縣市。
 * @property {string} district - 區域。
 * @property {string} meetPlace - 集合地點。
 * @property {string} runType - 跑步類型。
 * @property {number} distanceKm - 距離（公里）。
 * @property {number} paceSec - 配速秒數。
 * @property {number} maxParticipants - 人數上限。
 * @property {number} participantsCount - 目前參加人數。
 * @property {string} [description] - 活動說明。
 * @property {string} hostUid - 主揪 UID。
 * @property {string} hostName - 主揪名稱。
 */

/**
 * 建立預設的 mock event 資料供編輯表單使用。
 * @param {Partial<EditableEventData>} [overrides] - 要覆蓋的欄位。
 * @returns {EditableEventData} 完整的 mock event 資料。
 */
function createMockEvent(overrides = {}) {
  return {
    id: 'event-edit-1',
    title: '大安森林公園晨跑',
    time: '2026-04-01T08:00',
    registrationDeadline: '2026-03-31T23:59',
    city: '臺北市',
    district: '大安區',
    meetPlace: '大安森林公園 2 號出口',
    runType: 'easy_run',
    distanceKm: 5,
    paceSec: 360,
    maxParticipants: 10,
    participantsCount: 3,
    description: '輕鬆跑，歡迎新手參加',
    hostUid: 'host-uid-001',
    hostName: 'Test Host',
    ...overrides,
  };
}

describe('Integration: EventEditForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- FR-004: 表單預填所有現有資料 ---

  it('should prefill form with existing event data (FR-004)', () => {
    // Arrange
    const event = createMockEvent();

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Act & Assert — 驗證各欄位已預填
    expect(screen.getByLabelText(/活動名稱/i)).toHaveValue('大安森林公園晨跑');
    expect(screen.getByLabelText(/活動時間/i)).toHaveValue('2026-04-01T08:00');
    expect(screen.getByLabelText(/報名截止時間/i)).toHaveValue('2026-03-31T23:59');
    expect(screen.getByLabelText(/集合地點/i)).toHaveValue('大安森林公園 2 號出口');
    expect(screen.getByLabelText(/距離/i)).toHaveValue(5);
    expect(screen.getByLabelText(/人數上限/i)).toHaveValue(10);
  });

  it('should prefill pace dropdowns with correct minutes and seconds', () => {
    // Arrange — paceSec = 360 → 6 分 00 秒
    const event = createMockEvent({ paceSec: 390 }); // 6 分 30 秒

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Act & Assert
    expect(screen.getByLabelText(/配速.*分/i)).toHaveValue('06');
    expect(screen.getByLabelText(/配速.*秒/i)).toHaveValue('30');
  });

  it('should prefill description textarea', () => {
    // Arrange
    const event = createMockEvent({ description: '特殊活動說明' });

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Act & Assert
    expect(screen.getByLabelText(/活動說明/i)).toHaveValue('特殊活動說明');
  });

  // --- FR-005: 按鈕名稱 ---

  it('should show "取消編輯" and "編輯完成" buttons (FR-005)', () => {
    // Arrange
    const event = createMockEvent();

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Act & Assert
    expect(screen.getByRole('button', { name: /取消編輯/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /編輯完成/i })).toBeInTheDocument();
  });

  it('should NOT show "建立活動" or "取消" buttons (distinguish from create form)', () => {
    // Arrange
    const event = createMockEvent();

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Act & Assert
    expect(screen.queryByRole('button', { name: /^建立活動$/i })).not.toBeInTheDocument();
  });

  // --- FR-006: 未修改時「編輯完成」不可點擊 ---

  it('should disable "編輯完成" button when no changes have been made (FR-006)', () => {
    // Arrange
    const event = createMockEvent();

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Act
    const submitButton = screen.getByRole('button', { name: /編輯完成/i });

    // Assert
    expect(submitButton).toBeDisabled();
  });

  // --- FR-007: 修改欄位後「編輯完成」變為可點擊 ---

  it('should enable "編輯完成" button when a field is modified (FR-007)', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent();

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const submitButton = screen.getByRole('button', { name: /編輯完成/i });
    expect(submitButton).toBeDisabled();

    // Act — 修改標題
    const titleInput = screen.getByLabelText(/活動名稱/i);
    await user.clear(titleInput);
    await user.type(titleInput, '修改後的活動名稱');

    // Assert
    expect(submitButton).toBeEnabled();
  });

  it('should disable "編輯完成" button again when field is reverted to original value (AC-3 of Story 3)', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent({ title: 'Original Title' });

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const submitButton = screen.getByRole('button', { name: /編輯完成/i });
    const titleInput = screen.getByLabelText(/活動名稱/i);

    // Act — 修改再改回
    await user.clear(titleInput);
    await user.type(titleInput, 'Changed Title');
    expect(submitButton).toBeEnabled();

    await user.clear(titleInput);
    await user.type(titleInput, 'Original Title');

    // Assert — 回到 disabled
    expect(submitButton).toBeDisabled();
  });

  // --- FR-008: 提交更新 ---

  it('should call onSubmit with updated data when "編輯完成" is clicked (FR-008)', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent();
    /** @type {import('vitest').Mock} */
    const mockOnSubmit = vi.fn();

    render(<EventEditForm event={event} onSubmit={mockOnSubmit} onCancel={vi.fn()} />);

    // Act — 修改標題讓按鈕可點
    const titleInput = screen.getByLabelText(/活動名稱/i);
    await user.clear(titleInput);
    await user.type(titleInput, '新活動標題');

    const submitButton = screen.getByRole('button', { name: /編輯完成/i });
    await user.click(submitButton);

    // Assert
    const submittedData = mockOnSubmit.mock.calls[0][0];
    expect(submittedData.title).toBe('新活動標題');
    expect(submittedData.id).toBe('event-edit-1');
  });

  // --- FR-009: 取消編輯 ---

  it('should call onCancel when "取消編輯" is clicked (US1-AC8)', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent();
    /** @type {import('vitest').Mock} */
    const mockOnCancel = vi.fn();

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={mockOnCancel} />);

    // Act
    const cancelButton = screen.getByRole('button', { name: /取消編輯/i });
    await user.click(cancelButton);

    // Assert
    expect(mockOnCancel).toHaveBeenCalled();
  });

  // --- FR-015: 人數上限不能低於目前報名人數 ---

  it('should set maxParticipants minimum to current participantsCount (FR-015)', () => {
    // Arrange — 目前有 5 人報名
    const event = createMockEvent({ participantsCount: 5, maxParticipants: 10 });

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Act & Assert — min 屬性應為 max(participantsCount, 2) = 5
    expect(screen.getByLabelText(/人數上限/i)).toHaveAttribute('min', '5');
  });

  it('should use min=2 when participantsCount is less than 2', () => {
    // Arrange — 目前有 0 人報名
    const event = createMockEvent({ participantsCount: 0, maxParticipants: 10 });

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    // Act & Assert — min 屬性應為 2（最小值）
    expect(screen.getByLabelText(/人數上限/i)).toHaveAttribute('min', '2');
  });

  // --- Dirty State: 多欄位偵測 ---

  it('should detect changes in numeric fields (distanceKm)', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent({ distanceKm: 5 });

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const submitButton = screen.getByRole('button', { name: /編輯完成/i });
    expect(submitButton).toBeDisabled();

    // Act — 修改距離
    const distanceInput = screen.getByLabelText(/距離/i);
    await user.clear(distanceInput);
    await user.type(distanceInput, '10');

    // Assert
    expect(submitButton).toBeEnabled();
  });

  it('should detect changes in description textarea', async () => {
    // Arrange
    const user = userEvent.setup();
    const event = createMockEvent({ description: '原始說明' });

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const submitButton = screen.getByRole('button', { name: /編輯完成/i });
    expect(submitButton).toBeDisabled();

    // Act
    const descTextarea = screen.getByLabelText(/活動說明/i);
    await user.clear(descTextarea);
    await user.type(descTextarea, '修改後的說明');

    // Assert
    expect(submitButton).toBeEnabled();
  });

  // --- Edge Case: 表單送出中的 loading 狀態 ---

  it('should disable submit button and show loading text while submitting', () => {
    // Arrange
    const event = createMockEvent();

    render(<EventEditForm event={event} onSubmit={vi.fn()} onCancel={vi.fn()} isSubmitting />);

    // Act
    const submitButton = screen.getByRole('button', { name: /編輯中|更新中/i });

    // Assert
    expect(submitButton).toBeDisabled();
  });
});
