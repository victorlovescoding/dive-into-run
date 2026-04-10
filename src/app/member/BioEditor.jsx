'use client';

// 為何要 "use client": BioEditor 需要 useState 管理 textarea 受控值與非同步儲存狀態，
// 屬於互動性元件，必須在 Client 端執行。

import { useState } from 'react';
import { updateUserBio } from '@/lib/firebase-profile';
import styles from './BioEditor.module.css';

const BIO_MAX_LENGTH = 150;

/**
 * @typedef {'idle' | 'saving' | 'success' | 'error'} BioEditorStatus
 */

/**
 * 計算字串的 Unicode code point 長度。
 *
 * 為什麼不用 `String.prototype.length`：JS 的 `.length` 是 UTF-16 code units
 * 數量，emoji 之類的 surrogate pair 會被算成 2；但 Firestore rules 的
 * `String.size()` 回傳的是 code points 數，會算成 1。若 client 用 `.length`
 * 顯示字數，會跟後端驗證結果不一致（例如使用者看到 `2/150` for 1 emoji）。
 * 改用 `Array.from(value).length` 讓 iterator 逐個 code point 計算，與
 * Firestore 對齊。
 * @param {string} value - 要計算長度的字串。
 * @returns {number} Unicode code point 數量。
 */
function codePointLength(value) {
  return Array.from(value).length;
}

/**
 * 判斷目前的 bio 字串是否可以送出儲存。
 *
 * 規則：(1) code point 長度 ≤ 150 (2) 不在儲存中。空字串允許儲存（用於
 * 清除既有 bio）。
 * @param {string} value - 目前 textarea 內的字串。
 * @param {BioEditorStatus} status - 元件目前儲存狀態。
 * @returns {boolean} 是否可以儲存。
 */
function canSave(value, status) {
  if (status === 'saving') return false;
  return codePointLength(value) <= BIO_MAX_LENGTH;
}

/**
 * 會員頁 Bio 編輯區塊。
 *
 * 設計：刻意做成「受控 + 接收 uid / initialBio」的純元件，這樣 integration test
 * 不需要 mock AuthContext，只要 mock service layer 即可驗證所有行為。
 * @param {object} props - 元件 props。
 * @param {string} props.uid - 目前登入使用者的 UID，會傳給 `updateUserBio`。
 * @param {string} [props.initialBio] - 元件初始顯示的簡介，預設空字串。
 * @returns {import('react').JSX.Element} BioEditor 元件。
 */
export default function BioEditor({ uid, initialBio = '' }) {
  const [bio, setBio] = useState(initialBio);
  const [status, setStatus] = useState(/** @type {BioEditorStatus} */ ('idle'));
  const [errorMessage, setErrorMessage] = useState('');

  const charCount = codePointLength(bio);
  const isOverLimit = charCount > BIO_MAX_LENGTH;
  const saveDisabled = !canSave(bio, status);

  /**
   * 處理 textarea 變更，同步本地 state 並重置先前的成功/錯誤訊息。
   * @param {import('react').ChangeEvent<HTMLTextAreaElement>} e - textarea change 事件。
   */
  function onBioChange(e) {
    setBio(e.target.value);
    if (status === 'success' || status === 'error') {
      setStatus('idle');
      setErrorMessage('');
    }
  }

  /** 觸發儲存流程。超過 150 字直接擋下，不呼叫 service。 */
  async function onSave() {
    if (isOverLimit) {
      setStatus('error');
      setErrorMessage(`簡介不得超過 ${BIO_MAX_LENGTH} 字`);
      return;
    }
    setStatus('saving');
    setErrorMessage('');
    try {
      await updateUserBio(uid, bio);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage('儲存失敗，請稍後再試');
    }
  }

  return (
    <section className={styles.bioEditor} aria-labelledby="bio-editor-heading">
      <h3 id="bio-editor-heading" className={styles.heading}>
        個人簡介
      </h3>
      <label className={styles.label} htmlFor="bio-textarea">
        簡介
        <textarea
          id="bio-textarea"
          className={styles.textarea}
          value={bio}
          onChange={onBioChange}
          rows={4}
          placeholder="介紹一下自己吧（最多 150 字）"
        />
      </label>
      <div className={styles.footer}>
        <span
          className={`${styles.charCount} ${isOverLimit ? styles.charCountOver : ''}`}
          aria-live="polite"
        >
          {charCount}/{BIO_MAX_LENGTH}
        </span>
        <button
          type="button"
          className={styles.saveButton}
          onClick={onSave}
          disabled={saveDisabled}
        >
          {status === 'saving' ? '儲存中…' : '儲存簡介'}
        </button>
      </div>
      {status === 'success' && (
        <p className={styles.successMessage} role="status">
          已儲存
        </p>
      )}
      {status === 'error' && (
        <p className={styles.errorMessage} role="alert">
          {errorMessage || '儲存失敗'}
        </p>
      )}
    </section>
  );
}
