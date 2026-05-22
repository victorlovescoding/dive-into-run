import { describe, it, expect, vi } from 'vitest';
import { serializeProfile } from '@/app/users/[uid]/page';
import { createPublicProfileTimestampFixture as createProfile } from '../../_helpers/profile-fixtures';

vi.mock('firebase-admin', () => {
  const firestore = Object.assign(vi.fn(() => ({})), {
    FieldValue: {
      serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
    },
    Timestamp: {
      fromDate: vi.fn((date) => ({ toDate: () => date })),
    },
  });
  return {
    default: {
      apps: [{}],
      auth: vi.fn(() => ({})),
      credential: {
        applicationDefault: vi.fn(() => ({})),
      },
      firestore,
      initializeApp: vi.fn(),
    },
  };
});

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

vi.mock('@/app/users/[uid]/ProfileClient', () => ({
  default: vi.fn(() => null),
}));

describe('Integration: ProfilePage serialization', () => {
  it('preserves public followersCount for ProfileClient without serializing followingCount', () => {
    const createdAt = new Date('2026-05-20T10:30:00.000Z');
    const serverProfile = {
      ...createProfile({
        uid: 'target-runner',
        name: 'Target Runner',
        photoURL: 'https://example.com/target.png',
        bio: 'Seeded runner.',
        createdAt: { toDate: () => createdAt },
      }),
      followersCount: 1,
      followingCount: 9,
    };

    const serialized = serializeProfile(
      /** @type {Parameters<typeof serializeProfile>[0]} */ (/** @type {unknown} */ (serverProfile)),
    );

    expect(serialized).toEqual({
      uid: 'target-runner',
      name: 'Target Runner',
      photoURL: 'https://example.com/target.png',
      bio: 'Seeded runner.',
      createdAt,
      followersCount: 1,
    });
    expect(serialized).not.toHaveProperty('followingCount');
  });
});
