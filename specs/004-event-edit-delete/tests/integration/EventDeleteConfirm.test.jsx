/**
 * @file Integration Test for EventDeleteConfirm Component
 * @description
 * TDD RED phase — tests for a custom delete confirmation dialog that does NOT exist yet.
 * Covers: FR-010, FR-011, FR-012, FR-013.
 *
 * Component path (expected): src/components/EventDeleteConfirm
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. Use `@testing-library/react` for components.
 * 3. Use `user-event` for interactions — NEVER `fireEvent`.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 * 6. AAA Pattern (Arrange, Act, Assert) is mandatory.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import EventDeleteConfirm from '@/components/EventDeleteConfirm';

/**
 * @typedef {object} EventData
 * @property {string} id - 活動 ID。
 * @property {string} title - 活動標題。
 * @property {string} hostUid - 主揪 UID。
 */

describe('Integration: EventDeleteConfirm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- FR-010: 自訂確認視窗顯示 ---

  it('should render confirmation message "確定要刪除活動？" (FR-010)', () => {
    // Arrange
    render(
      <EventDeleteConfirm
        eventId="event-1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Act & Assert
    expect(screen.getByText(/確定要刪除活動/i)).toBeInTheDocument();
  });

  it('should render "是" and "否" buttons (FR-010)', () => {
    // Arrange
    render(
      <EventDeleteConfirm
        eventId="event-1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Act & Assert
    expect(screen.getByRole('button', { name: /^是$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^否$/i })).toBeInTheDocument();
  });

  it('should be a custom dialog, not a native confirm (FR-010)', () => {
    // Arrange
    render(
      <EventDeleteConfirm
        eventId="event-1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Act & Assert — 應有 dialog role
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // --- 使用者選擇「否」 ---

  it('should call onCancel when "否" is clicked (US2-AC2)', async () => {
    // Arrange
    const user = userEvent.setup();
    /** @type {import('vitest').Mock} */
    const mockOnCancel = vi.fn();

    render(
      <EventDeleteConfirm
        eventId="event-1"
        onConfirm={vi.fn()}
        onCancel={mockOnCancel}
      />,
    );

    // Act
    const noButton = screen.getByRole('button', { name: /^否$/i });
    await user.click(noButton);

    // Assert
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  // --- 使用者選擇「是」 ---

  it('should call onConfirm with eventId when "是" is clicked (US2-AC3)', async () => {
    // Arrange
    const user = userEvent.setup();
    /** @type {import('vitest').Mock} */
    const mockOnConfirm = vi.fn();

    render(
      <EventDeleteConfirm
        eventId="event-to-delete"
        onConfirm={mockOnConfirm}
        onCancel={vi.fn()}
      />,
    );

    // Act
    const yesButton = screen.getByRole('button', { name: /^是$/i });
    await user.click(yesButton);

    // Assert
    expect(mockOnConfirm).toHaveBeenCalledWith('event-to-delete');
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  // --- Loading State: 刪除進行中 ---

  it('should disable both buttons while deletion is in progress', () => {
    // Arrange
    render(
      <EventDeleteConfirm
        eventId="event-1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        isDeleting
      />,
    );

    // Act
    const yesButton = screen.getByRole('button', { name: /是|刪除中/i });
    const noButton = screen.getByRole('button', { name: /^否$/i });

    // Assert
    expect(yesButton).toBeDisabled();
    expect(noButton).toBeDisabled();
  });

  // --- FR-013: 刪除失敗時顯示錯誤訊息 ---

  it('should display error message when deleteError is provided (FR-013)', () => {
    // Arrange
    render(
      <EventDeleteConfirm
        eventId="event-1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
        deleteError="發生錯誤，請再試一次"
      />,
    );

    // Act & Assert
    expect(screen.getByText(/發生錯誤，請再試一次/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should NOT display error message when deleteError is not provided', () => {
    // Arrange
    render(
      <EventDeleteConfirm
        eventId="event-1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Act & Assert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // --- Accessibility ---

  it('should have proper aria-modal attribute on dialog', () => {
    // Arrange
    render(
      <EventDeleteConfirm
        eventId="event-1"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Act
    const dialog = screen.getByRole('dialog');

    // Assert
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
