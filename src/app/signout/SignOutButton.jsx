'use client';

import { signOut } from 'firebase/auth';
import { useContext, useEffect, useState } from 'react';
import { auth } from '../../lib/firebase-client';
import { AuthContext } from '@/contexts/AuthContext';

/**
 *
 */
export default function SignOutButton() {
  const { user, loading } = useContext(AuthContext);
  /**
   *
   */
  function signOutHandler() {
    signOut(auth)
      .then(() => {})
      .catch((error) => {
        alert(error);
      });
  }

  return (
    <>
      {!loading && user && <button onClick={signOutHandler}>登出</button>}
      {/* <LoginButtonDisplay ... /> 這裡若要暫時註解，要用 JSX 註解格式 */}
    </>
  );
}
