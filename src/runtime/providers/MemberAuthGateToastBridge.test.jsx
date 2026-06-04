import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MEMBER_AUTH_GATE_TOAST_MESSAGE,
  consumeMemberAuthGateToastPending,
  markMemberAuthGateToastPending,
} from '@/runtime/member-auth-gate-toast';
import MemberAuthGateToastBridge from './MemberAuthGateToastBridge';
import ToastProvider, { useToast } from './ToastProvider';

const pathnameState = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.current,
}));

/**
 * Renders the current toast queue as stable text records for assertions.
 * @returns {import('react').ReactElement} Toast record list.
 */
function ToastRecords() {
  const { toasts } = useToast();

  return (
    <ul aria-label="toast records">
      {toasts.map((toast) => (
        <li key={toast.id}>{`${toast.type}:${toast.message}`}</li>
      ))}
    </ul>
  );
}

/**
 * Renders the bridge under the real ToastProvider context.
 * @returns {void}
 */
function renderBridge() {
  render(
    <StrictMode>
      <ToastProvider>
        <MemberAuthGateToastBridge />
        <ToastRecords />
      </ToastProvider>
    </StrictMode>,
  );
}

/**
 * Reads visible toast records from the rendered observer list.
 * @returns {(string | null)[]} Current toast records.
 */
function getToastRecords() {
  return screen.queryAllByRole('listitem').map((item) => item.textContent);
}

/**
 * Lets delayed toast callbacks run inside React Testing Library act.
 * @returns {Promise<void>} Resolves after scheduled work has had a chance to run.
 */
async function flushScheduledWork() {
  await act(async () => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 20);
    });
  });
}

describe('MemberAuthGateToastBridge', () => {
  beforeEach(() => {
    pathnameState.current = '/';
    window.sessionStorage.clear();
  });

  it('shows exactly one info toast and consumes the marker after landing on home', async () => {
    markMemberAuthGateToastPending();

    renderBridge();

    await waitFor(() => {
      expect(getToastRecords()).toEqual([
        `info:${MEMBER_AUTH_GATE_TOAST_MESSAGE}`,
      ]);
    });
    expect(consumeMemberAuthGateToastPending()).toBe(false);
  });

  it('does not show a toast or consume the marker away from home', async () => {
    pathnameState.current = '/member';
    markMemberAuthGateToastPending();

    renderBridge();
    await flushScheduledWork();

    expect(getToastRecords()).toEqual([]);
    expect(consumeMemberAuthGateToastPending()).toBe(true);
  });
});
