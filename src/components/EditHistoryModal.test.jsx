import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import EditHistoryModal from './EditHistoryModal';

const UPDATED_AT = {
  toDate: () => new Date('2026-01-02T03:04:05.000Z'),
};

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
    this.open = true;
  });
});

describe('EditHistoryModal', () => {
  test('renders content-only current and history entries newest first', () => {
    render(
      <EditHistoryModal
        currentEntry={{ content: 'Current comment', updatedAt: UPDATED_AT }}
        history={[
          { id: 'oldest', content: 'Original comment', editedAt: UPDATED_AT },
          { id: 'newest', content: 'Previous comment', editedAt: UPDATED_AT },
        ]}
        historyError={null}
        onClose={vi.fn()}
      />,
    );

    const entries = screen.getAllByRole('listitem');

    expect(within(entries[0]).getByText('目前版本')).toBeInTheDocument();
    expect(within(entries[0]).getByText('Current comment')).toBeInTheDocument();
    expect(within(entries[1]).getByText('Previous comment')).toBeInTheDocument();
    expect(within(entries[2]).getByText('原始版本')).toBeInTheDocument();
    expect(within(entries[2]).getByText('Original comment')).toBeInTheDocument();
  });

  test('renders title and content fields for generic edit history entries', () => {
    render(
      <EditHistoryModal
        currentEntry={{
          title: 'Current title',
          content: 'Current article body',
          updatedAt: UPDATED_AT,
        }}
        history={[
          {
            id: 'history-1',
            title: 'Previous title',
            content: 'Previous article body',
            editedAt: UPDATED_AT,
          },
        ]}
        historyError={null}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Current title')).toBeInTheDocument();
    expect(screen.getByText('Current article body')).toBeInTheDocument();
    expect(screen.getByText('Previous title')).toBeInTheDocument();
    expect(screen.getByText('Previous article body')).toBeInTheDocument();
  });

  test('shows an error without closing the modal', () => {
    render(
      <EditHistoryModal
        currentEntry={{ content: 'Current comment' }}
        history={[]}
        historyError="載入編輯記錄失敗"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: '編輯記錄' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('載入編輯記錄失敗');
  });

  test('calls onClose from the close button', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <EditHistoryModal
        currentEntry={{ content: 'Current comment' }}
        history={[]}
        historyError={null}
        onClose={handleClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: '關閉' }));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
