'use client';

import { useCallback, useRef, useState } from 'react';
import { signInWithGoogle } from '@/lib/firebase-auth-helpers';
import { useToast } from '@/runtime/providers/ToastProvider';

const SIGN_IN_ERROR_MESSAGE = '登入失敗，請稍後再試';
const SIGN_IN_CANCEL_ERROR_CODES = new Set([
  'auth/cancelled-popup-request',
  'auth/popup-closed-by-user',
]);

/**
 * Checks whether a Google sign-in error should stay silent because the user cancelled it.
 * @param {unknown} error - Sign-in failure value.
 * @returns {boolean} True when the error represents a user-cancelled popup.
 */
function isSignInCancelError(error) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code) : '';
  return SIGN_IN_CANCEL_ERROR_CODES.has(code);
}

/**
 * Coordinates Navbar Google sign-in with pending state and error feedback.
 * @returns {{ loginPending: boolean, handleSignIn: () => Promise<void> }} Sign-in state and action.
 */
export default function useNavbarSignIn() {
  const { showToast } = useToast();
  const [loginPending, setLoginPending] = useState(false);
  const pendingRef = useRef(false);

  const handleSignIn = useCallback(async () => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setLoginPending(true);

    try {
      await signInWithGoogle();
    } catch (error) {
      if (!isSignInCancelError(error)) {
        console.error(error);
        showToast(SIGN_IN_ERROR_MESSAGE, 'error');
      }
    } finally {
      pendingRef.current = false;
      setLoginPending(false);
    }
  }, [showToast]);

  return { loginPending, handleSignIn };
}
