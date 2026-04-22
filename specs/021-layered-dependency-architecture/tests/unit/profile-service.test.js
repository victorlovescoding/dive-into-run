import { describe, expect, it, vi, beforeEach } from 'vitest';

const fetchUserProfileDocument = vi.fn();
const fetchHostedCount = vi.fn();
const fetchJoinedCount = vi.fn();
const fetchHostedEventDocumentsPage = vi.fn();
const updateUserBioDocument = vi.fn();

vi.mock('@/repo/client/firebase-profile-repo', () => ({
  fetchUserProfileDocument,
  fetchHostedCount,
  fetchJoinedCount,
  fetchHostedEventDocumentsPage,
  updateUserBioDocument,
}));

const service = await import('@/service/profile-service');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('profile-service split', () => {
  it('getUserProfile normalizes repo payloads', async () => {
    fetchUserProfileDocument.mockResolvedValue({
      name: 'Amy',
      photoURL: 'https://img',
      bio: 'runner',
      createdAt: { kind: 'timestamp' },
    });

    await expect(service.getUserProfile('u1')).resolves.toEqual(
      expect.objectContaining({
        uid: 'u1',
        name: 'Amy',
        photoURL: 'https://img',
        bio: 'runner',
      }),
    );
  });

  it('getProfileStats delegates counts to repo', async () => {
    fetchHostedCount.mockResolvedValue(2);
    fetchJoinedCount.mockResolvedValue(7);

    await expect(service.getProfileStats('u1')).resolves.toEqual({
      hostedCount: 2,
      joinedCount: 7,
      totalDistanceKm: null,
    });
  });

  it('getHostedEvents pages and trims the visible set', async () => {
    fetchHostedEventDocumentsPage.mockResolvedValue({
      docs: [
        { id: 'e1', data: () => ({ time: { seconds: 20 }, title: 'A' }) },
        { id: 'e2', data: () => ({ time: { seconds: 10 }, title: 'B' }) },
        { id: 'e3', data: () => ({ time: { seconds: 5 }, title: 'C' }) },
      ],
      lastDoc: null,
    });

    await expect(service.getHostedEvents('u1', { pageSize: 2 })).resolves.toEqual({
      items: [
        { id: 'e1', time: { seconds: 20 }, title: 'A' },
        { id: 'e2', time: { seconds: 10 }, title: 'B' },
      ],
      lastDoc: expect.objectContaining({
        id: 'e2',
        data: expect.any(Function),
      }),
      hasMore: true,
    });
  });

  it('updateUserBio trims before writing', async () => {
    await service.updateUserBio('u1', '  hello  ');

    expect(updateUserBioDocument).toHaveBeenCalledWith('u1', 'hello');
  });
});
