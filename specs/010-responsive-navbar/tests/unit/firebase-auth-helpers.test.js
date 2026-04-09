import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithGoogle, signOutUser } from '@/lib/firebase-auth-helpers';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, provider } from '@/lib/firebase-client';

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/firebase-client', () => ({
  auth: { name: 'mock-auth' },
  provider: { providerId: 'google.com' },
}));

/** @type {import('vitest').Mock} */
const mockedSignInWithPopup = /** @type {any} */ (signInWithPopup);

/** @type {import('vitest').Mock} */
const mockedSignOut = /** @type {any} */ (signOut);

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
