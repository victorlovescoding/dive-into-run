'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  MEMBER_AUTH_GATE_TOAST_MESSAGE,
  consumeMemberAuthGateToastPending,
} from '@/runtime/member-auth-gate-toast';
import { useToast } from './ToastProvider';

/**
 * Shows the member auth gate toast after the redirect has landed on home.
 * @returns {null} This component renders no UI.
 */
export default function MemberAuthGateToastBridge() {
  const pathname = usePathname();
  const { showToast } = useToast();

  useEffect(() => {
    if (pathname !== '/') return;
    if (!consumeMemberAuthGateToastPending()) return;

    window.setTimeout(() => {
      showToast(MEMBER_AUTH_GATE_TOAST_MESSAGE, 'info');
    }, 0);
  }, [pathname, showToast]);

  return null;
}
