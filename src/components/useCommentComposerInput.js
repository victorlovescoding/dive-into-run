import { useCallback, useEffect, useRef, useState } from 'react';

const COMMENT_MAX_LENGTH = 500;

/**
 * 管理留言輸入框的草稿、送出快捷鍵與送出後焦點。
 * @param {object} options - Hook options.
 * @param {(content: string) => boolean | Promise<boolean>} options.onSubmit - 送出草稿，成功回傳 true。
 * @param {boolean} options.isSubmitting - 外部送出中狀態。
 * @returns {{
 *   content: string,
 *   setContent: import('react').Dispatch<import('react').SetStateAction<string>>,
 *   isDisabled: boolean,
 *   textboxRef: import('react').RefObject<HTMLTextAreaElement | null>,
 *   handleSubmit: () => Promise<boolean>,
 *   handleKeyDown: (event: import('react').KeyboardEvent<HTMLTextAreaElement>) => void,
 * }} 留言輸入框狀態與事件處理器。
 */
export default function useCommentComposerInput({ onSubmit, isSubmitting }) {
  const [content, setContent] = useState('');
  const [refocusToken, setRefocusToken] = useState(0);
  const textboxRef = useRef(/** @type {HTMLTextAreaElement | null} */ (null));
  const pendingRefocusRef = useRef(false);

  const trimmed = content.trim();
  const isDisabled = trimmed === '' || content.length > COMMENT_MAX_LENGTH || isSubmitting;

  const requestRefocus = useCallback(() => {
    pendingRefocusRef.current = true;
    setRefocusToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const textbox = textboxRef.current;
    if (!pendingRefocusRef.current || isSubmitting || !textbox || textbox.disabled) {
      return;
    }

    pendingRefocusRef.current = false;
    textbox.focus();
  }, [isSubmitting, refocusToken]);

  const handleSubmit = useCallback(async () => {
    if (isDisabled) {
      requestRefocus();
      return false;
    }

    let didSubmit = false;
    try {
      didSubmit = await onSubmit(content);
    } catch {
      didSubmit = false;
    }

    if (didSubmit) {
      setContent('');
    }
    requestRefocus();
    return didSubmit;
  }, [content, isDisabled, onSubmit, requestRefocus]);

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
    isDisabled,
    textboxRef,
    handleSubmit,
    handleKeyDown,
  };
}
