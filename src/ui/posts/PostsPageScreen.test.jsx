import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import PostsPageScreen from './PostsPageScreen';

const composeModalMock = vi.hoisted(() => vi.fn());

vi.mock('@/components/ComposeModal', () => ({
  default: (props) => {
    composeModalMock(props);
    return (
      <section
        aria-label="compose modal proxy"
        data-draft-confirm-open={String(props.isDraftConfirmOpen)}
      >
        <button type="button" onClick={props.onRequestClose}>
          request close
        </button>
        <button type="button" onClick={props.onSaveDraft}>
          save draft
        </button>
        <button type="button" onClick={props.onContinueEditing}>
          continue editing
        </button>
        <button type="button" onClick={props.onDiscardDraft}>
          discard draft
        </button>
      </section>
    );
  },
}));

/**
 * 建立 PostsPageScreen 測試用 runtime props。
 * @param {object} [overrides] - 要覆蓋的 runtime props。
 * @returns {object} Runtime props。
 */
function createRuntime(overrides = {}) {
  return {
    user: null,
    title: '',
    content: '',
    originalTitle: '',
    originalContent: '',
    isSubmitting: false,
    editingPostId: null,
    isLoading: false,
    posts: [],
    openMenuPostId: '',
    isLoadingNext: false,
    isDraftConfirmOpen: true,
    dialogRef: { current: null },
    bottomRef: { current: null },
    setTitle: vi.fn(),
    setContent: vi.fn(),
    handleComposeButton: vi.fn(),
    handlePressLike: vi.fn(),
    handleToggleOwnerMenu: vi.fn(),
    handleCloseOwnerMenu: vi.fn(),
    handleDeletePost: vi.fn(),
    handleSubmitPost: vi.fn(),
    handleToggleFavoritePost: vi.fn(),
    handleRequestComposerClose: vi.fn(),
    handleSaveComposerDraft: vi.fn(),
    handleContinueEditingDraft: vi.fn(),
    handleDiscardComposerDraft: vi.fn(),
    ...overrides,
  };
}

describe('PostsPageScreen', () => {
  test('passes draft confirmation props into ComposeModal', async () => {
    const user = userEvent.setup();
    const runtime = createRuntime();

    render(<PostsPageScreen runtime={runtime} />);

    expect(screen.getByLabelText('compose modal proxy')).toHaveAttribute(
      'data-draft-confirm-open',
      'true',
    );
    expect(composeModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isDraftConfirmOpen: true,
        onRequestClose: runtime.handleRequestComposerClose,
        onSaveDraft: runtime.handleSaveComposerDraft,
        onContinueEditing: runtime.handleContinueEditingDraft,
        onDiscardDraft: runtime.handleDiscardComposerDraft,
      }),
    );

    await user.click(screen.getByRole('button', { name: 'request close' }));
    await user.click(screen.getByRole('button', { name: 'save draft' }));
    await user.click(screen.getByRole('button', { name: 'continue editing' }));
    await user.click(screen.getByRole('button', { name: 'discard draft' }));

    expect(runtime.handleRequestComposerClose).toHaveBeenCalledTimes(1);
    expect(runtime.handleSaveComposerDraft).toHaveBeenCalledTimes(1);
    expect(runtime.handleContinueEditingDraft).toHaveBeenCalledTimes(1);
    expect(runtime.handleDiscardComposerDraft).toHaveBeenCalledTimes(1);
  });
});
