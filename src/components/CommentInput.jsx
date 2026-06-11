'use client';

import Image from 'next/image';
import styles from './CommentInput.module.css';
import useCommentComposerInput from './useCommentComposerInput';

const DEFAULT_AVATAR = '/default-avatar.png';
const AVATAR_SIZE = 36;

/**
 * 解析可顯示的大頭貼來源。
 * @param {string | null | undefined} photoURL - 使用者大頭貼 URL。
 * @returns {string} 大頭貼來源。
 */
function resolveAvatarSrc(photoURL) {
  if (typeof photoURL !== 'string') {
    return DEFAULT_AVATAR;
  }

  const trimmedPhotoURL = photoURL.trim();
  return trimmedPhotoURL === '' ? DEFAULT_AVATAR : trimmedPhotoURL;
}

/**
 * 解析大頭貼替代文字使用的名稱。
 * @param {{ name?: string | null, displayName?: string | null, email?: string | null } | null | undefined} user - 目前使用者。
 * @returns {string} 顯示名稱。
 */
function resolveAvatarName(user) {
  const candidates = [user?.name, user?.displayName, user?.email];
  const name = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim() !== '');
  return typeof name === 'string' ? name.trim() : '目前使用者';
}

/**
 * 浮動留言輸入框。
 * @param {object} props - 元件 props。
 * @param {{ name?: string | null, displayName?: string | null, email?: string | null, photoURL?: string | null } | null} props.user - 目前登入使用者。
 * @param {(content: string) => boolean | Promise<boolean>} props.onSubmit - 送出留言回呼，成功回傳 true。
 * @param {boolean} props.isSubmitting - 是否送出中。
 * @returns {import('react').ReactElement} 留言輸入框元件。
 */
export default function CommentInput({ user, onSubmit, isSubmitting }) {
  const {
    content,
    setContent,
    isOverLimit,
    isSubmitting: isComposerSubmitting,
    isDisabled,
    textboxRef,
    handleSubmit,
    handleKeyDown,
  } = useCommentComposerInput({ onSubmit, isSubmitting });
  const avatarSrc = resolveAvatarSrc(user?.photoURL);
  const avatarName = resolveAvatarName(user);
  const showCharCount = content.length > 450;
  const charCountClassName = isOverLimit
    ? `${styles.charCount} ${styles.charCountOver}`
    : styles.charCount;

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputRow}>
        <Image
          src={avatarSrc}
          alt={`${avatarName}的大頭貼`}
          width={AVATAR_SIZE}
          height={AVATAR_SIZE}
          className={styles.avatar}
          priority={false}
        />
        <input
          ref={textboxRef}
          type="text"
          aria-label="留言"
          aria-invalid={isOverLimit}
          aria-describedby={showCharCount ? 'comment-input-count' : undefined}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="留言"
          className={styles.textbox}
          disabled={isComposerSubmitting}
        />
        <button
          type="button"
          onClick={() => {
            handleSubmit();
          }}
          disabled={isDisabled}
          className={styles.submitButton}
          aria-label="送出留言"
        >
          {isComposerSubmitting ? '送出中' : '送出'}
        </button>
      </div>
      {showCharCount && (
        <span id="comment-input-count" className={charCountClassName}>
          {content.length}/500
        </span>
      )}
    </div>
  );
}
