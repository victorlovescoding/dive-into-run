import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ComposeModal from './ComposeModal';

/**
 * 建立 ComposeModal 測試用的預設 props。
 * @param {object} [overrides] - 要覆蓋的 props。
 * @returns {object} ComposeModal props。
 */
function createBaseProps(overrides = {}) {
  return {
    dialogRef: createRef(),
    title: '',
    content: '',
    onTitleChange: vi.fn(),
    onContentChange: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    ...overrides,
  };
}

/**
 * Render opened ComposeModal so dialog content is reachable by accessibility queries.
 * @param {object} [overrides] - 要覆蓋的 props。
 * @returns {object} Testing Library render result and dialog references。
 */
function renderComposeModal(overrides = {}) {
  const props = createBaseProps(overrides);
  const view = render(<ComposeModal {...props} />);
  props.dialogRef.current?.setAttribute('open', '');
  return { ...view, props, dialog: props.dialogRef.current };
}

/**
 * 取得草稿確認面板中的 action buttons。
 * @returns {HTMLElement[]} 確認面板 action buttons。
 */
function getConfirmActions() {
  const confirmDialog = screen.getByRole('alertdialog', {
    name: '要儲存這篇草稿嗎？',
  });
  return within(confirmDialog).getAllByRole('button');
}

describe('ComposeModal', () => {
  it('routes X, Escape, and backdrop through onRequestClose without directly closing the native dialog', async () => {
    const user = userEvent.setup();
    const onRequestClose = vi.fn();
    const { dialog } = renderComposeModal({ onRequestClose });
    const nativeClose = vi.fn();
    dialog.close = nativeClose;

    await user.click(screen.getByRole('button', { name: '關閉' }));

    const cancelEvent = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancelEvent);

    dialog.getBoundingClientRect = vi.fn(() => ({
      bottom: 220,
      height: 120,
      left: 100,
      right: 220,
      top: 100,
      width: 120,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    }));
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 40, clientY: 40 }));

    expect(onRequestClose).toHaveBeenCalledTimes(3);
    expect(nativeClose).not.toHaveBeenCalled();
    expect(cancelEvent.defaultPrevented).toBe(true);
  });

  it('renders the draft confirmation copy and actions in spec order', () => {
    renderComposeModal({ isDraftConfirmOpen: true });

    const confirmDialog = screen.getByRole('alertdialog', {
      name: '要儲存這篇草稿嗎？',
    });

    expect(
      within(confirmDialog).getByText('下次開啟文章編輯器時，可以繼續編輯目前內容。')
    ).toBeInTheDocument();
    expect(getConfirmActions().map((button) => button.textContent)).toEqual([
      '存草稿',
      '繼續編輯',
      '不儲存並關閉',
    ]);
  });

  it('maps each draft confirmation action only to its corresponding handler', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn();
    const onContinueEditing = vi.fn();
    const onDiscardDraft = vi.fn();

    renderComposeModal({
      isDraftConfirmOpen: true,
      onSaveDraft,
      onContinueEditing,
      onDiscardDraft,
    });

    const [saveDraftButton, continueEditingButton, discardDraftButton] = getConfirmActions();

    await user.click(saveDraftButton);
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onContinueEditing).not.toHaveBeenCalled();
    expect(onDiscardDraft).not.toHaveBeenCalled();

    await user.click(continueEditingButton);
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onContinueEditing).toHaveBeenCalledTimes(1);
    expect(onDiscardDraft).not.toHaveBeenCalled();

    await user.click(discardDraftButton);
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onContinueEditing).toHaveBeenCalledTimes(1);
    expect(onDiscardDraft).toHaveBeenCalledTimes(1);
  });

  it('does not treat bubbled confirm action clicks as backdrop close requests', () => {
    const onRequestClose = vi.fn();
    const onSaveDraft = vi.fn();

    const { dialog } = renderComposeModal({
      isDraftConfirmOpen: true,
      onRequestClose,
      onSaveDraft,
    });
    dialog.getBoundingClientRect = vi.fn(() => ({
      bottom: 220,
      height: 120,
      left: 100,
      right: 220,
      top: 100,
      width: 120,
      x: 100,
      y: 100,
      toJSON: () => ({}),
    }));

    const [saveDraftButton] = getConfirmActions();
    saveDraftButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('disables background close and form controls while draft confirmation is open', async () => {
    const user = userEvent.setup();
    const onRequestClose = vi.fn();
    const onTitleChange = vi.fn();
    const onContentChange = vi.fn();
    const onSubmit = vi.fn((event) => event.preventDefault());

    renderComposeModal({
      isDraftConfirmOpen: true,
      onRequestClose,
      onTitleChange,
      onContentChange,
      onSubmit,
    });

    expect(screen.getByRole('button', { name: '關閉' })).toBeDisabled();
    expect(screen.getByPlaceholderText('標題')).toBeDisabled();
    expect(screen.getByPlaceholderText('分享你的想法...')).toBeDisabled();
    expect(screen.getByRole('button', { name: '發布' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '關閉' }));
    await user.type(screen.getByPlaceholderText('標題'), 'title');
    await user.type(screen.getByPlaceholderText('分享你的想法...'), 'content');
    await user.click(screen.getByRole('button', { name: '發布' }));

    expect(onRequestClose).not.toHaveBeenCalled();
    expect(onTitleChange).not.toHaveBeenCalled();
    expect(onContentChange).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('preserves existing submit dirty and disabled behavior', () => {
    const props = createBaseProps();
    const { rerender } = render(<ComposeModal {...props} />);
    props.dialogRef.current?.setAttribute('open', '');

    expect(screen.getByRole('button', { name: '發布' })).toBeEnabled();

    rerender(
      <ComposeModal
        {...props}
        isEditing
        title="原標題"
        content="原內容"
        originalTitle="原標題"
        originalContent="原內容"
      />
    );
    expect(screen.getByRole('button', { name: '更新' })).toBeDisabled();

    rerender(
      <ComposeModal
        {...props}
        isEditing
        title="新標題"
        content="原內容"
        originalTitle="原標題"
        originalContent="原內容"
      />
    );
    expect(screen.getByRole('button', { name: '更新' })).toBeEnabled();

    rerender(
      <ComposeModal
        {...props}
        isEditing
        isSubmitting
        title="新標題"
        content="原內容"
        originalTitle="原標題"
        originalContent="原內容"
      />
    );
    expect(screen.getByRole('button', { name: '更新中…' })).toBeDisabled();
  });
});
