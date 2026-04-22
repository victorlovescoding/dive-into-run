import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { signInWithGoogle, signOutUser, subscribeToAuthChanges } from '@/lib/firebase-auth-helpers';
import { auth, provider } from '@/config/client/firebase-client';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/config/client/firebase-client', () => ({
  auth: { name: 'mock-auth' },
  provider: { providerId: 'google.com' },
}));

/** @type {import('vitest').Mock} */
const mockedSignInWithPopup = /** @type {any} */ (signInWithPopup);

/** @type {import('vitest').Mock} */
const mockedSignOut = /** @type {any} */ (signOut);

/** @type {import('vitest').Mock} */
const mockedOnAuthStateChanged = /** @type {any} */ (onAuthStateChanged);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signInWithGoogle', () => {
  it('should call signInWithPopup with auth and provider', async () => {
    // Arrange
    const fakeCredential = { user: { uid: '123' } };
    mockedSignInWithPopup.mockResolvedValue(fakeCredential);

    // Act
    const result = await signInWithGoogle();

    // Assert
    expect(mockedSignInWithPopup).toHaveBeenCalledOnce();
    expect(mockedSignInWithPopup).toHaveBeenCalledWith(auth, provider);
    expect(result).toBe(fakeCredential);
  });

  it('should propagate errors from signInWithPopup', async () => {
    // Arrange
    const error = new Error('popup-closed');
    mockedSignInWithPopup.mockRejectedValue(error);

    // Act & Assert
    await expect(signInWithGoogle()).rejects.toThrow('popup-closed');
  });
});

describe('signOutUser', () => {
  it('should call signOut with auth', async () => {
    // Arrange
    mockedSignOut.mockResolvedValue(undefined);

    // Act
    await signOutUser();

    // Assert
    expect(mockedSignOut).toHaveBeenCalledOnce();
    expect(mockedSignOut).toHaveBeenCalledWith(auth);
  });

  it('should propagate errors from signOut', async () => {
    // Arrange
    const error = new Error('sign-out-failed');
    mockedSignOut.mockRejectedValue(error);

    // Act & Assert
    await expect(signOutUser()).rejects.toThrow('sign-out-failed');
  });
});

describe('subscribeToAuthChanges', () => {
  it('should forward callback to onAuthStateChanged with auth', () => {
    // Arrange
    const unsubscribe = vi.fn();
    mockedOnAuthStateChanged.mockReturnValue(unsubscribe);
    const callback = vi.fn();

    // Act
    subscribeToAuthChanges(callback);

    // Assert
    expect(mockedOnAuthStateChanged).toHaveBeenCalledOnce();
    expect(mockedOnAuthStateChanged).toHaveBeenCalledWith(auth, callback);
  });

  it('should return the unsubscribe function from onAuthStateChanged unchanged', () => {
    // Arrange — identity check 保證 wrapper 沒有包 Promise、沒有吃掉 return value。
    const unsubscribe = vi.fn();
    mockedOnAuthStateChanged.mockReturnValue(unsubscribe);

    // Act
    const result = subscribeToAuthChanges(() => {});

    // Assert
    expect(result).toBe(unsubscribe);
  });

  it('should invoke callback when onAuthStateChanged fires', () => {
    // Arrange — 手動觸發 mock 接到的 callback，確認 forward 的是同一個 function。
    /** @type {((user: unknown) => void) | null} */
    let capturedCallback = null;
    mockedOnAuthStateChanged.mockImplementation((_auth, cb) => {
      capturedCallback = cb;
      return vi.fn();
    });
    const callback = vi.fn();
    const fakeUser = { uid: 'user-1' };

    // Act
    subscribeToAuthChanges(callback);
    capturedCallback?.(fakeUser);

    // Assert
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(fakeUser);
  });
});
