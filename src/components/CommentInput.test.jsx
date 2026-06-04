import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import CommentInput from './CommentInput';

/**
 * 建立可手動 resolve 的 promise。
 * @returns {{ promise: Promise<boolean>, resolve: (value: boolean) => void }} Deferred promise.
 */
function createDeferredSubmit() {
  /** @type {(value: boolean) => void} */
  let resolve = () => {};
  const promise = new Promise((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

/**
 * Render CommentInput with a parent that toggles isSubmitting around async submit.
 * @param {object} options - Test options.
 * @param {Promise<boolean>} options.promise - Submit result promise.
 * @returns {{ onSubmit: import('vitest').Mock }} Submit spy.
 */
function renderWithSubmittingParent({ promise }) {
  const onSubmit = vi.fn();

  /**
   * 測試用父層，模擬實際 submit 期間切換 isSubmitting。
   * @returns {import('react').ReactElement} Comment input with parent submitting state.
   */
  function ParentSubmittingCommentInput() {
    const [isSubmitting, setIsSubmitting] = useState(false);

    /**
     * Simulate async parent submit state toggling.
     * @param {string} content - Submitted content.
     * @returns {Promise<boolean>} Submit result.
     */
    async function handleSubmit(content) {
      onSubmit(content);
      setIsSubmitting(true);
      const result = await promise;
      setIsSubmitting(false);
      return result;
    }

    return <CommentInput onSubmit={handleSubmit} isSubmitting={isSubmitting} />;
  }

  render(<ParentSubmittingCommentInput />);
  return { onSubmit };
}

describe('CommentInput composer behavior', () => {
  it('submits non-empty content with Enter, clears after success, and keeps focus', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<CommentInput onSubmit={onSubmit} isSubmitting={false} />);

    const textbox = screen.getByRole('textbox');
    await user.type(textbox, '活動留言');
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('活動留言');
    await waitFor(() => expect(textbox).toHaveValue(''));
    expect(textbox).toHaveFocus();
  });

  it('keeps newline entry for Shift+Enter and skips submission during IME composition', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<CommentInput onSubmit={onSubmit} isSubmitting={false} />);

    const textbox = screen.getByRole('textbox');
    await user.type(textbox, '第一行{Shift>}{Enter}{/Shift}第二行');
    expect(textbox).toHaveValue('第一行\n第二行');

    // eslint-disable-next-line testing-library/prefer-user-event -- fireEvent can set the IME isComposing flag.
    fireEvent.keyDown(textbox, { key: 'Enter', isComposing: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(textbox).toHaveValue('第一行\n第二行');
    expect(textbox).toHaveFocus();
  });

  it('preserves draft and focus when submission reports failure', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(false);
    render(<CommentInput onSubmit={onSubmit} isSubmitting={false} />);

    const textbox = screen.getByRole('textbox');
    await user.type(textbox, '失敗後保留');
    await user.click(screen.getByRole('button', { name: '送出留言' }));

    expect(onSubmit).toHaveBeenCalledWith('失敗後保留');
    await waitFor(() => expect(textbox).toHaveValue('失敗後保留'));
    expect(textbox).toHaveFocus();
  });

  it('clears and refocuses after successful button submission', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(<CommentInput onSubmit={onSubmit} isSubmitting={false} />);

    const textbox = screen.getByRole('textbox');
    await user.type(textbox, '按鈕送出');
    await user.click(screen.getByRole('button', { name: '送出留言' }));

    expect(onSubmit).toHaveBeenCalledWith('按鈕送出');
    await waitFor(() => expect(textbox).toHaveValue(''));
    expect(textbox).toHaveFocus();
  });

  it('clears and refocuses after parent toggles submitting around a successful submit', async () => {
    const user = userEvent.setup();
    const submit = createDeferredSubmit();
    const { onSubmit } = renderWithSubmittingParent({ promise: submit.promise });

    const textbox = screen.getByRole('textbox');
    await user.type(textbox, '父層送出成功');
    await user.click(screen.getByRole('button', { name: '送出留言' }));
    await waitFor(() => expect(textbox).toBeDisabled());

    await act(async () => {
      submit.resolve(true);
      await submit.promise;
    });

    expect(onSubmit).toHaveBeenCalledWith('父層送出成功');
    await waitFor(() => expect(textbox).not.toBeDisabled());
    expect(textbox).toHaveValue('');
    expect(textbox).toHaveFocus();
  });

  it('preserves draft and refocuses after parent toggles submitting around a failed submit', async () => {
    const user = userEvent.setup();
    const submit = createDeferredSubmit();
    const { onSubmit } = renderWithSubmittingParent({ promise: submit.promise });

    const textbox = screen.getByRole('textbox');
    await user.type(textbox, '父層送出失敗');
    await user.click(screen.getByRole('button', { name: '送出留言' }));
    await waitFor(() => expect(textbox).toBeDisabled());

    await act(async () => {
      submit.resolve(false);
      await submit.promise;
    });

    expect(onSubmit).toHaveBeenCalledWith('父層送出失敗');
    await waitFor(() => expect(textbox).not.toBeDisabled());
    expect(textbox).toHaveValue('父層送出失敗');
    expect(textbox).toHaveFocus();
  });

  it('does not submit empty, over-limit, or currently submitting content', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(true);
    const { rerender } = render(<CommentInput onSubmit={onSubmit} isSubmitting={false} />);

    const textbox = screen.getByRole('textbox');
    await user.click(textbox);
    await user.keyboard('{Enter}');

    await user.type(textbox, 'x'.repeat(501));
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: '送出留言' })).toBeDisabled();

    rerender(<CommentInput onSubmit={onSubmit} isSubmitting />);
    await user.keyboard('{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
