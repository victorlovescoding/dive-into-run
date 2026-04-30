/*
 * AuthProvider RTL integration test。
 *
 * Mock 邊界限定在 firebase/auth、firebase/firestore、firebase-client。
 * 不 mock 自家 runtime/service/repo，直接走真實 use-case -> service -> repo 串接。
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import AuthProvider, { AuthContext } from '@/runtime/providers/AuthProvider';
import {
  captureAuthCallback,
  captureProfileSnapshot,
  makeFbUser,
} from '../../_helpers/auth-provider-test-helpers';

const {
  mockOnAuthStateChanged,
  mockDoc,
  mockGetDoc,
  mockSetDoc,
  mockOnSnapshot,
  mockServerTimestamp,
} = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockDoc: vi.fn((_db, ...segments) => ({
    type: 'doc',
    path: segments.join('/'),
    id: String(segments.at(-1) ?? ''),
  })),
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn(),
  mockOnSnapshot: vi.fn(),
  mockServerTimestamp: vi.fn(() => ({ __ts: true })),
}));

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: mockOnAuthStateChanged,
  signOut: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  getDoc: mockGetDoc,
  setDoc: mockSetDoc,
  onSnapshot: mockOnSnapshot,
  serverTimestamp: mockServerTimestamp,
}));

vi.mock('@/config/client/firebase-client', () => ({
  auth: { name: 'mock-auth' },
  db: { name: 'mock-db' },
  provider: { providerId: 'google.com' },
}));

/** @type {import('vitest').Mock} */
const onAuthStateChangedMock = /** @type {any} */ (mockOnAuthStateChanged);
/** @type {import('vitest').Mock} */
const getDocMock = /** @type {any} */ (mockGetDoc);
/** @type {import('vitest').Mock} */
const setDocMock = /** @type {any} */ (mockSetDoc);
/** @type {import('vitest').Mock} */
const onSnapshotMock = /** @type {any} */ (mockOnSnapshot);

/**
 * 顯示目前 AuthContext 值，供 RTL 驗證。
 * @returns {import('react').ReactElement} consumer view。
 */
function ContextView() {
  return (
    <AuthContext.Consumer>
      {(value) => (
        <>
          <span data-testid="loading">{value.loading ? 'true' : 'false'}</span>
          <span data-testid="uid">{value.user ? value.user.uid : 'null'}</span>
          <span data-testid="name">{value.user ? (value.user.name ?? '') : ''}</span>
          <span data-testid="email">{value.user ? (value.user.email ?? '') : ''}</span>
        </>
      )}
    </AuthContext.Consumer>
  );
}

/**
 * render 用的 wrapper。
 * @param {object} props - 元件 props。
 * @param {import('react').ReactNode} props.children - 子節點。
 * @returns {import('react').ReactElement} AuthProvider wrapper。
 */
function AuthProviderWrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

/**
 * 渲染 provider + consumer。
 * @returns {ReturnType<typeof render>} render result。
 */
function renderProviderView() {
  return render(<AuthProvider><ContextView /></AuthProvider>);
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登入：onAuthStateChanged 觸發 null 後 user=null、loading=false', async () => {
    const auth = captureAuthCallback(onAuthStateChangedMock);

    renderProviderView();
    await auth.emit(null);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('uid')).toHaveTextContent('null');
    expect(getDocMock).not.toHaveBeenCalled();
    expect(onSnapshotMock).not.toHaveBeenCalled();
  });

  it('登入 + profile doc 存在：context user 對齊 createAuthUser mapper 結果', async () => {
    const auth = captureAuthCallback(onAuthStateChangedMock);
    const profile = captureProfileSnapshot(onSnapshotMock);
    getDocMock.mockResolvedValueOnce({ exists: () => true });

    renderProviderView();
    await auth.emit(makeFbUser());
    profile.emit({
      name: 'Profile Name',
      email: 'profile@example.com',
      photoURL: 'https://cdn/profile.png',
      bio: 'hello',
    });

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('uid')).toHaveTextContent('user-1');
    expect(screen.getByTestId('name')).toHaveTextContent('Profile Name');
    expect(screen.getByTestId('email')).toHaveTextContent('profile@example.com');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('登入 + profile doc 不存在：ensureUserProfileDocument 會呼叫 setDoc 補建立', async () => {
    const auth = captureAuthCallback(onAuthStateChangedMock);
    const profile = captureProfileSnapshot(onSnapshotMock);
    getDocMock.mockResolvedValueOnce({ exists: () => false });

    renderProviderView();
    await auth.emit(makeFbUser());
    profile.emit(null);

    await waitFor(() => {
      expect(setDocMock).toHaveBeenCalled();
    });
    expect(setDocMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: 'users/user-1' }),
      expect.objectContaining({
        uid: 'user-1',
        name: 'Real Name',
        email: 'real@example.com',
        photoURL: 'https://cdn/p.png',
      }),
      { merge: true },
    );
    await waitFor(() => {
      expect(screen.getByTestId('uid')).toHaveTextContent('user-1');
    });
    expect(screen.getByTestId('name')).toHaveTextContent('');
    expect(screen.getByTestId('email')).toHaveTextContent('');
  });

  it('profile snapshot 後續 update：context user 隨之刷新', async () => {
    const auth = captureAuthCallback(onAuthStateChangedMock);
    const profile = captureProfileSnapshot(onSnapshotMock);
    getDocMock.mockResolvedValueOnce({ exists: () => true });

    renderProviderView();
    await auth.emit(makeFbUser());
    profile.emit({ name: 'First', email: 'a@x.com' });

    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveTextContent('First');
    });

    profile.emit({ name: 'Second', email: 'b@x.com', bio: 'updated' });

    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveTextContent('Second');
    });
    expect(screen.getByTestId('email')).toHaveTextContent('b@x.com');
  });

  it('登出：user 回 null、profile listener 被取消', async () => {
    const auth = captureAuthCallback(onAuthStateChangedMock);
    const profile = captureProfileSnapshot(onSnapshotMock);
    getDocMock.mockResolvedValueOnce({ exists: () => true });

    renderProviderView();
    await auth.emit(makeFbUser());
    profile.emit({ name: 'Active' });

    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveTextContent('Active');
    });

    await auth.emit(null);

    await waitFor(() => {
      expect(screen.getByTestId('uid')).toHaveTextContent('null');
    });
    expect(profile.unsubscribe).toHaveBeenCalled();
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('unmount：auth + profile listener 都被取消', async () => {
    const auth = captureAuthCallback(onAuthStateChangedMock);
    const profile = captureProfileSnapshot(onSnapshotMock);
    getDocMock.mockResolvedValueOnce({ exists: () => true });

    const { unmount } = renderProviderView();
    await auth.emit(makeFbUser());
    profile.emit({ name: 'Mounted' });
    await waitFor(() => {
      expect(screen.getByTestId('name')).toHaveTextContent('Mounted');
    });

    unmount();

    expect(auth.unsubscribe).toHaveBeenCalled();
    expect(profile.unsubscribe).toHaveBeenCalled();
  });

  it('renderHook + wrapper：useContext(AuthContext) 取得初始 loading=true', () => {
    captureAuthCallback(onAuthStateChangedMock);

    const { result } = renderHook(() => React.useContext(AuthContext), {
      wrapper: AuthProviderWrapper,
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });
});
