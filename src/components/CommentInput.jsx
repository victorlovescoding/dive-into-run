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
 * @param {string} [props.className] - 額外套用到 fixed wrapper 的 layout class。
 * @param {boolean} [props.isEditing] - 是否以編輯既有留言的模式顯示。
 * @param {string} [props.initialContent] - 編輯模式帶入的原留言內容。
 * @param {string | number | null} [props.draftKey] - 需要重新帶入草稿的留言識別。
 * @param {() => void} [props.onCancel] - 取消編輯回呼。
 * @returns {import('react').ReactElement} 留言輸入框元件。
 */
export default function CommentInput({
  user,
  onSubmit,
  isSubmitting,
  className,
  isEditing = false,
  initialContent,
  draftKey,
  onCancel,
}) {
  const {
    content,
    setContent,
    isOverLimit,
    isSubmitting: isComposerSubmitting,
    isDisabled,
    textboxRef,
    handleSubmit,
    handleKeyDown,
  } = useCommentComposerInput({
    onSubmit,
    isSubmitting,
    initialContent,
    draftKey,
  });
  const avatarSrc = resolveAvatarSrc(user?.photoURL);
  const avatarName = resolveAvatarName(user);
  const showCharCount = content.length > 450;
  const charCountClassName = isOverLimit
    ? `${styles.charCount} ${styles.charCountOver}`
    : styles.charCount;
  const wrapperClassName = className ? `${styles.wrapper} ${className}` : styles.wrapper;
  const groupLabel = isEditing ? '留言編輯區' : '留言輸入區';
  const inputLabel = isEditing ? '編輯留言' : '留言';
  const submitLabel = isEditing ? '儲存留言' : '送出留言';
  const pendingLabel = isEditing ? '儲存中' : '送出中';
  const submitText = isEditing ? '儲存' : '送出';

  return (
    <div className={wrapperClassName} role="group" aria-label={groupLabel}>
      {isEditing && (
        <div className={styles.editingHeader}>
          <span className={styles.editingLabel}>正在編輯</span>
          {onCancel && (
            <button
              type="button"
              className={styles.cancelEditButton}
              onClick={() => {
                onCancel();
              }}
              aria-label="取消編輯"
            >
              取消
            </button>
          )}
        </div>
      )}
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
          aria-label={inputLabel}
          aria-invalid={isOverLimit}
          aria-describedby={showCharCount ? 'comment-input-count' : undefined}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={inputLabel}
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
          aria-label={submitLabel}
        >
          {isComposerSubmitting ? pendingLabel : submitText}
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
