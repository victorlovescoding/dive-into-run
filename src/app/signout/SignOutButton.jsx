'use client';

import { signOut } from 'firebase/auth';
import { useContext } from 'react';
import { auth } from '../../lib/firebase-client';
import { AuthContext } from '@/contexts/AuthContext';

/**
 * 登出按鈕，已登入時顯示。
 * @returns {import('react').JSX.Element} 登出按鈕元件。
 */
export default function SignOutButton() {
  const { user, loading } = useContext(AuthContext);
  /** 執行 Firebase 登出。 */
  function signOutHandler() {
    signOut(auth)
      .then(() => {})
      .catch((error) => {
        // eslint-disable-next-line no-alert -- 登出失敗使用原生對話框提示
        window.alert(error);
      });
  }

  return (
    <>
      {!loading && user && (
        <button type="button" onClick={signOutHandler}>
          登出
        </button>
      )}
      {/* <LoginButtonDisplay ... /> 這裡若要暫時註解，要用 JSX 註解格式 */}
    </>
  );
}
