import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { usePostCommentsInfiniteScroll } from './usePostCommentsEffects';

const postUseCasesMock = vi.hoisted(() => ({
  getMoreComments: vi.fn(),
  getMoreCommentsPage: vi.fn(),
}));

vi.mock('@/runtime/client/use-cases/post-use-cases', () => ({
  getMoreComments: postUseCasesMock.getMoreComments,
  getMoreCommentsPage: postUseCasesMock.getMoreCommentsPage,
}));

/** @typedef {(entries: Array<{ isIntersecting: boolean, target: Element }>) => void | Promise<void>} FakeIntersectionObserverCallback */
/** @typedef {Parameters<typeof usePostCommentsInfiniteScroll>[0]} InfiniteScrollParams */

/** @type {FakeIntersectionObserver[]} */
let observerInstances = [];

class FakeIntersectionObserver {
  /**
   * @param {FakeIntersectionObserverCallback} callback - Intersection callback under test.
   */
  constructor(callback) {
    this.callback = callback;
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
    observerInstances.push(this);
  }
}

/**
 * @template T
 * @returns {{ promise: Promise<T>, resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: unknown) => void }}
 *   Deferred promise controls.
 */
function deferred() {
  /** @type {(value: T | PromiseLike<T>) => void} */
  let resolve = () => {
    throw new Error('deferred resolve used before initialization');
  };
  /** @type {(reason?: unknown) => void} */
  let reject = () => {
    throw new Error('deferred reject used before initialization');
  };
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

/**
 * @param {Partial<InfiniteScrollParams>} [overrides] - Hook props to override.
 * @returns {ReturnType<typeof renderHook> & { props: InfiniteScrollParams, sentinel: HTMLDivElement }}
 *   Rendered hook view and default test fixtures.
 */
function renderInfiniteScrollEffect(overrides = {}) {
  const sentinel = document.createElement('div');
  const bottomRef = { current: sentinel };
  const setComments = vi.fn(
    /**
     * @param {(prev: object[]) => object[]} updater - React state updater.
     * @returns {object[]} Updated comments.
     */
    (updater) => updater([]),
  );
  /** @type {InfiniteScrollParams} */
  const props = {
    bottomRef,
    nextCursor: { id: 'cursor-1', createdAt: { seconds: 2 } },
    hasMore: true,
    isLoadingNext: false,
    postId: 'post-1',
    userUid: 'user-1',
    commentsLength: 10,
    isMountedRef: { current: true },
    setIsLoadingNext: vi.fn(),
    setNextCursor: vi.fn(),
    setHasMore: vi.fn(),
    setComments,
    hydrateComments: vi.fn(
      /**
       * @param {object[]} comments - Raw comments from the page result.
       * @returns {object[]} Hydrated comments.
       */
      (comments) => comments,
    ),
    ...overrides,
  };

  const view = renderHook((hookProps) => usePostCommentsInfiniteScroll(hookProps), {
    initialProps: props,
  });

  return { ...view, props, sentinel };
}

/**
 * @param {FakeIntersectionObserver} observer - Fake observer instance.
 * @param {Element} target - Intersecting target.
 */
async function intersect(observer, target) {
  await act(async () => {
    await observer.callback([{ isIntersecting: true, target }]);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  observerInstances = [];
  globalThis.IntersectionObserver = /** @type {typeof IntersectionObserver} */ (
    /** @type {unknown} */ (FakeIntersectionObserver)
  );
  postUseCasesMock.getMoreComments.mockResolvedValue([]);
  postUseCasesMock.getMoreCommentsPage.mockResolvedValue({
    comments: [],
    nextCursor: null,
    hasMore: false,
  });
});

afterEach(() => {
  delete globalThis.IntersectionObserver;
});

describe('usePostCommentsInfiniteScroll', () => {
  test('ignores repeated intersections while a next-page request is pending', async () => {
    const page = deferred();
    postUseCasesMock.getMoreCommentsPage.mockReturnValue(page.promise);
    const { props, sentinel } = renderInfiniteScrollEffect();
    const observer = observerInstances[0];

    act(() => {
      observer.callback([{ isIntersecting: true, target: sentinel }]);
      observer.callback([{ isIntersecting: true, target: sentinel }]);
    });

    expect(postUseCasesMock.getMoreCommentsPage).toHaveBeenCalledTimes(1);

    await act(async () => {
      page.resolve({ comments: [], nextCursor: null, hasMore: false });
      await page.promise;
    });
    await waitFor(() => expect(props.setIsLoadingNext).toHaveBeenLastCalledWith(false));
  });

  test('stops observing through hasMore state when a page is empty or short', async () => {
    const { props, sentinel } = renderInfiniteScrollEffect();
    const observer = observerInstances[0];

    await intersect(observer, sentinel);

    expect(postUseCasesMock.getMoreCommentsPage).toHaveBeenCalledWith(
      'post-1',
      { id: 'cursor-1', createdAt: { seconds: 2 } },
      10,
    );
    expect(props.setNextCursor).toHaveBeenCalledWith(null);
    expect(props.setHasMore).toHaveBeenCalledWith(false);
    expect(observer.observe).toHaveBeenCalledTimes(1);
  });

  test('stops further automatic observes after a load-more error', async () => {
    const error = new Error('load failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    postUseCasesMock.getMoreCommentsPage.mockRejectedValueOnce(error);
    const { props, sentinel } = renderInfiniteScrollEffect();
    const observer = observerInstances[0];

    await intersect(observer, sentinel);

    expect(consoleError).toHaveBeenCalledWith(error);
    expect(props.setHasMore).toHaveBeenCalledWith(false);
    expect(observer.observe).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  test('clears loading without writing stale data after the cursor changes', async () => {
    const stalePage = deferred();
    postUseCasesMock.getMoreCommentsPage.mockReturnValueOnce(stalePage.promise);
    const { props, rerender, sentinel } = renderInfiniteScrollEffect();
    const observer = observerInstances[0];

    act(() => {
      observer.callback([{ isIntersecting: true, target: sentinel }]);
    });

    rerender({
      ...props,
      nextCursor: { id: 'cursor-2', createdAt: { seconds: 3 } },
      commentsLength: 11,
    });

    await act(async () => {
      stalePage.resolve({
        comments: [{ id: 'stale-comment' }],
        nextCursor: { id: 'cursor-stale', createdAt: { seconds: 4 } },
        hasMore: true,
      });
      await stalePage.promise;
    });

    expect(props.setNextCursor).not.toHaveBeenCalledWith({
      id: 'cursor-stale',
      createdAt: { seconds: 4 },
    });
    expect(props.setComments).not.toHaveBeenCalled();
    expect(props.setIsLoadingNext).toHaveBeenLastCalledWith(false);
  });
});
