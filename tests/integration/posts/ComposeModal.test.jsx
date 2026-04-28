import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import ComposePrompt from '@/components/ComposePrompt';
import ComposeModal from '@/components/ComposeModal';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('next/image', () => ({
  default: (props) => <img {...props} />,
}));

// ---------------------------------------------------------------------------
// jsdom 不支援 showModal / close，手動 mock
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
// ComposeModal wrapper — 控制 dialog 開關 + 管理 state
// ---------------------------------------------------------------------------

/**
 * 測試用 wrapper，管理 ComposeModal 的 state 與 dialog ref。
 * @param {object} props - wrapper props。
 * @param {boolean} [props.isEditing] - 是否為編輯模式。
 * @returns {import('react').ReactElement} 渲染結果。
 */
function ModalWrapper({ isEditing = false }) {
  const dialogRef = useRef(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const onSubmit = vi.fn((e) => e.preventDefault());

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()}>
        開啟 Modal
      </button>
      <ComposeModal
        dialogRef={dialogRef}
        title={title}
        content={content}
        onTitleChange={setTitle}
        onContentChange={setContent}
        onSubmit={onSubmit}
        isEditing={isEditing}
      />
    </>
  );
}

// ===========================================================================
// ComposePrompt
// ===========================================================================
describe('ComposePrompt', () => {
  it('顯示 placeholder 文字「分享你的跑步故事...」', () => {
    render(<ComposePrompt onClick={vi.fn()} />);
    expect(screen.getByText(/分享你的跑步故事/)).toBeInTheDocument();
  });

  it('點擊整塊觸發 onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<ComposePrompt onClick={onClick} />);
    await user.click(screen.getByText(/分享你的跑步故事/));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// ComposeModal
// ===========================================================================
describe('ComposeModal', () => {
  it('開啟後顯示「發表文章」標題和「發布」按鈕', async () => {
    const user = userEvent.setup();
    render(<ModalWrapper />);
    await user.click(screen.getByRole('button', { name: '開啟 Modal' }));
    expect(screen.getByText('發表文章')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /發布/ })).toBeInTheDocument();
  });

  it('isEditing=true 時顯示「編輯文章」標題和「更新」按鈕', async () => {
    const user = userEvent.setup();
    render(<ModalWrapper isEditing />);
    await user.click(screen.getByRole('button', { name: '開啟 Modal' }));
    expect(screen.getByText('編輯文章')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /更新/ })).toBeInTheDocument();
  });

  it('可輸入標題和內容', async () => {
    const user = userEvent.setup();
    render(<ModalWrapper />);
    await user.click(screen.getByRole('button', { name: '開啟 Modal' }));
    const titleInput = screen.getByPlaceholderText(/標題/);
    const contentInput = screen.getByPlaceholderText(/內容|想法/);
    await user.type(titleInput, '測試標題');
    await user.type(contentInput, '測試內容');
    expect(titleInput).toHaveValue('測試標題');
    expect(contentInput).toHaveValue('測試內容');
  });

  it('有 X 關閉按鈕', async () => {
    const user = userEvent.setup();
    render(<ModalWrapper />);
    await user.click(screen.getByRole('button', { name: '開啟 Modal' }));
    expect(screen.getByRole('button', { name: /關閉/ })).toBeInTheDocument();
  });

  it('表單空白時 Escape 不阻止關閉', async () => {
    const user = userEvent.setup();
    render(<ModalWrapper />);
    await user.click(screen.getByRole('button', { name: '開啟 Modal' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('open');
    // 觸發 cancel event 模擬 Escape（jsdom 不會自動呼叫 close）
    const cancelEvent = new Event('cancel', { cancelable: true });
    dialog.dispatchEvent(cancelEvent);
    expect(cancelEvent.defaultPrevented).toBe(false);
  });
});
