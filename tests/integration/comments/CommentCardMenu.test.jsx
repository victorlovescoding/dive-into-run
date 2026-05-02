import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import CommentCardMenu from '@/components/CommentCardMenu';

/**
 * Render the comment card menu with callback spies.
 * @returns {{ user: ReturnType<typeof userEvent.setup>, onEdit: import('vitest').Mock, onDelete: import('vitest').Mock }} Rendered menu controls.
 */
function renderCommentCardMenu() {
  const user = userEvent.setup();
  const onEdit = vi.fn();
  const onDelete = vi.fn();

  render(<CommentCardMenu onEdit={onEdit} onDelete={onDelete} />);

  return { user, onEdit, onDelete };
}

/**
 * Open the comment card menu.
 * @param {ReturnType<typeof userEvent.setup>} user - User interaction helper.
 * @returns {Promise<{ trigger: HTMLElement, editItem: HTMLElement, deleteItem: HTMLElement }>} Menu controls.
 */
async function openMenu(user) {
  const trigger = screen.getByRole('button', { name: '更多操作' });

  await user.click(trigger);

  const editItem = screen.getByRole('menuitem', { name: '編輯留言' });
  const deleteItem = screen.getByRole('menuitem', { name: '刪除留言' });

  await waitFor(() => expect(editItem).toHaveFocus());

  return { trigger, editItem, deleteItem };
}

describe('CommentCardMenu', () => {
  it('opens from the trigger and focuses the first menu item', async () => {
    // Arrange
    const { user } = renderCommentCardMenu();
    const trigger = screen.getByRole('button', { name: '更多操作' });

    // Act
    await user.click(trigger);

    // Assert
    const menu = screen.getByRole('menu');
    const editItem = screen.getByRole('menuitem', { name: '編輯留言' });
    expect(menu).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(editItem).toHaveFocus());
  });

  it('moves focus with arrow keys and Home/End', async () => {
    // Arrange
    const { user } = renderCommentCardMenu();
    const { editItem, deleteItem } = await openMenu(user);

    // Act / Assert
    await user.keyboard('{ArrowDown}');
    expect(deleteItem).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(editItem).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(deleteItem).toHaveFocus();

    await user.keyboard('{Home}');
    expect(editItem).toHaveFocus();

    await user.keyboard('{End}');
    expect(deleteItem).toHaveFocus();
  });

  it('closes with Escape and returns focus to the trigger', async () => {
    // Arrange
    const { user } = renderCommentCardMenu();
    const { trigger } = await openMenu(user);

    // Act
    await user.keyboard('{Escape}');

    // Assert
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('closes when the user clicks outside the menu', async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <>
        <CommentCardMenu onEdit={vi.fn()} onDelete={vi.fn()} />
        <button type="button">外部目標</button>
      </>,
    );
    await openMenu(user);

    // Act
    await user.click(screen.getByRole('button', { name: '外部目標' }));

    // Assert
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '更多操作' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('runs the edit callback and closes the menu', async () => {
    // Arrange
    const { user, onEdit } = renderCommentCardMenu();
    await openMenu(user);

    // Act
    await user.click(screen.getByRole('menuitem', { name: '編輯留言' }));

    // Assert
    expect(onEdit).toHaveBeenCalledWith();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('runs the delete callback and closes the menu', async () => {
    // Arrange
    const { user, onDelete } = renderCommentCardMenu();
    await openMenu(user);

    // Act
    await user.click(screen.getByRole('menuitem', { name: '刪除留言' }));

    // Assert
    expect(onDelete).toHaveBeenCalledWith();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
