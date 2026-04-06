'use client';

import { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '@/lib/firebase-client';
import styles from './RunsLoginGuide.module.css';

/**
 * 引導未登入使用者登入的元件。
 * 顯示提示標題與登入按鈕，點擊後彈出 Google Auth 視窗。
 * @returns {import('react').JSX.Element} 登入引導畫面。
 */
export default function RunsLoginGuide() {
  const [busy, setBusy] = useState(false);

  /** 觸發 Google 登入彈窗流程。 */
  function handleLogin() {
    setBusy(true);
    signInWithPopup(auth, provider)
      .then(() => {
        setBusy(false);
      })
      .catch((error) => {
        console.error(error);
        setBusy(false);
      });
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>請先登入以查看跑步紀錄</h2>
      <button type="button" className={styles.loginLink} onClick={handleLogin} disabled={busy}>
        {busy ? '處理中…' : '登入'}
      </button>
    </div>
  );
}
