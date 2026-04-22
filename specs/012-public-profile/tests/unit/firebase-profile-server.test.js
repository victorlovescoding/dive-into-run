/**
 * @file Unit tests for firebase-profile-server.js (Server Component / server repo).
 * @description
 * TDD RED phase — tests target `getUserProfileServer(uid)` which does NOT exist yet.
 * The function uses the server repo entry point and shared mapper, and is consumed by
 * Server Components and `generateMetadata` callbacks. Output shape must match the
 * client-side `getUserProfile` (PublicProfile, email excluded).
 *
 * Rules:
 * 1. AAA Pattern (Arrange, Act, Assert).
 * 2. F.I.R.S.T principles — 100% isolated; mock the server repo.
 * 3. Never test mock behaviour — assert real function output shape.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks — replace `@/repo/server/firebase-profile-server-repo` so the service
// under test receives a controllable raw profile payload.
// ---------------------------------------------------------------------------

/** @type {import('vitest').Mock} */
const mockGetUserProfileDocument = vi.fn();

vi.mock('@/repo/server/firebase-profile-server-repo', () => ({
  default: mockGetUserProfileDocument,
}));

// ---------------------------------------------------------------------------
// getUserProfileServer(uid)
// ---------------------------------------------------------------------------

describe('Unit: getUserProfileServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('應該回傳 PublicProfile 物件並排除 email 欄位', async () => {
    // Arrange
    const fields = {
      uid: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      photoURL: 'https://example.com/alice.jpg',
      bio: '熱愛跑步的工程師',
      createdAt: { seconds: 1700000000, nanoseconds: 0 },
    };
    mockGetUserProfileDocument.mockResolvedValueOnce(fields);

    // Act
    const { getUserProfileServer } = await import('@/lib/firebase-profile-server');
    const result = await getUserProfileServer('user-1');

    // Assert
    expect(result).toEqual({
      uid: 'user-1',
      name: 'Alice',
      photoURL: 'https://example.com/alice.jpg',
      bio: '熱愛跑步的工程師',
      createdAt: fields.createdAt,
    });
    expect(result).not.toHaveProperty('email');
    expect(mockGetUserProfileDocument).toHaveBeenCalledWith('user-1');
  });

  it('當文件不存在時應該回傳 null', async () => {
    // Arrange
    mockGetUserProfileDocument.mockResolvedValueOnce(null);

    // Act
    const { getUserProfileServer } = await import('@/lib/firebase-profile-server');
    const result = await getUserProfileServer('missing');

    // Assert
    expect(result).toBeNull();
  });

  it('當 bio 欄位不存在時 result.bio 應為 undefined（仍是 PublicProfile）', async () => {
    // Arrange
    const fields = {
      uid: 'user-2',
      name: 'Bob',
      email: 'bob@example.com',
      photoURL: '',
      createdAt: { seconds: 1700000000, nanoseconds: 0 },
    };
    mockGetUserProfileDocument.mockResolvedValueOnce(fields);

    // Act
    const { getUserProfileServer } = await import('@/lib/firebase-profile-server');
    const result = await getUserProfileServer('user-2');

    // Assert
    expect(result).not.toBeNull();
    expect(result?.uid).toBe('user-2');
    expect(result?.bio).toBeUndefined();
    expect(result).not.toHaveProperty('email');
  });

  it('應透過 server repo 取得文件資料', async () => {
    // Arrange
    mockGetUserProfileDocument.mockResolvedValueOnce(null);

    // Act
    const { getUserProfileServer } = await import('@/lib/firebase-profile-server');
    await getUserProfileServer('user-x');

    // Assert
    expect(mockGetUserProfileDocument).toHaveBeenCalledWith('user-x');
    expect(mockGetUserProfileDocument).toHaveBeenCalledTimes(1);
  });

  it('當 uid 為空字串時應拋出 Error', async () => {
    // Act + Assert
    const { getUserProfileServer } = await import('@/lib/firebase-profile-server');
    await expect(getUserProfileServer('')).rejects.toThrow('uid is required');
    expect(mockGetUserProfileDocument).not.toHaveBeenCalled();
  });

  it('回傳的 shape 應與 client 版 getUserProfile 一致（含 uid/name/photoURL/createdAt 必填，bio 選填）', async () => {
    // Arrange
    const fields = {
      uid: 'user-3',
      name: 'Carol',
      email: 'carol@example.com',
      photoURL: 'https://example.com/carol.jpg',
      bio: '馬拉松愛好者',
      createdAt: { seconds: 1701000000, nanoseconds: 0 },
      // 額外的私有欄位（例如 nameChangedAt）也應被排除或允許但不影響核心 shape
      nameChangedAt: { seconds: 1702000000, nanoseconds: 0 },
    };
    mockGetUserProfileDocument.mockResolvedValueOnce(fields);

    // Act
    const { getUserProfileServer } = await import('@/lib/firebase-profile-server');
    const result = await getUserProfileServer('user-3');

    // Assert — 核心欄位完全相符
    expect(result).not.toBeNull();
    expect(result?.uid).toBe('user-3');
    expect(result?.name).toBe('Carol');
    expect(result?.photoURL).toBe('https://example.com/carol.jpg');
    expect(result?.bio).toBe('馬拉松愛好者');
    expect(result?.createdAt).toEqual(fields.createdAt);
    // 必須排除 email
    expect(result).not.toHaveProperty('email');
  });
});
