// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CommentInput from '@/components/CommentInput';

vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, ...props }) => (
    <img src={src} alt={alt} width={width} height={height} {...props} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const currentUser = {
  uid: 'user-1',
  name: '測試跑者',
  photoURL: 'https://example.com/current-user.png',
};

/**
 * Renders the comment composer with defaults used across behavior tests.
 * @param {Record<string, unknown>} props - Optional prop overrides.
 * @returns {{ onSubmit: import('vitest').Mock, textbox: HTMLElement, submitButton: HTMLElement }} Rendered controls.
 */
function renderCommentInput(props = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(true);
  const user = Object.hasOwn(props, 'user') ? props.user : currentUser;
  const isEditing = props.isEditing ?? false;
  render(
    <CommentInput
      user={user}
      onSubmit={onSubmit}
      isSubmitting={props.isSubmitting ?? false}
      className={props.className}
      isEditing={isEditing}
      initialContent={props.initialContent}
      draftKey={props.draftKey}
      onCancel={props.onCancel}
    />,
  );

  return {
    onSubmit,
    textbox: screen.getByRole('textbox', { name: isEditing ? '編輯留言' : '留言' }),
    submitButton: screen.getByRole('button', { name: isEditing ? '儲存留言' : '送出留言' }),
  };
}

/**
 * Finds the composer avatar by its accessible name.
 * @param {string} name - Display name rendered in the avatar alt text.
 * @returns {HTMLElement} The avatar image.
 */
function getComposerAvatar(name = currentUser.name) {
  return screen.getByRole('img', { name: `${name}的大頭貼` });
}

describe('CommentInput', () => {
  it('預設新增留言模式維持新增語意', () => {
    const { textbox, submitButton } = renderCommentInput();

    expect(screen.getByRole('group', { name: '留言輸入區' })).toBeInTheDocument();
    expect(textbox).toHaveAttribute('placeholder', '留言');
    expect(submitButton).toHaveTextContent('送出');
    expect(screen.queryByText('正在編輯')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消編輯' })).not.toBeInTheDocument();
  });

  it('applies custom layout className to the fixed wrapper', () => {
    const { submitButton } = renderCommentInput({ className: 'unit-composer-layout' });

    const wrapper = screen.getByRole('group', { name: '留言輸入區' });
    expect(wrapper).toHaveClass('unit-composer-layout');
    expect(wrapper).toContainElement(submitButton);
  });

  it('顯示目前登入使用者大頭貼，且 avatar 只作為顯示用途', () => {
    renderCommentInput();

    const avatar = getComposerAvatar();
    expect(avatar).toHaveAttribute('src', currentUser.photoURL);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(avatar).not.toHaveAttribute('tabindex');
    expect(avatar).not.toHaveAttribute('role', 'button');
  });

  it('缺少 photoURL 時顯示預設大頭貼', () => {
    renderCommentInput({
      user: {
        uid: 'user-no-photo',
        name: '無圖跑者',
      },
    });

    expect(getComposerAvatar('無圖跑者')).toHaveAttribute('src', '/default-avatar.png');
  });

  it('photoURL 是空字串或空白字串時顯示預設大頭貼', () => {
    const { unmount } = render(
      <CommentInput
        user={{ uid: 'user-empty-photo', name: '空字串跑者', photoURL: '' }}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );

    expect(getComposerAvatar('空字串跑者')).toHaveAttribute('src', '/default-avatar.png');

    unmount();

    render(
      <CommentInput
        user={{ uid: 'user-blank-photo', name: '空白跑者', photoURL: '   ' }}
        onSubmit={vi.fn()}
        isSubmitting={false}
      />,
    );

    expect(getComposerAvatar('空白跑者')).toHaveAttribute('src', '/default-avatar.png');
  });

  it('阻止空白、只有空白字元、超過 500 字的草稿送出', async () => {
    const user = userEvent.setup();
    const { onSubmit, textbox, submitButton } = renderCommentInput();

    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(textbox, '   ');
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(textbox);
    await user.type(textbox, 'a'.repeat(501));
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('送出有效草稿，成功後清空輸入欄', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(true);
    const { textbox, submitButton } = renderCommentInput({ onSubmit });

    await user.type(textbox, '今天跑 10K');
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('今天跑 10K');
    });
    await waitFor(() => {
      expect(textbox).toHaveValue('');
    });
  });

  it('送出失敗時保留草稿', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(false);
    const { textbox, submitButton } = renderCommentInput({ onSubmit });

    await user.type(textbox, '不要吃掉這則留言');
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('不要吃掉這則留言');
    });
    expect(textbox).toHaveValue('不要吃掉這則留言');
  });

  it('送出 pending 時阻止重複 submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => new Promise(() => {}));
    const { textbox, submitButton } = renderCommentInput({ onSubmit });

    await user.type(textbox, '只送一次');
    expect(submitButton).toBeEnabled();

    await user.click(submitButton);
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit.mock.calls).toEqual([['只送一次']]);
    });
  });

  it('外部 isSubmitting 時 disable 輸入與送出', async () => {
    const user = userEvent.setup();
    const { onSubmit, textbox, submitButton } = renderCommentInput({ isSubmitting: true });

    expect(textbox).toBeDisabled();
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('編輯模式顯示編輯語意、帶入原內容、儲存並可取消', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();
    const { textbox, submitButton } = renderCommentInput({
      isEditing: true,
      initialContent: '原本的留言',
      draftKey: 'comment-1',
      onSubmit,
      onCancel,
    });

    expect(screen.getByRole('group', { name: '留言編輯區' })).toBeInTheDocument();
    expect(screen.getByText('正在編輯')).toBeInTheDocument();
    expect(textbox).toHaveAttribute('placeholder', '編輯留言');
    expect(textbox).toHaveValue('原本的留言');
    expect(submitButton).toHaveTextContent('儲存');
    expect(screen.queryByRole('button', { name: '送出留言' })).not.toBeInTheDocument();

    await user.clear(textbox);
    await user.type(textbox, '更新後留言');
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('更新後留言');
    });

    await user.click(screen.getByRole('button', { name: '取消編輯' }));
    expect(onCancel).toHaveBeenCalledWith();
  });
});
