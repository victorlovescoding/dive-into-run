'use client';

import { useEffect, useRef } from 'react';

const COMMENT_HIGHLIGHT_CLASS = 'commentHighlight';
const RETRY_INTERVAL_MS = 200;
const MAX_ATTEMPTS = 20;

/**
 * Scrolls to a rendered comment element and applies the shared highlight class.
 * @param {string | null | undefined} commentId - Target comment DOM id.
 */
export default function useCommentScrollTarget(commentId) {
  const lastScrolledCommentIdRef = useRef(/** @type {string | null} */ (null));

  useEffect(() => {
    if (!commentId || lastScrolledCommentIdRef.current === commentId) return undefined;

    let attempts = 0;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let retryTimer = null;
    /** @type {HTMLElement | null} */
    let highlightedElement = null;
    /** @type {(() => void) | null} */
    let animationEndHandler = null;

    const removeAnimationListener = () => {
      if (highlightedElement) {
        highlightedElement.classList.remove(COMMENT_HIGHLIGHT_CLASS);
        if (animationEndHandler) {
          highlightedElement.removeEventListener('animationend', animationEndHandler);
        }
      }
      highlightedElement = null;
      animationEndHandler = null;
    };

    const tryScroll = () => {
      attempts += 1;
      const element = document.getElementById(commentId);

      if (element) {
        lastScrolledCommentIdRef.current = commentId;
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add(COMMENT_HIGHLIGHT_CLASS);
        highlightedElement = element;
        animationEndHandler = () => {
          element.classList.remove(COMMENT_HIGHLIGHT_CLASS);
          removeAnimationListener();
        };
        element.addEventListener('animationend', animationEndHandler, { once: true });
        return;
      }

      if (attempts < MAX_ATTEMPTS) {
        retryTimer = setTimeout(tryScroll, RETRY_INTERVAL_MS);
      }
    };

    tryScroll();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      removeAnimationListener();
    };
  }, [commentId]);
}
