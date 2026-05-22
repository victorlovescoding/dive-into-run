import { describe, expect, it } from 'vitest';
import {
  applyFollowCountDelta,
  buildFollowDocumentPayload,
  normalizeDerivedFollowingCount,
  normalizeFollowDocuments,
  validateFollowPair,
} from '@/service/follow-service';

const CREATED_AT = 'mock-created-at';

const follower = {
  uid: 'viewer',
  name: 'Viewer Runner',
  photoURL: 'https://example.test/viewer.png',
};

const target = {
  uid: 'target',
  name: 'Target Runner',
  photoURL: 'https://example.test/target.png',
};

/**
 * Casts invalid test values into the public UID parameter shape.
 * @param {unknown} value - Invalid UID candidate.
 * @returns {string} Value passed through as a UID parameter.
 */
function asUid(value) {
  return /** @type {string} */ (value);
}

/**
 * Creates a Firestore-like follow snapshot.
 * @param {string} id - Snapshot ID.
 * @param {object} data - Snapshot data.
 * @returns {{ id: string, data: () => object }} Snapshot double.
 */
function createSnapshot(id, data) {
  return {
    id,
    data: () => data,
  };
}

describe('follow service', () => {
  it('validates non-self follow pairs and trims UID input', () => {
    const result = validateFollowPair(' viewer ', ' target ');

    expect(result).toEqual({
      followerUid: 'viewer',
      targetUid: 'target',
    });
  });

  it('rejects missing and self follow pairs', () => {
    expect(() => validateFollowPair(asUid(null), 'target')).toThrow('Follower uid is required');
    expect(() => validateFollowPair('viewer', asUid(undefined))).toThrow('Target uid is required');
    expect(() => validateFollowPair('runner', 'runner')).toThrow('Self follow is not allowed');
  });

  it('builds a shared mirrored follow payload', () => {
    const result = buildFollowDocumentPayload({
      follower,
      target,
      createdAtValue: CREATED_AT,
    });

    expect(result).toEqual({
      followerUid: 'viewer',
      followerName: 'Viewer Runner',
      followerPhotoURL: 'https://example.test/viewer.png',
      targetUid: 'target',
      targetName: 'Target Runner',
      targetPhotoURL: 'https://example.test/target.png',
      status: 'following',
      createdAt: CREATED_AT,
    });
  });

  it('normalizes follower and following public list rows', () => {
    const snapshots = [
      createSnapshot('viewer', {
        followerUid: 'viewer',
        followerName: 'Viewer Runner',
        followerPhotoURL: 'https://example.test/viewer.png',
        targetUid: 'target',
        targetName: 'Target Runner',
        targetPhotoURL: 'https://example.test/target.png',
        createdAt: CREATED_AT,
      }),
    ];

    expect(normalizeFollowDocuments(snapshots, 'followers')).toEqual([
      {
        uid: 'viewer',
        name: 'Viewer Runner',
        photoURL: 'https://example.test/viewer.png',
        createdAt: CREATED_AT,
      },
    ]);
    expect(normalizeFollowDocuments(snapshots, 'following')).toEqual([
      {
        uid: 'target',
        name: 'Target Runner',
        photoURL: 'https://example.test/target.png',
        createdAt: CREATED_AT,
      },
    ]);
  });

  it('applies count deltas with a zero floor', () => {
    expect(applyFollowCountDelta(2, 1)).toBe(3);
    expect(applyFollowCountDelta(1, -1)).toBe(0);
    expect(applyFollowCountDelta(0, -1)).toBe(0);
    expect(applyFollowCountDelta(undefined, 1)).toBe(1);
  });

  it('normalizes derived following counts from list or aggregate reads', () => {
    expect(normalizeDerivedFollowingCount(3)).toBe(3);
    expect(normalizeDerivedFollowingCount(0)).toBe(0);
    expect(normalizeDerivedFollowingCount(-1)).toBe(0);
    expect(normalizeDerivedFollowingCount(undefined)).toBe(0);
  });
});
