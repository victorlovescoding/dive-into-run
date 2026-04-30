import { beforeEach, describe, expect, it, vi } from 'vitest';
import getUserProfileDocument from '@/repo/server/firebase-profile-server-repo';

const { mockApplicationDefault, mockCollection, mockDoc, mockGet, mockInitializeApp } =
  vi.hoisted(() => ({
    mockApplicationDefault: vi.fn(),
    mockCollection: vi.fn(),
    mockDoc: vi.fn(),
    mockGet: vi.fn(),
    mockInitializeApp: vi.fn(),
  }));

vi.mock('firebase-admin', () => {
  const firestoreInstance = {
    collection: mockCollection,
  };

  const firestoreFn = vi.fn(() => firestoreInstance);

  return {
    default: {
      apps: [],
      auth: vi.fn(() => ({})),
      credential: {
        applicationDefault: mockApplicationDefault,
      },
      firestore: firestoreFn,
      initializeApp: mockInitializeApp,
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();

  mockDoc.mockImplementation((path, uid) => ({
    id: uid,
    path: `${path}/${uid}`,
    get: mockGet,
  }));
  mockCollection.mockImplementation((path) => ({
    doc: (uid) => mockDoc(path, uid),
  }));
});

describe('firebase-profile-server-repo', () => {
  it('文件存在時回傳 raw document data', async () => {
    const payload = {
      uid: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      photoURL: 'https://example.com/alice.jpg',
      createdAt: { seconds: 1700000000, nanoseconds: 0 },
    };
    mockGet.mockResolvedValue({
      exists: true,
      data: () => payload,
    });

    await expect(getUserProfileDocument('user-1')).resolves.toEqual(payload);

    expect(mockCollection).toHaveBeenCalledWith('users');
    expect(mockDoc).toHaveBeenCalledWith('users', 'user-1');
    expect(mockGet.mock.calls).toHaveLength(1);
  });

  it('文件不存在時回傳 null', async () => {
    mockGet.mockResolvedValue({
      exists: false,
      data: () => undefined,
    });

    await expect(getUserProfileDocument('missing')).resolves.toBeNull();
  });

  it('snap.data() 空值時回傳空物件，不在 repo 層做 shape 正規化', async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => undefined,
    });

    await expect(getUserProfileDocument('user-2')).resolves.toEqual({});
  });
});
