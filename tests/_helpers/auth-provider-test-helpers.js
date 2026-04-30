import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * @typedef {object} AuthCallbackHandle
 * @property {(user: object | null) => Promise<void>} emit - 觸發 onAuthStateChanged callback。
 * @property {import('vitest').Mock} unsubscribe - auth listener 退訂 mock。
 */

/**
 * @typedef {object} ProfileSnapshotHandle
 * @property {(data: object | null) => void} emit - 觸發 onSnapshot data callback。
 * @property {import('vitest').Mock} unsubscribe - profile listener 退訂 mock。
 */

/**
 * 攔截 onAuthStateChanged 並回傳可觸發的 handle。
 * @param {import('vitest').Mock} onAuthStateChangedMock - firebase/auth mock。
 * @returns {AuthCallbackHandle} 可模擬登入/登出的 handle。
 */
export function captureAuthCallback(onAuthStateChangedMock) {
  /** @type {((user: object | null) => void) | null} */
  let captured = null;
  const unsubscribe = vi.fn();

  onAuthStateChangedMock.mockImplementation((_auth, callback) => {
    captured = callback;
    return unsubscribe;
  });

  return {
    emit: async (user) => {
      if (!captured) throw new Error('auth callback not captured yet');
      await act(async () => {
        await captured?.(user);
      });
    },
    unsubscribe,
  };
}

/**
 * 攔截 onSnapshot 並回傳可觸發的 handle。
 * @param {import('vitest').Mock} onSnapshotMock - firebase/firestore mock。
 * @returns {ProfileSnapshotHandle} 可模擬 profile snapshot 的 handle。
 */
export function captureProfileSnapshot(onSnapshotMock) {
  /** @type {((snap: { data: () => object | null }) => void) | null} */
  let onData = null;
  const unsubscribe = vi.fn();

  onSnapshotMock.mockImplementation((_ref, dataCallback) => {
    onData = dataCallback;
    return unsubscribe;
  });

  return {
    emit: (data) => {
      if (!onData) throw new Error('snapshot data cb not captured yet');
      act(() => {
        onData?.({ data: () => data });
      });
    },
    unsubscribe,
  };
}

/**
 * 建立可作為 firebase user 替身的物件。
 * @param {object} [overrides] - 覆寫欄位。
 * @returns {{ uid: string, displayName: string | null, email: string | null, photoURL: string | null, getIdToken: () => Promise<string> }} fake firebase user。
 */
export function makeFbUser(overrides = {}) {
  return {
    uid: 'user-1',
    displayName: 'Real Name',
    email: 'real@example.com',
    photoURL: 'https://cdn/p.png',
    getIdToken: vi.fn(async () => 'tok-1'),
    ...overrides,
  };
}
