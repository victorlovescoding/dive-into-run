'use client';

import { useEffect } from 'react';
import { getMoreComments } from '@/runtime/client/use-cases/post-use-cases';

const INFINITE_SCROLL_MARGIN = '300px 0px';

/**
 * 掛載文章留言的無限捲動 effect。
 * @param {object} params - effect 依賴。
 * @param {import('react').RefObject<HTMLDivElement | null>} params.bottomRef - 無限捲動哨兵元素。
 * @param {object | null} params.nextCursor - 下一頁 cursor。
 * @param {boolean} params.isLoadingNext - 是否正在載入下一頁。
 * @param {string} params.postId - 文章 ID。
 * @param {string | null | undefined} params.userUid - 目前使用者 UID。
 * @param {number} params.commentsLength - 目前留言數量。
 * @param {import('react').MutableRefObject<boolean>} params.isMountedRef - mounted ref。
 * @param {(value: boolean) => void} params.setIsLoadingNext - loading setter。
 * @param {(value: object | null) => void} params.setNextCursor - cursor setter。
 * @param {(updater: (prev: object[]) => object[]) => void} params.setComments - comments setter。
 * @param {(comments: object[], userUid: string | null | undefined) => object[]} params.hydrateComments
 *   hydrate helper。
 */
export function usePostCommentsInfiniteScroll({
  bottomRef,
  nextCursor,
  isLoadingNext,
  postId,
  userUid,
  commentsLength,
  isMountedRef,
  setIsLoadingNext,
  setNextCursor,
  setComments,
  hydrateComments,
}) {
  useEffect(() => {
    if (
      !bottomRef.current ||
      !nextCursor ||
      isLoadingNext ||
      !postId ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting || isLoadingNext) return;

        observer.unobserve(entry.target);
        if (isMountedRef.current) {
          setIsLoadingNext(true);
        }

        let shouldReobserve = true;
        try {
          const moreComments = await getMoreComments(postId, nextCursor);
          if (!isMountedRef.current) return;

          if (moreComments.length === 0) {
            setNextCursor(null);
            shouldReobserve = false;
            return;
          }

          const last = moreComments[moreComments.length - 1] ?? null;
          const hydratedComments = hydrateComments(moreComments, userUid);

          setNextCursor(last);
          setComments((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            const fresh = hydratedComments.filter((item) => !seen.has(item.id));
            return [...prev, ...fresh];
          });

          if (moreComments.length < 10) {
            setNextCursor(null);
            shouldReobserve = false;
          }
        } catch (loadMoreError) {
          console.error(loadMoreError);
          shouldReobserve = false;
        } finally {
          if (!isMountedRef.current) {
            observer.disconnect();
          } else {
            setIsLoadingNext(false);
            if (shouldReobserve && bottomRef.current) {
              observer.observe(bottomRef.current);
            } else {
              observer.disconnect();
            }
          }
        }
      },
      { root: null, threshold: 0, rootMargin: INFINITE_SCROLL_MARGIN },
    );

    const sentinel = bottomRef.current;
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [
    bottomRef,
    commentsLength,
    hydrateComments,
    isLoadingNext,
    isMountedRef,
    nextCursor,
    postId,
    setComments,
    setIsLoadingNext,
    setNextCursor,
    userUid,
  ]);
}

/**
 * 掛載 scroll-to-comment highlight effect。
 * @param {{ get: (key: string) => string | null }} searchParams - 查詢參數物件。
 */
export function useScrollToHighlightedComment(searchParams) {
  useEffect(() => {
    const commentId = searchParams.get('commentId');
    if (!commentId) return undefined;

    let attempts = 0;
    const maxAttempts = 20;
    const timer = setInterval(() => {
      attempts += 1;
      const element = document.getElementById(commentId);
      if (element) {
        clearInterval(timer);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('commentHighlight');
        element.addEventListener(
          'animationend',
          () => {
            element.classList.remove('commentHighlight');
          },
          { once: true },
        );
      } else if (attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [searchParams]);
}
