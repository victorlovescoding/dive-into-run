import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as firestore from 'firebase/firestore';
import {
  normalizeEventPayload,
  createEvent,
  fetchLatestEvents,
  queryEvents,
  fetchEventById,
  fetchNextEvents,
  joinEvent,
  leaveEvent,
  fetchParticipants,
  fetchMyJoinedEventsForIds,
} from '@/lib/firebase-events';

// Mock dependencies
vi.mock('@/lib/firebase-client', () => ({
  db: { _isMockDb: true },
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    addDoc: vi.fn(),
    collection: vi.fn(),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    doc: vi.fn(),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
    startAfter: vi.fn(),
    serverTimestamp: vi.fn(),
    runTransaction: vi.fn(),
    Timestamp: {
      fromDate: (date) => ({
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: 0,
        toDate: () => date,
      }),
      now: () => ({ seconds: Date.now() / 1000, nanoseconds: 0 }),
    },
  };
});

describe('firebase-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeEventPayload', () => {
    it('should normalize valid payload', () => {
      const raw = {
        title: 'Test Run',
        time: '2023-10-10T10:00',
        registrationDeadline: '2023-10-09T10:00',
        distanceKm: '5',
        maxParticipants: '10',
        planRoute: 'A',
        paceMinutes: '5',
        paceSeconds: '30',
        other: 'value',
      };

      const result = normalizeEventPayload(raw);

      expect(result.distanceKm).toBe(5);
      expect(result.maxParticipants).toBe(10);
      expect(result.paceSec).toBe(330); // 5*60 + 30
      expect(result.time).toBeDefined();
      expect(result.registrationDeadline).toBeDefined();
      expect(result.other).toBe('value');
      expect(result).not.toHaveProperty('paceMinutes');
    });

    it('should throw error for invalid time', () => {
      const raw = { time: 'invalid' };
      expect(() => normalizeEventPayload(raw)).toThrow();
    });

    it('should throw error for invalid distance', () => {
      const raw = {
        time: '2023-10-10T10:00',
        registrationDeadline: '2023-10-09T10:00',
        distanceKm: 'abc',
      };
      expect(() => normalizeEventPayload(raw)).toThrow('距離（公里）請輸入有效數字');
    });
  });

  describe('createEvent', () => {
    it('should call addDoc with correct payload', async () => {
      const raw = {
        title: 'Test',
        time: '2023-10-10T10:00',
        registrationDeadline: '2023-10-09T10:00',
        distanceKm: '5',
        maxParticipants: '10',
        paceMinutes: '5',
        paceSeconds: '0',
      };
      const extra = { hostId: 'u1' };
      const mockRef = { id: 'new-id' };
      firestore.addDoc.mockResolvedValueOnce(mockRef);

      const result = await createEvent(raw, extra);

      expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'events');
      expect(firestore.addDoc).toHaveBeenCalled();
      const payload = firestore.addDoc.mock.calls[0][1];
      expect(payload.hostId).toBe('u1');
      expect(payload.paceSec).toBe(300);
      expect(result).toBe(mockRef);
    });
  });

  describe('fetchLatestEvents', () => {
    it('should return events and lastDoc', async () => {
      const mockDocs = [
        { id: '1', data: () => ({ title: 'E1' }) },
        { id: '2', data: () => ({ title: 'E2' }) },
      ];
      firestore.getDocs.mockResolvedValueOnce({ docs: mockDocs });

      const result = await fetchLatestEvents(2);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].id).toBe('1');
      expect(result.lastDoc).toBe(mockDocs[1]);
      expect(firestore.query).toHaveBeenCalled();
      expect(firestore.orderBy).toHaveBeenCalledWith('time', 'desc');
    });
  });

  describe('queryEvents', () => {
    it('should query with filters', async () => {
      const mockDocs = [{ id: '1', data: () => ({ time: {}, city: 'Tao', distanceKm: 5 }) }];
      firestore.getDocs.mockResolvedValueOnce({ docs: mockDocs });

      const result = await queryEvents({ city: 'Tao' });
      expect(result).toHaveLength(1);
      expect(firestore.where).toHaveBeenCalledWith('city', '==', 'Tao');
    });

    it('should filter by time', async () => {
      const mockDocs = [];
      firestore.getDocs.mockResolvedValueOnce({ docs: mockDocs });
      await queryEvents({ startTime: '2023-01-01', endTime: '2023-01-02' });
      expect(firestore.where).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchEventById', () => {
    it('should return null if not found', async () => {
      firestore.doc.mockReturnValueOnce({});
      firestore.getDoc.mockResolvedValueOnce({ exists: () => false });
      const result = await fetchEventById('1');
      expect(result).toBeNull();
    });

    it('should return event data if found', async () => {
      firestore.doc.mockReturnValueOnce({});
      firestore.getDoc.mockResolvedValueOnce({
        exists: () => true,
        id: '1',
        data: () => ({ title: 'E1' }),
      });
      const result = await fetchEventById('1');
      expect(result).toEqual({ id: '1', title: 'E1' });
    });
  });

  describe('fetchNextEvents', () => {
    it('should use startAfter', async () => {
      const mockAfterDoc = {};
      firestore.getDocs.mockResolvedValueOnce({ docs: [] });
      await fetchNextEvents(mockAfterDoc);
      expect(firestore.startAfter).toHaveBeenCalledWith(mockAfterDoc);
    });

    it('should return empty if no afterDoc', async () => {
      const result = await fetchNextEvents(null);
      expect(result.events).toHaveLength(0);
    });
  });

  describe('joinEvent', () => {
    it('should succeed if valid', async () => {
      firestore.runTransaction.mockImplementation(async (db, callback) => {
        // Mock transaction context
        const tx = {
          get: vi.fn(),
          set: vi.fn(),
          update: vi.fn(),
        };
        tx.get
          .mockResolvedValueOnce({
            // event
            exists: () => true,
            data: () => ({ maxParticipants: 10, participantsCount: 0, remainingSeats: 10 }),
          })
          .mockResolvedValueOnce({
            // participant
            exists: () => false,
          });

        return callback(tx);
      });

      const result = await joinEvent('eid', { uid: 'uid' });
      expect(result.ok).toBe(true);
      expect(result.status).toBe('joined');
    });

    it('should return full if no seats', async () => {
      firestore.runTransaction.mockImplementation(async (db, callback) => {
        const tx = {
          get: vi.fn(),
        };
        tx.get
          .mockResolvedValueOnce({
            // event
            exists: () => true,
            data: () => ({ maxParticipants: 10, participantsCount: 10, remainingSeats: 0 }),
          })
          .mockResolvedValueOnce({
            // participant
            exists: () => false,
          });

        return callback(tx);
      });

      const result = await joinEvent('eid', { uid: 'uid' });
      expect(result.ok).toBe(false);
      expect(result.status).toBe('full');
    });

    it('should return already_joined if joined', async () => {
      firestore.runTransaction.mockImplementation(async (db, callback) => {
        const tx = {
          get: vi.fn(),
        };
        tx.get
          .mockResolvedValueOnce({
            // event
            exists: () => true,
            data: () => ({ maxParticipants: 10, participantsCount: 0, remainingSeats: 10 }),
          })
          .mockResolvedValueOnce({
            // participant
            exists: () => true,
          });

        return callback(tx);
      });

      const result = await joinEvent('eid', { uid: 'uid' });
      expect(result.ok).toBe(true);
      expect(result.status).toBe('already_joined');
    });
  });

  describe('leaveEvent', () => {
    it('should succeed if joined', async () => {
      firestore.runTransaction.mockImplementation(async (db, callback) => {
        const tx = {
          get: vi.fn(),
          delete: vi.fn(),
          update: vi.fn(),
        };
        tx.get
          .mockResolvedValueOnce({
            // event
            exists: () => true,
            data: () => ({ maxParticipants: 10, participantsCount: 1, remainingSeats: 9 }),
          })
          .mockResolvedValueOnce({
            // participant
            exists: () => true, // is joined
          });

        return callback(tx);
      });

      const result = await leaveEvent('eid', { uid: 'uid' });
      expect(result.ok).toBe(true);
      expect(result.status).toBe('left');
    });
  });

  describe('fetchParticipants', () => {
    it('should return list', async () => {
      firestore.getDocs.mockResolvedValueOnce({ docs: [{ id: 'p1', data: () => ({}) }] });
      const result = await fetchParticipants('eid');
      expect(result).toHaveLength(1);
      expect(firestore.collection).toHaveBeenCalledWith(
        expect.anything(),
        'events',
        'eid',
        'participants',
      );
    });
  });

  describe('fetchMyJoinedEventsForIds', () => {
    it('should return set of joined ids', async () => {
      firestore.getDoc
        .mockResolvedValueOnce({ exists: () => true }) // e1 joined
        .mockResolvedValueOnce({ exists: () => false }); // e2 not joined

      const result = await fetchMyJoinedEventsForIds('uid', ['e1', 'e2']);
      expect(result.has('e1')).toBe(true);
      expect(result.has('e2')).toBe(false);
    });
  });
});
