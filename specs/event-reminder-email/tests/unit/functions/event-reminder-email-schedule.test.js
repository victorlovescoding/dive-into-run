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

describe('scheduled event reminder email wrapper', () => {
  const originalLoad = moduleLoader._load;
  const mockDb = { kind: 'firestore' };
  const mockEmailClient = { kind: 'resend-email-client' };
  const mockLogger = { info: vi.fn(), warn: vi.fn() };
  const mockNowDate = new Date('2026-06-04T00:00:00.000Z');
  const mockNow = { toDate: vi.fn(() => mockNowDate) };
  const mockResendApiKey = { value: vi.fn(() => 're_test_secret') };
  const mockReminderEmailFrom = {
    value: vi.fn(() => 'Dive Into Run <no-reply@example.test>'),
  };
  const mockPublicAppBaseUrl = { value: vi.fn(() => 'https://app.example.test') };
  const mockDefineSecret = vi.fn((name) => {
    if (name === 'RESEND_API_KEY') return mockResendApiKey;
    throw new Error(`Unexpected secret: ${name}`);
  });
  const mockDefineString = vi.fn((name) => {
    if (name === 'REMINDER_EMAIL_FROM') return mockReminderEmailFrom;
    if (name === 'PUBLIC_APP_BASE_URL') return mockPublicAppBaseUrl;
    throw new Error(`Unexpected string param: ${name}`);
  });
  const mockSendEventReminderEmails = vi.fn(async () => ({
    processedEvents: 1,
    scannedEvents: 1,
    skippedEvents: 0,
  }));
  const mockCreateResendEmailClient = vi.fn(() => mockEmailClient);
  const mockPostPurge = vi.fn(async () => ({ posts: 0, comments: 0, likes: 0, skips: 0 }));
  const mockEventPurge = vi.fn(async () => ({
    events: 0,
    eventComments: 0,
    participants: 0,
    historyRecords: 0,
    skips: 0,
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
            delete: vi.fn(() => ({ delete: true })),
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

      if (request === 'firebase-functions/params') {
        return {
          defineSecret: mockDefineSecret,
          defineString: mockDefineString,
        };
      }

      if (request === './post-retention-purge') {
        return { purgeExpiredPostRetention: mockPostPurge };
      }

      if (request === './event-retention-purge') {
        return { purgeExpiredEventRetention: mockEventPurge };
      }

      if (request === './event-reminder-email') {
        return {
          createResendEmailClient: mockCreateResendEmailClient,
          sendEventReminderEmails: mockSendEventReminderEmails,
        };
      }

      return originalLoad.call(this, request, parent, isMain);
    };
  });

  afterEach(() => {
    moduleLoader._load = originalLoad;
    delete requireFunctionModule.cache[indexPath];
  });

  it('registers a scheduled Firebase wrapper with reminder config params', () => {
    const functionsIndex = requireFunctionModule('../../../../../functions/index.js');

    expect(mockDefineSecret).toHaveBeenCalledWith('RESEND_API_KEY');
    expect(mockDefineString).toHaveBeenCalledWith('REMINDER_EMAIL_FROM');
    expect(mockDefineString).toHaveBeenCalledWith('PUBLIC_APP_BASE_URL');
    expect(functionsIndex.sendEventReminderEmails.scheduleOptions).toEqual({
      schedule: 'every 15 minutes',
      secrets: [mockResendApiKey],
      timeZone: 'Asia/Taipei',
    });
    expect(mockOnSchedule).toHaveBeenCalledWith(
      {
        schedule: 'every 15 minutes',
        secrets: [mockResendApiKey],
        timeZone: 'Asia/Taipei',
      },
      expect.any(Function),
    );
    expect(mockResendApiKey.value).not.toHaveBeenCalled();
    expect(mockReminderEmailFrom.value).not.toHaveBeenCalled();
    expect(mockPublicAppBaseUrl.value).not.toHaveBeenCalled();
  });

  it('delegates the scheduled run to the reminder core with runtime config', async () => {
    const functionsIndex = requireFunctionModule('../../../../../functions/index.js');

    await functionsIndex.sendEventReminderEmails.handler();

    expect(mockResendApiKey.value).toHaveBeenCalledTimes(1);
    expect(mockReminderEmailFrom.value).toHaveBeenCalledTimes(1);
    expect(mockPublicAppBaseUrl.value).toHaveBeenCalledTimes(1);
    expect(mockCreateResendEmailClient).toHaveBeenCalledWith({ apiKey: 're_test_secret' });
    expect(mockSendEventReminderEmails).toHaveBeenCalledWith({
      config: {
        emailFrom: 'Dive Into Run <no-reply@example.test>',
        fromEmail: 'Dive Into Run <no-reply@example.test>',
        publicAppBaseUrl: 'https://app.example.test',
        resendApiKey: 're_test_secret',
      },
      emailClient: mockEmailClient,
      firestore: mockDb,
      logger: mockLogger,
      now: mockNow,
      runId: '2026-06-04T00:00:00.000Z',
    });
    expect(mockLogger.info).toHaveBeenCalledWith('scheduled event reminder email finished', {
      counts: {
        processedEvents: 1,
        scannedEvents: 1,
        skippedEvents: 0,
      },
      runId: '2026-06-04T00:00:00.000Z',
    });
  });
});
