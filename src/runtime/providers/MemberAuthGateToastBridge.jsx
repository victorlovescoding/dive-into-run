'use client';

import { useCallback, useContext, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signInWithGoogleUseCase } from '@/runtime/client/use-cases/auth-use-cases';
import {
  MEMBER_AUTH_GATE_TOAST_MESSAGE,
  consumeMemberAuthGateReturnTo,
  consumeMemberAuthGateToastPending,
} from '@/runtime/member-auth-gate-toast';
import { AuthContext } from './AuthProvider';
import { useToast } from './ToastProvider';

const SIGN_IN_ERROR_MESSAGE = '登入失敗，請稍後再試';
const SIGN_IN_CANCEL_ERROR_CODES = new Set([
  'auth/cancelled-popup-request',
  'auth/popup-closed-by-user',
]);

/**
 * Checks whether a Google sign-in failure came from an intentional user cancel.
 * @param {unknown} error - Sign-in failure value.
 * @returns {boolean} True when the user cancelled the popup flow.
 */
function isSignInCancelError(error) {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String(error.code) : '';
  return SIGN_IN_CANCEL_ERROR_CODES.has(code);
}

/**
 * Shows the member auth gate toast after the redirect has landed on home.
 * @returns {null} This component renders no UI.
 */
export default function MemberAuthGateToastBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useContext(AuthContext);
  const { showToast } = useToast();
  const handleSignInAction = useCallback(() => {
    signInWithGoogleUseCase().catch((error) => {
      if (isSignInCancelError(error)) return;

      console.error(error);
      showToast(SIGN_IN_ERROR_MESSAGE, 'error');
    });
  }, [showToast]);

  useEffect(() => {
    if (pathname !== '/' || loading || !user?.uid) return;

    const returnTo = consumeMemberAuthGateReturnTo();
    if (!returnTo) return;

    router.replace(returnTo);
  }, [loading, pathname, router, user?.uid]);

  useEffect(() => {
    if (pathname !== '/') return;
    if (!consumeMemberAuthGateToastPending()) return;

    window.setTimeout(() => {
      showToast(MEMBER_AUTH_GATE_TOAST_MESSAGE, 'info', {
        label: '登入',
        callback: handleSignInAction,
      });
    }, 0);
  }, [handleSignInAction, pathname, showToast]);

  return null;
}
