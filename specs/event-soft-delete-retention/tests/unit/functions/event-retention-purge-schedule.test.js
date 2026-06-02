import Module, { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* eslint-disable jsdoc/check-alignment -- JSDoc cast covers Node's private module loader in tests. */

const requireFunctionModule = createRequire(import.meta.url);
const indexPath = requireFunctionModule.resolve('../../../../../functions/index.js');
const moduleLoader = /**
 * @type {typeof Module & {
 *   _load: (request: string, parent: unknown, isMain: boolean) => unknown,
 * }}
 */ (Module);

describe('scheduled event retention purge wrapper', () => {
  const originalLoad = moduleLoader._load;
  const mockDb = { kind: 'firestore' };
  const mockLogger = { info: vi.fn() };
  const mockNow = { kind: 'timestamp-now' };
  const mockPostPurge = vi.fn(async () => ({ posts: 0, comments: 0, likes: 0, skips: 0 }));
  const mockEventPurge = vi.fn(async () => ({
    events: 1,
    eventComments: 2,
    participants: 3,
    historyRecords: 4,
    skips: 5,
  }));
  const mockOnSchedule = vi.fn((scheduleOptions, handler) => ({ handler, scheduleOptions }));

  beforeEach(() => {
    vi.clearAllMocks();
    delete requireFunctionModule.cache[indexPath];

    moduleLoader._load = function loadMockedModule(request, parent, isMain) {
      if (request === 'firebase-admin/app') {
        return {
          getApps: () => [],
          initializeApp: vi.fn(),
        };
      }

      if (request === 'firebase-admin/auth') {
        return { getAuth: () => ({}) };
      }

      if (request === 'firebase-admin/firestore') {
        return {
          FieldValue: {
            increment: vi.fn((value) => ({ increment: value })),
            serverTimestamp: vi.fn(() => ({ serverTimestamp: true })),
          },
          Timestamp: { now: vi.fn(() => mockNow) },
          getFirestore: () => mockDb,
        };
      }

      if (request === 'firebase-admin/storage') {
        return { getStorage: () => ({ bucket: vi.fn(() => ({})) }) };
      }

      if (request === 'firebase-functions') {
        return {
          logger: mockLogger,
          setGlobalOptions: vi.fn(),
        };
      }

      if (request === 'firebase-functions/v2/scheduler') {
        return { onSchedule: mockOnSchedule };
      }

      if (request === './post-retention-purge') {
        return { purgeExpiredPostRetention: mockPostPurge };
      }

      if (request === './event-retention-purge') {
        return { purgeExpiredEventRetention: mockEventPurge };
      }

      return originalLoad.call(this, request, parent, isMain);
    };
  });

  afterEach(() => {
    moduleLoader._load = originalLoad;
    delete requireFunctionModule.cache[indexPath];
  });

  it('registers a scheduled Firebase wrapper for event retention purge', () => {
    const functionsIndex = requireFunctionModule('../../../../../functions/index.js');

    expect(functionsIndex.purgeExpiredEventRetention.scheduleOptions).toEqual({
      schedule: 'every day 03:30',
      timeZone: 'Asia/Taipei',
    });
    expect(mockOnSchedule).toHaveBeenCalledWith(
      { schedule: 'every day 03:30', timeZone: 'Asia/Taipei' },
      expect.any(Function),
    );
  });

  it('delegates the scheduled event retention purge to the event purge core', async () => {
    const functionsIndex = requireFunctionModule('../../../../../functions/index.js');

    await functionsIndex.purgeExpiredEventRetention.handler();

    expect(mockEventPurge).toHaveBeenCalledWith({
      firestore: mockDb,
      logger: mockLogger,
      now: mockNow,
    });
    expect(mockLogger.info).toHaveBeenCalledWith('scheduled event retention purge finished', {
      counts: {
        events: 1,
        eventComments: 2,
        participants: 3,
        historyRecords: 4,
        skips: 5,
      },
    });
  });
});
