import '@testing-library/jest-dom/vitest';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import useCommentScrollTarget from '../../../src/runtime/hooks/useCommentScrollTarget';

const RETRY_INTERVAL_MS = 200;
const MAX_ATTEMPTS = 20;

/**
 * Creates a comment target element with a scroll spy.
 * @param {string} id - Element id.
 * @returns {HTMLElement & { scrollIntoView: ReturnType<typeof vi.fn> }} Target element.
 */
function createCommentElement(id) {
  const element = document.createElement('article');
  element.id = id;
  element.scrollIntoView = vi.fn();
  document.body.appendChild(element);
  return /** @type {HTMLElement & { scrollIntoView: ReturnType<typeof vi.fn> }} */ (element);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useCommentScrollTarget', () => {
  test('does not scroll when no comment id is provided', () => {
    const getElementById = vi.spyOn(document, 'getElementById');

    renderHook(() => useCommentScrollTarget(null));
    act(() => {
      vi.advanceTimersByTime(RETRY_INTERVAL_MS * 2);
    });

    expect(getElementById).not.toHaveBeenCalled();
  });

  test('scrolls the matched comment into view and removes highlight after animation ends', () => {
    const element = createCommentElement('comment-1');

    renderHook(() => useCommentScrollTarget('comment-1'));

    expect(element.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
    expect(element).toHaveClass('commentHighlight');

    act(() => {
      element.dispatchEvent(new Event('animationend'));
    });

    expect(element).not.toHaveClass('commentHighlight');
  });

  test('retries briefly when the comment is not in the DOM yet', () => {
    renderHook(() => useCommentScrollTarget('comment-late'));

    act(() => {
      vi.advanceTimersByTime(RETRY_INTERVAL_MS);
    });
    const element = createCommentElement('comment-late');
    act(() => {
      vi.advanceTimersByTime(RETRY_INTERVAL_MS);
    });

    expect(element.scrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  test('stops retrying after the maximum attempt count', () => {
    const getElementById = vi.spyOn(document, 'getElementById');

    renderHook(() => useCommentScrollTarget('missing-comment'));
    act(() => {
      vi.advanceTimersByTime(RETRY_INTERVAL_MS * (MAX_ATTEMPTS + 2));
    });
    const callCountAfterStop = getElementById.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(RETRY_INTERVAL_MS * 5);
    });

    expect(callCountAfterStop).toBe(MAX_ATTEMPTS);
    expect(getElementById.mock.calls.length).toBe(callCountAfterStop);
  });

  test('cleans up retry timer and animation listener on unmount', () => {
    const getElementById = vi.spyOn(document, 'getElementById');
    const view = renderHook(() => useCommentScrollTarget('missing-comment'));

    act(() => {
      vi.advanceTimersByTime(RETRY_INTERVAL_MS);
    });
    const callsBeforeUnmount = getElementById.mock.calls.length;
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(RETRY_INTERVAL_MS * 3);
    });

    expect(getElementById.mock.calls.length).toBe(callsBeforeUnmount);

    getElementById.mockRestore();
    const element = createCommentElement('comment-with-listener');
    const removeEventListener = vi.spyOn(element, 'removeEventListener');
    const utils = renderHook(() => useCommentScrollTarget('comment-with-listener'));

    utils.unmount();

    expect(removeEventListener).toHaveBeenCalledWith('animationend', expect.any(Function));
  });

  test('does not scroll the same comment id more than once', () => {
    const first = createCommentElement('comment-1');
    const second = createCommentElement('comment-2');
    const { rerender } = renderHook(({ commentId }) => useCommentScrollTarget(commentId), {
      initialProps: { commentId: 'comment-1' },
    });

    rerender({ commentId: 'comment-1' });
    rerender({ commentId: 'comment-2' });

    expect(first.scrollIntoView.mock.calls).toHaveLength(1);
    expect(second.scrollIntoView.mock.calls).toHaveLength(1);
  });

  test('removes stale highlight when the scroll target changes before animation ends', () => {
    const first = createCommentElement('comment-1');
    const second = createCommentElement('comment-2');
    const { rerender } = renderHook(({ commentId }) => useCommentScrollTarget(commentId), {
      initialProps: { commentId: 'comment-1' },
    });

    expect(first).toHaveClass('commentHighlight');

    rerender({ commentId: 'comment-2' });

    expect(first).not.toHaveClass('commentHighlight');
    expect(second).toHaveClass('commentHighlight');
  });
});
