'use client';

import { useEffect, useRef } from 'react';
import { getMoreCommentsPage } from '@/runtime/client/use-cases/post-use-cases';

const INFINITE_SCROLL_MARGIN = '300px 0px';

/**
 * 掛載文章留言的無限捲動 effect。
 * @param {object} params - effect 依賴。
 * @param {import('react').RefObject<HTMLDivElement | null>} params.bottomRef - 無限捲動哨兵元素。
 * @param {object | null} params.nextCursor - 下一頁 cursor。
 * @param {boolean} params.hasMore - 是否仍有下一頁。
 * @param {boolean} params.isLoadingNext - 是否正在載入下一頁。
 * @param {string} params.postId - 文章 ID。
 * @param {string | null | undefined} params.userUid - 目前使用者 UID。
 * @param {number} params.commentsLength - 目前留言數量。
 * @param {import('react').MutableRefObject<boolean>} params.isMountedRef - mounted ref。
 * @param {(value: boolean) => void} params.setIsLoadingNext - loading setter。
 * @param {(value: object | null) => void} params.setNextCursor - cursor setter。
 * @param {(value: boolean) => void} params.setHasMore - hasMore setter。
 * @param {(updater: (prev: object[]) => object[]) => void} params.setComments - comments setter。
 * @param {(comments: object[], userUid: string | null | undefined) => object[]} params.hydrateComments
 *   hydrate helper。
 */
export function usePostCommentsInfiniteScroll({
  bottomRef,
  nextCursor,
  hasMore,
  isLoadingNext,
  postId,
  userUid,
  commentsLength,
  isMountedRef,
  setIsLoadingNext,
  setNextCursor,
  setHasMore,
  setComments,
  hydrateComments,
}) {
  const isLoadingNextRef = useRef(isLoadingNext);
  const requestInFlightRef = useRef(false);
  const requestGenerationRef = useRef(0);
  const requestIdRef = useRef(0);
  const loadingRequestIdRef = useRef(null);

  useEffect(() => {
    isLoadingNextRef.current = isLoadingNext;
  }, [isLoadingNext]);

  useEffect(() => {
    if (
      !bottomRef.current ||
      !nextCursor ||
      !hasMore ||
      !postId ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return undefined;
    }

    const effectGeneration = requestGenerationRef.current + 1;
    requestGenerationRef.current = effectGeneration;
    let cancelled = false;
    const isCurrentEffect = () => !cancelled && requestGenerationRef.current === effectGeneration;

    const observer = new IntersectionObserver(
      async (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting || isLoadingNextRef.current || requestInFlightRef.current) {
          return;
        }

        observer.unobserve(entry.target);
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        loadingRequestIdRef.current = requestId;
        requestInFlightRef.current = true;
        isLoadingNextRef.current = true;
        if (isMountedRef.current) {
          setIsLoadingNext(true);
        }

        try {
          const nextPage = await getMoreCommentsPage(postId, nextCursor, 10);
          if (!isCurrentEffect() || !isMountedRef.current) return;

          if (nextPage.comments.length === 0) {
            setNextCursor(null);
            setHasMore(false);
            return;
          }

          const hydratedComments = hydrateComments(nextPage.comments, userUid);

          setNextCursor(nextPage.nextCursor);
          setHasMore(nextPage.hasMore);
          setComments((prev) => {
            const seen = new Set(prev.map((item) => item.id));
            const fresh = hydratedComments.filter((item) => !seen.has(item.id));
            return [...prev, ...fresh];
          });
        } catch (loadMoreError) {
          if (!isCurrentEffect()) return;

          console.error(loadMoreError);
          if (isMountedRef.current) {
            setNextCursor(null);
            setHasMore(false);
          }
        } finally {
          const ownsLoading = loadingRequestIdRef.current === requestId;
          if (ownsLoading) {
            requestInFlightRef.current = false;
            isLoadingNextRef.current = false;
            loadingRequestIdRef.current = null;
            if (isMountedRef.current) {
              setIsLoadingNext(false);
            }
          }
          if (isCurrentEffect() || ownsLoading) {
            observer.disconnect();
          }
        }
      },
      { root: null, threshold: 0, rootMargin: INFINITE_SCROLL_MARGIN },
    );

    const sentinel = bottomRef.current;
    observer.observe(sentinel);

    return () => {
      cancelled = true;
      if (requestGenerationRef.current === effectGeneration) {
        requestGenerationRef.current += 1;
        requestInFlightRef.current = false;
        isLoadingNextRef.current = false;
      }
      observer.disconnect();
    };
  }, [
    bottomRef,
    commentsLength,
    hasMore,
    hydrateComments,
    isMountedRef,
    nextCursor,
    postId,
    setComments,
    setHasMore,
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
