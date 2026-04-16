import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import ComposeModal from '@/components/ComposeModal';

// ---------------------------------------------------------------------------
// jsdom 不支援 <dialog> 的 showModal / close，手動 patch
// ---------------------------------------------------------------------------
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
    this.setAttribute('open', '');
  });
  HTMLDialogElement.prototype.close = vi.fn(function close() {
    this.removeAttribute('open');
  });
});

// ---------------------------------------------------------------------------
// Test wrapper — 直接把 title/content/originalTitle/originalContent/isSubmitting
// 當受控 props 傳入，方便用 rerender 模擬 parent state 變化
// ---------------------------------------------------------------------------

/**
 * 測試用 wrapper，將所有關鍵 props 以受控形式傳給 ComposeModal，
 * 並於 mount 時自動開啟 dialog，讓 assertion 可直接查詢 UI。
 * @param {object} props - wrapper props。
 * @param {boolean} props.isEditing - 是否為編輯模式。
 * @param {string} [props.originalTitle] - 原始標題（dirty 比較基準）。
 * @param {string} [props.originalContent] - 原始內文（dirty 比較基準）。
 * @param {boolean} [props.isSubmitting] - 送出中狀態。
 * @param {string} props.title - 當前標題值。
 * @param {string} props.content - 當前內文值。
 * @returns {import('react').ReactElement} wrapper 元件。
 */
function ModalWrapper({
  isEditing,
  originalTitle,
  originalContent,
  isSubmitting = false,
  title,
  content,
}) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <ComposeModal
      dialogRef={dialogRef}
      title={title}
      content={content}
      onTitleChange={vi.fn()}
      onContentChange={vi.fn()}
      onSubmit={vi.fn((e) => e.preventDefault())}
      isEditing={isEditing}
      originalTitle={originalTitle}
      originalContent={originalContent}
      isSubmitting={isSubmitting}
    />
  );
}

// ===========================================================================
// ComposeModal dirty gate
// ===========================================================================
describe('ComposeModal dirty gate (isEditing=true)', () => {
  it('baseline matches original → submit button disabled', () => {
    // Arrange & Act
    render(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="orig title"
        content="orig content"
      />,
    );

    // Assert
    expect(screen.getByRole('button', { name: /更新/ })).toBeDisabled();
  });

  it('modify title → submit button NOT disabled', () => {
    // Arrange
    const { rerender } = render(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="orig title"
        content="orig content"
      />,
    );

    // Act — 模擬 parent state 把 title 改成不同值
    rerender(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="new title"
        content="orig content"
      />,
    );

    // Assert
    expect(screen.getByRole('button', { name: /更新/ })).not.toBeDisabled();
  });

  it('revert title back to original → submit button disabled again (FR-004)', () => {
    // Arrange
    const { rerender } = render(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="orig title"
        content="orig content"
      />,
    );

    // Act — 先改成 new title
    rerender(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="new title"
        content="orig content"
      />,
    );
    // 再改回來
    rerender(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="orig title"
        content="orig content"
      />,
    );

    // Assert
    expect(screen.getByRole('button', { name: /更新/ })).toBeDisabled();
  });

  it('title with only trailing whitespace → disabled (trim compare)', () => {
    // Arrange & Act
    render(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="orig title   "
        content="orig content"
      />,
    );

    // Assert
    expect(screen.getByRole('button', { name: /更新/ })).toBeDisabled();
  });

  it('content with only leading whitespace → disabled (trim compare)', () => {
    // Arrange & Act
    render(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="orig title"
        content="   orig content"
      />,
    );

    // Assert
    expect(screen.getByRole('button', { name: /更新/ })).toBeDisabled();
  });

  it('title changed to pure whitespace → NOT disabled (trimmed `` ≠ original)', () => {
    // Arrange & Act
    render(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="   "
        content="orig content"
      />,
    );

    // Assert
    expect(screen.getByRole('button', { name: /更新/ })).not.toBeDisabled();
  });

  it('isSubmitting=true + dirty → disabled and label is 「更新中…」', () => {
    // Arrange & Act
    render(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="new title"
        content="orig content"
        isSubmitting
      />,
    );

    // Assert
    const button = screen.getByRole('button', { name: /更新中…/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('更新中…');
  });

  it('isSubmitting=false + dirty → label is 「更新」', () => {
    // Arrange & Act
    render(
      <ModalWrapper
        isEditing
        originalTitle="orig title"
        originalContent="orig content"
        title="new title"
        content="orig content"
        isSubmitting={false}
      />,
    );

    // Assert
    const button = screen.getByRole('button', { name: /更新/ });
    expect(button).toHaveTextContent('更新');
    expect(button).not.toHaveTextContent('更新中…');
  });

  it('cross-lifecycle re-render (switch post A → post B without remount) → Invariant I1', () => {
    // Arrange — 開啟「編輯 post A」，title 與 original 一致 → disabled
    const { rerender } = render(
      <ModalWrapper
        isEditing
        originalTitle="postA title"
        originalContent="postA content"
        title="postA title"
        content="postA content"
      />,
    );
    expect(screen.getByRole('button', { name: /更新/ })).toBeDisabled();

    // Act — parent 把 editingPost 切到 post B，但 title/content 暫時還是 postA（
    //   例如 parent 還沒同步 reset input 時的瞬間）。ComposeModal 必須讀最新 prop，
    //   不得 cache 舊的 originalTitle。
    rerender(
      <ModalWrapper
        isEditing
        originalTitle="postB title"
        originalContent="postB content"
        title="postA title"
        content="postA content"
      />,
    );

    // Assert — dirty，因為 postA title !== postB title
    expect(screen.getByRole('button', { name: /更新/ })).not.toBeDisabled();
  });
});

// ===========================================================================
// ComposeModal new-post mode — 確認 dirty gate 不適用（US2 sanity check）
// ===========================================================================
describe('ComposeModal new-post mode (isEditing=false)', () => {
  it('empty title and content → submit button NOT disabled (dirty gate skipped)', () => {
    // Arrange & Act
    render(<ModalWrapper isEditing={false} title="" content="" />);

    // Assert — 新增模式下 baseline 不受 dirty gate 影響
    const button = screen.getByRole('button', { name: /發布/ });
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('發布');
  });

  it('isSubmitting=true → submit button disabled (防重複送出, research.md Decision 4)', () => {
    // Arrange & Act
    render(<ModalWrapper isEditing={false} title="" content="" isSubmitting />);

    // Assert
    expect(screen.getByRole('button', { name: /發布/ })).toBeDisabled();
  });

  it('button label stays 「發布」 regardless of isSubmitting (minimal-change, research.md Decision 4)', () => {
    // Arrange & Act — isSubmitting=false
    const { rerender } = render(
      <ModalWrapper isEditing={false} title="" content="" isSubmitting={false} />,
    );

    // Assert — 文字維持「發布」
    expect(screen.getByRole('button', { name: /發布/ })).toHaveTextContent('發布');

    // Act — 切成 isSubmitting=true
    rerender(<ModalWrapper isEditing={false} title="" content="" isSubmitting />);

    // Assert — 文字仍維持「發布」，不會切到「更新中…」
    const submittingButton = screen.getByRole('button', { name: /發布/ });
    expect(submittingButton).toHaveTextContent('發布');
    expect(submittingButton).not.toHaveTextContent('更新中…');
  });
});
