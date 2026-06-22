import { useCallback, useEffect, useRef, useState } from 'react';

const COMMENT_MAX_LENGTH = 500;

/**
 * 管理留言輸入框的草稿、送出快捷鍵與送出後焦點。
 * @param {object} options - Hook options.
 * @param {(content: string) => boolean | Promise<boolean>} options.onSubmit - 送出草稿，成功回傳 true。
 * @param {boolean} options.isSubmitting - 外部送出中狀態。
 * @param {string} [options.initialContent] - 草稿初始化內容，供編輯模式帶入原留言。
 * @param {string | number | null} [options.draftKey] - 需要重設草稿的留言識別。
 * @returns {{
 *   content: string,
 *   setContent: import('react').Dispatch<import('react').SetStateAction<string>>,
 *   isEmpty: boolean,
 *   isOverLimit: boolean,
 *   isSubmitting: boolean,
 *   canSubmit: boolean,
 *   isDisabled: boolean,
 *   textboxRef: import('react').RefObject<HTMLInputElement | null>,
 *   handleSubmit: () => Promise<boolean>,
 *   handleKeyDown: (event: import('react').KeyboardEvent<HTMLInputElement>) => void,
 * }} 留言輸入框狀態與事件處理器。
 */
export default function useCommentComposerInput({
  onSubmit,
  isSubmitting,
  initialContent,
  draftKey,
}) {
  const initialDraft = typeof initialContent === 'string' ? initialContent : '';
  const [content, setContent] = useState(initialDraft);
  const [isSubmitPending, setIsSubmitPending] = useState(false);
  const [refocusToken, setRefocusToken] = useState(0);
  const textboxRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const pendingRefocusRef = useRef(false);
  const pendingSubmitRef = useRef(false);

  const trimmed = content.trim();
  const isEmpty = trimmed === '';
  const isOverLimit = content.length > COMMENT_MAX_LENGTH;
  const isSubmittingDraft = isSubmitting || isSubmitPending;
  const canSubmit = !isEmpty && !isOverLimit && !isSubmittingDraft;
  const isDisabled = !canSubmit;

  useEffect(() => {
    setContent(initialDraft);
  }, [draftKey, initialDraft]);

  const requestRefocus = useCallback(() => {
    pendingRefocusRef.current = true;
    setRefocusToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const input = textboxRef.current;
    if (!pendingRefocusRef.current || isSubmitting || !input || input.disabled) {
      return;
    }

    pendingRefocusRef.current = false;
    input.focus();
  }, [isSubmitting, refocusToken]);

  const handleSubmit = useCallback(async () => {
    if (isEmpty || isOverLimit || isSubmitting || pendingSubmitRef.current) {
      requestRefocus();
      return false;
    }

    pendingSubmitRef.current = true;
    setIsSubmitPending(true);

    let didSubmit = false;
    try {
      didSubmit = await onSubmit(content);
    } catch {
      didSubmit = false;
    } finally {
      pendingSubmitRef.current = false;
      setIsSubmitPending(false);
    }

    if (didSubmit) {
      setContent('');
    }
    requestRefocus();
    return didSubmit;
  }, [content, isEmpty, isOverLimit, isSubmitting, onSubmit, requestRefocus]);

  const handleKeyDown = useCallback(
    (event) => {
      const isComposing = event.nativeEvent.isComposing || event.isComposing;
      if (event.key !== 'Enter' || event.shiftKey || isComposing) {
        return;
      }

      event.preventDefault();
      handleSubmit();
    },
    [handleSubmit],
  );

  return {
    content,
    setContent,
    isEmpty,
    isOverLimit,
    isSubmitting: isSubmittingDraft,
    canSubmit,
    isDisabled,
    textboxRef,
    handleSubmit,
    handleKeyDown,
  };
}
