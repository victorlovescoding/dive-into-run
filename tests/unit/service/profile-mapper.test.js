import { describe, expect, it } from 'vitest';
import { toPublicProfile } from '@/service/profile-mapper';

describe('Unit: toPublicProfile', () => {
  it('maps numeric followersCount from Firestore data without exposing followingCount', () => {
    const createdAt = { seconds: 1770000000, nanoseconds: 0 };

    const result = toPublicProfile('runner-1', {
      uid: 'runner-1',
      name: 'Runner One',
      photoURL: 'https://example.com/runner.jpg',
      bio: '晨跑派。',
      createdAt,
      followersCount: 12,
      followingCount: 4,
    });

    expect(result).toEqual({
      uid: 'runner-1',
      name: 'Runner One',
      photoURL: 'https://example.com/runner.jpg',
      bio: '晨跑派。',
      createdAt,
      followersCount: 12,
    });
    expect(result).not.toHaveProperty('followingCount');
  });

  it('ignores non-number followersCount from Firestore data', () => {
    const createdAt = { seconds: 1770000000, nanoseconds: 0 };

    const result = toPublicProfile('runner-1', {
      uid: 'runner-1',
      name: 'Runner One',
      photoURL: 'https://example.com/runner.jpg',
      createdAt,
      followersCount: '12',
    });

    expect(result).toEqual({
      uid: 'runner-1',
      name: 'Runner One',
      photoURL: 'https://example.com/runner.jpg',
      createdAt,
    });
  });
});
