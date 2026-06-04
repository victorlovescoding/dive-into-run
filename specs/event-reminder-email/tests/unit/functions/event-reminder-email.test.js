import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

/* eslint-disable jsdoc/require-jsdoc, no-use-before-define -- local Firestore test doubles. */

const requireFunctionModule = createRequire(import.meta.url);
const {
  REMINDER_LOOKAHEAD_MS,
  REMINDER_WINDOW_BEFORE_MS,
  REMINDER_WINDOW_AFTER_MS,
  MAX_DELIVERY_ATTEMPTS,
  buildEventDetailUrl,
  buildReminderEmail,
  createResendEmailClient,
  getReminderWindow,
  isUsableEmail,
  normalizeEventTime,
  normalizeRecipientUids,
  sendEventReminderEmails,
} = requireFunctionModule('../../../../../functions/event-reminder-email.js');

function participantDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

function toComparableQueryValue(value) {
  const normalizedDate = normalizeEventTime(value);
  return normalizedDate ? normalizedDate.getTime() : value;
}

function compareQueryValues(left, comparator, right) {
  const comparableLeft = toComparableQueryValue(left);
  const comparableRight = toComparableQueryValue(right);

  if (comparator === '>=') {
    return comparableLeft >= comparableRight;
  }

  if (comparator === '<') {
    return comparableLeft < comparableRight;
  }

  throw new Error(`Unsupported comparator: ${comparator}`);
}

class FakeDocumentRef {
  constructor(firestore, path) {
    this.firestore = firestore;
    this.path = path;
    this.id = path.split('/').at(-1);
  }

  collection(name) {
    return new FakeCollectionRef(this.firestore, `${this.path}/${name}`);
  }

  async get() {
    return this.firestore.getSnapshot(this.path);
  }

  async set(data, options) {
    this.firestore.writeDoc(this.path, data, options);
  }
}

class FakeCollectionRef {
  constructor(firestore, path, whereCalls = []) {
    this.firestore = firestore;
    this.path = path;
    this.whereCalls = whereCalls;
  }

  doc(id) {
    return new FakeDocumentRef(this.firestore, `${this.path}/${id}`);
  }

  where(field, comparator, value) {
    return new FakeCollectionRef(this.firestore, this.path, [
      ...this.whereCalls,
      [field, comparator, value],
    ]);
  }

  async get() {
    this.firestore.queryLog.push({ path: this.path, whereCalls: this.whereCalls });
    return {
      docs: this.firestore.queryDocs(this.path, this.whereCalls),
    };
  }
}

class FakeFirestore {
  constructor() {
    this.records = new Map();
    this.queryLog = [];
    this.transactionCount = 0;
  }

  collection(name) {
    return new FakeCollectionRef(this, name);
  }

  async runTransaction(callback) {
    this.transactionCount += 1;
    return callback({
      get: (ref) => ref.get(),
      set: (ref, data, options) => {
        this.writeDoc(ref.path, data, options);
      },
    });
  }

  seedDoc(path, data, options = {}) {
    const { exists = true } = options;
    this.records.set(path, { data: { ...data }, exists });
  }

  readDoc(path) {
    const record = this.records.get(path);
    return record ? { ...record.data } : null;
  }

  writeDoc(path, data, options = {}) {
    const previousRecord = this.records.get(path);
    const previousData = previousRecord?.data ?? {};
    const nextData = options.merge ? { ...previousData, ...data } : { ...data };
    this.records.set(path, { data: nextData, exists: true });
  }

  getSnapshot(path) {
    const record = this.records.get(path) ?? { data: {}, exists: false };
    const ref = new FakeDocumentRef(this, path);

    return {
      id: ref.id,
      ref,
      get exists() {
        return record.exists;
      },
      data: () => (record.exists ? { ...record.data } : undefined),
    };
  }

  queryDocs(collectionPath, whereCalls) {
    const expectedDepth = collectionPath.split('/').length + 1;
    const collectionPrefix = `${collectionPath}/`;

    return Array.from(this.records.entries())
      .filter(([path, record]) => {
        if (!record.exists || !path.startsWith(collectionPrefix)) {
          return false;
        }

        return path.split('/').length === expectedDepth;
      })
      .filter(([, record]) =>
        whereCalls.every(([field, comparator, value]) =>
          compareQueryValues(record.data[field], comparator, value),
        ),
      )
      .map(([path]) => this.getSnapshot(path));
  }
}

function seedEvent(firestore, eventId, data, options = {}) {
  const { participants = [] } = options;
  firestore.seedDoc(`events/${eventId}`, data);
  participants.forEach(({ id, data: participantData }) => {
    firestore.seedDoc(`events/${eventId}/participants/${id}`, participantData);
  });
}

function createLogger() {
  const entries = [];
  return {
    entries,
    info: vi.fn((message, data) => {
      entries.push({ data, level: 'info', message });
    }),
    warn: vi.fn((message, data) => {
      entries.push({ data, level: 'warn', message });
    }),
  };
}

function createEmailClient(handler) {
  let acceptedCount = 0;
  return {
    sendEmail: vi.fn(async (message) => {
      if (handler) {
        return handler(message);
      }

      acceptedCount += 1;
      return { id: `message-${acceptedCount}` };
    }),
  };
}

function createDeliveryOptions(overrides = {}) {
  const now = new Date('2026-06-04T00:00:00.000Z');
  return {
    config: {
      emailFrom: 'Dive Into Run <no-reply@platform.example>',
      publicAppBaseUrl: 'https://app.example.com',
    },
    logger: createLogger(),
    now,
    runId: 'run-1',
    ...overrides,
  };
}

function reminderStateJson(firestore) {
  return JSON.stringify(
    Array.from(firestore.records.entries())
      .filter(([path]) => path.startsWith('eventReminderStates/'))
      .map(([path, record]) => ({ data: record.data, path })),
  );
}

describe('event reminder email core helpers', () => {
  it('builds the 75-minute reminder window around now plus 24 hours', () => {
    expect(REMINDER_LOOKAHEAD_MS).toBe(24 * 60 * 60 * 1000);
    expect(REMINDER_WINDOW_BEFORE_MS).toBe(30 * 60 * 1000);
    expect(REMINDER_WINDOW_AFTER_MS).toBe(45 * 60 * 1000);
    expect(MAX_DELIVERY_ATTEMPTS).toBe(3);

    const window = getReminderWindow(new Date('2026-06-04T00:00:00.000Z'));

    expect(window.start.toISOString()).toBe('2026-06-04T23:30:00.000Z');
    expect(window.end.toISOString()).toBe('2026-06-05T00:45:00.000Z');
    expect(window.end.getTime() - window.start.getTime()).toBe(75 * 60 * 1000);
  });

  it('normalizes event time from Firestore-like, Date, and string values', () => {
    const firestoreDateLike = {
      toDate: () => new Date('2026-06-05T00:30:00.000Z'),
    };
    const timestampLike = {
      nanoseconds: 123000000,
      seconds: 1780621200,
    };

    expect(normalizeEventTime(firestoreDateLike)?.toISOString()).toBe(
      '2026-06-05T00:30:00.000Z',
    );
    expect(normalizeEventTime(timestampLike)?.toISOString()).toBe('2026-06-05T01:00:00.123Z');
    expect(normalizeEventTime(new Date('2026-06-05T01:30:00.000Z'))?.toISOString()).toBe(
      '2026-06-05T01:30:00.000Z',
    );
    expect(normalizeEventTime('2026-06-05T02:30:00.000Z')?.toISOString()).toBe(
      '2026-06-05T02:30:00.000Z',
    );
    expect(normalizeEventTime('not-a-date')).toBeNull();
    expect(normalizeEventTime(null)).toBeNull();
  });

  it('builds recipient UIDs from host, participant doc IDs, and participant uid fields', () => {
    const recipientUids = normalizeRecipientUids(
      { hostUid: ' host-1 ' },
      [
        participantDoc('host-1', { uid: ' host-1 ' }),
        participantDoc(' runner-1 ', { uid: ' runner-2 ' }),
        participantDoc('   ', { uid: '   ' }),
      ],
    );

    expect(recipientUids).toEqual(['host-1', 'runner-1', 'runner-2']);
  });

  it('conservatively accepts only usable single-address emails', () => {
    expect(isUsableEmail('runner@example.com')).toBe(true);
    expect(isUsableEmail('runner+tag@sub.example.co')).toBe(true);

    [
      undefined,
      null,
      '',
      '   ',
      'runner example@example.com',
      'runner@',
      '@example.com',
      'runner@example',
      'runner@example.',
      'runner@.example.com',
      'runner@example..com',
      'runner@@example.com',
      'runner@example.com runner2@example.com',
    ].forEach((email) => {
      expect(isUsableEmail(email)).toBe(false);
    });
  });

  it('builds event detail URLs with a trimmed base URL and encoded event ID', () => {
    expect(buildEventDetailUrl('https://app.example.com///', 'event 1/part')).toBe(
      'https://app.example.com/events/event%201%2Fpart',
    );
  });

  it('builds reminder email content from existing event description and detail URL', () => {
    const eventData = {
      city: 'Taipei',
      description: 'Bring lights.',
      district: 'Da-an',
      meetPlace: 'Park gate',
      note: 'Do not use this note.',
      time: { toDate: () => new Date('2026-06-05T00:30:00.000Z') },
      title: 'Riverside 5K',
    };

    const email = buildReminderEmail({
      eventData,
      eventId: 'event 1',
      publicAppBaseUrl: 'https://app.example.com/',
    });
    const expectedUrl = 'https://app.example.com/events/event%201';
    const noteLabel = '\u6ce8\u610f\u4e8b\u9805';

    expect(email.subject).toContain('Dive Into Run');
    expect(email.subject).toContain('Riverside 5K');
    [email.text, email.html].forEach((body) => {
      expect(body).toContain('2026-06-05T00:30:00.000Z');
      expect(body).toContain('Taipei');
      expect(body).toContain('Da-an');
      expect(body).toContain('Park gate');
      expect(body).toContain(noteLabel);
      expect(body).toContain('Bring lights.');
      expect(body).toContain(expectedUrl);
      expect(body).not.toContain('Do not use this note.');
    });
  });

  it('escapes hostile event content in reminder HTML and safely encodes the detail URL', () => {
    const eventData = {
      city: 'Taipei<script>alert(1)</script>',
      description: '<img src=x onerror=alert(1)>Bring "lights" & water.',
      district: 'Da-an',
      location: 'Ignored <b>fallback</b>',
      meetPlace: 'Park gate" onclick="alert(2)',
      time: '2026-06-05T00:30:00.000Z',
      title: '<script>alert("title")</script>',
    };

    const email = buildReminderEmail({
      eventData,
      eventId: 'event"><img src=x onerror=alert(3)>',
      publicAppBaseUrl: 'https://app.example.com/',
    });

    expect(email.html).not.toContain('<script');
    expect(email.html).not.toContain('</script>');
    expect(email.html).not.toContain('<img');
    expect(email.html).not.toContain('onerror=');
    expect(email.html).not.toContain('onclick=');
    expect(email.html).not.toContain(`java${'script:'}`);
    expect(email.html).toContain('&lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt;');
    expect(email.html).toContain(
      '&lt;img src&#61;x onerror&#61;alert(1)&gt;Bring &quot;lights&quot; &amp; water.',
    );
    expect(email.html).toContain('Park gate&quot; onclick&#61;&quot;alert(2)');
    expect(email.html).toContain(
      'https://app.example.com/events/event%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(3)%3E',
    );
  });
});

describe('event reminder email delivery orchestration', () => {
  it('resolves host and participant recipients at send time and completes all-sent events', async () => {
    const firestore = new FakeFirestore();
    seedEvent(
      firestore,
      'event-1',
      {
        hostEmail: 'host-private@example.com',
        hostUid: 'host-1',
        meetPlace: 'Park gate',
        time: new Date('2026-06-05T00:00:00.000Z'),
      },
      {
        participants: [
          { id: 'host-1', data: { uid: 'host-1' } },
          { id: 'runner-1', data: { uid: 'runner-1' } },
        ],
      },
    );
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    firestore.seedDoc('users/runner-1', { email: 'runner@example.com' });
    const emailClient = createEmailClient();
    const options = createDeliveryOptions({ emailClient, firestore });

    await sendEventReminderEmails(options);

    const sentMessages = emailClient.sendEmail.mock.calls.map(([message]) => message);
    expect(sentMessages.map((message) => message.to).sort()).toEqual([
      'host@example.com',
      'runner@example.com',
    ]);
    sentMessages.forEach((message) => {
      expect(message.from).toBe(options.config.emailFrom);
      expect(message.from).not.toBe('host-private@example.com');
    });
    expect(firestore.queryLog.find((query) => query.path === 'events')?.whereCalls).toEqual([
      ['time', '>=', new Date('2026-06-04T23:30:00.000Z')],
      ['time', '<', new Date('2026-06-05T00:45:00.000Z')],
    ]);
    expect(firestore.readDoc('eventReminderStates/event-1')).toMatchObject({
      eventId: 'event-1',
      recipientUids: ['host-1', 'runner-1'],
      state: 'complete',
      terminalCounts: { finalFailed: 0, sent: 2, skipped: 0 },
    });
    expect(firestore.readDoc('eventReminderStates/event-1/deliveries/host-1')).toMatchObject({
      attempts: 1,
      providerMessageId: 'message-1',
      state: 'sent',
    });
    expect(firestore.readDoc('eventReminderStates/event-1/deliveries/runner-1')).toMatchObject({
      attempts: 1,
      providerMessageId: 'message-2',
      state: 'sent',
    });
    expect(reminderStateJson(firestore)).not.toContain('host@example.com');
    expect(reminderStateJson(firestore)).not.toContain('runner@example.com');
  });

  it('records skipped terminal state for missing user, missing email, and invalid email', async () => {
    const firestore = new FakeFirestore();
    seedEvent(
      firestore,
      'event-skips',
      {
        hostUid: 'missing-user',
        time: new Date('2026-06-05T00:00:00.000Z'),
      },
      {
        participants: [
          { id: 'missing-email', data: { uid: 'missing-email' } },
          { id: 'invalid-email', data: { uid: 'invalid-email' } },
        ],
      },
    );
    firestore.seedDoc('users/missing-email', { name: 'No Email' });
    firestore.seedDoc('users/invalid-email', { email: 'runner@example' });
    const emailClient = createEmailClient();

    await sendEventReminderEmails(createDeliveryOptions({ emailClient, firestore }));

    expect(emailClient.sendEmail).not.toHaveBeenCalled();
    expect(firestore.readDoc('eventReminderStates/event-skips/deliveries/missing-user')).toMatchObject({
      attempts: 0,
      reason: 'missing_user',
      state: 'skipped',
    });
    expect(firestore.readDoc('eventReminderStates/event-skips/deliveries/missing-email')).toMatchObject({
      attempts: 0,
      reason: 'missing_email',
      state: 'skipped',
    });
    expect(firestore.readDoc('eventReminderStates/event-skips/deliveries/invalid-email')).toMatchObject({
      attempts: 0,
      reason: 'invalid_email',
      state: 'skipped',
    });
    expect(firestore.readDoc('eventReminderStates/event-skips')).toMatchObject({
      state: 'complete',
      terminalCounts: { finalFailed: 0, sent: 0, skipped: 3 },
    });
  });

  it('does not resend recipients already marked sent', async () => {
    const firestore = new FakeFirestore();
    seedEvent(firestore, 'event-sent', {
      hostUid: 'host-1',
      time: new Date('2026-06-05T00:00:00.000Z'),
    });
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    firestore.seedDoc('eventReminderStates/event-sent/deliveries/host-1', {
      attempts: 1,
      eventId: 'event-sent',
      providerMessageId: 'old-message',
      state: 'sent',
      uid: 'host-1',
    });
    const emailClient = createEmailClient();

    await sendEventReminderEmails(createDeliveryOptions({ emailClient, firestore }));

    expect(emailClient.sendEmail).not.toHaveBeenCalled();
    expect(firestore.readDoc('eventReminderStates/event-sent/deliveries/host-1')).toMatchObject({
      attempts: 1,
      providerMessageId: 'old-message',
      state: 'sent',
    });
  });

  it('retries failed recipients while attempts are below the max', async () => {
    const firestore = new FakeFirestore();
    seedEvent(firestore, 'event-retry', {
      hostUid: 'host-1',
      time: new Date('2026-06-05T00:00:00.000Z'),
    });
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    firestore.seedDoc('eventReminderStates/event-retry/deliveries/host-1', {
      attempts: 1,
      eventId: 'event-retry',
      leaseExpiresAt: new Date('2026-06-03T23:59:00.000Z'),
      leaseOwner: 'old-run',
      state: 'failed',
      uid: 'host-1',
    });
    const emailClient = createEmailClient(() => ({ id: 'retry-message' }));

    await sendEventReminderEmails(createDeliveryOptions({ emailClient, firestore }));

    expect(emailClient.sendEmail).toHaveBeenCalledTimes(1);
    expect(firestore.readDoc('eventReminderStates/event-retry/deliveries/host-1')).toMatchObject({
      attempts: 2,
      providerMessageId: 'retry-message',
      state: 'sent',
    });
  });

  it('records final_failed when the third provider attempt fails', async () => {
    const firestore = new FakeFirestore();
    seedEvent(firestore, 'event-final-failed', {
      hostUid: 'host-1',
      time: new Date('2026-06-05T00:00:00.000Z'),
    });
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    firestore.seedDoc('eventReminderStates/event-final-failed/deliveries/host-1', {
      attempts: 2,
      eventId: 'event-final-failed',
      leaseExpiresAt: new Date('2026-06-03T23:59:00.000Z'),
      leaseOwner: 'old-run',
      state: 'failed',
      uid: 'host-1',
    });
    const emailClient = createEmailClient(() => {
      throw Object.assign(new Error('provider down'), { code: 'resend_500' });
    });

    await sendEventReminderEmails(createDeliveryOptions({ emailClient, firestore }));

    expect(emailClient.sendEmail).toHaveBeenCalledTimes(1);
    expect(firestore.readDoc('eventReminderStates/event-final-failed/deliveries/host-1')).toMatchObject({
      attempts: 3,
      providerErrorCode: 'resend_500',
      reason: 'provider_error',
      state: 'final_failed',
    });
    expect(firestore.readDoc('eventReminderStates/event-final-failed')).toMatchObject({
      state: 'complete',
      terminalCounts: { finalFailed: 1, sent: 0, skipped: 0 },
    });
  });

  it('stores and logs only coarse provider codes when Resend failed payloads contain email text', async () => {
    const firestore = new FakeFirestore();
    seedEvent(firestore, 'event-resend-leak', {
      hostUid: 'host-1',
      time: new Date('2026-06-05T00:00:00.000Z'),
    });
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    const fetchImpl = vi.fn(async () => ({
      json: async () => ({
        name: 'secret-leak@private-domain.invalid rejected for host-contact@owner-domain.invalid',
      }),
      ok: false,
      status: 422,
    }));
    const emailClient = createResendEmailClient({ apiKey: 'resend-test-key', fetchImpl });
    const logger = createLogger();

    await sendEventReminderEmails(createDeliveryOptions({ emailClient, firestore, logger }));

    expect(firestore.readDoc('eventReminderStates/event-resend-leak/deliveries/host-1')).toMatchObject({
      attempts: 1,
      providerErrorCode: 'resend_error:422',
      reason: 'provider_error',
      state: 'failed',
    });
    const statePayload = reminderStateJson(firestore);
    const logPayload = JSON.stringify(logger.entries);
    [statePayload, logPayload].forEach((payload) => {
      expect(payload).not.toContain('secret-leak@private-domain.invalid');
      expect(payload).not.toContain('host-contact@owner-domain.invalid');
      expect(payload).not.toContain('secret-leak');
      expect(payload).not.toContain('private-domain');
      expect(payload).not.toContain('host-contact');
      expect(payload).not.toContain('owner-domain');
    });
  });

  it('keeps final_failed provider codes coarse when Resend failed payloads contain email text', async () => {
    const firestore = new FakeFirestore();
    seedEvent(firestore, 'event-final-provider-error', {
      hostUid: 'host-1',
      time: new Date('2026-06-05T00:00:00.000Z'),
    });
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    firestore.seedDoc('eventReminderStates/event-final-provider-error/deliveries/host-1', {
      attempts: 2,
      eventId: 'event-final-provider-error',
      leaseExpiresAt: new Date('2026-06-03T23:59:00.000Z'),
      leaseOwner: 'old-run',
      state: 'failed',
      uid: 'host-1',
    });
    const fetchImpl = vi.fn(async () => ({
      json: async () => ({
        error: 'delivery failed for final-leak@private-domain.invalid',
      }),
      ok: false,
      status: 500,
    }));
    const emailClient = createResendEmailClient({ apiKey: 'resend-test-key', fetchImpl });
    const logger = createLogger();

    await sendEventReminderEmails(createDeliveryOptions({ emailClient, firestore, logger }));

    expect(
      firestore.readDoc('eventReminderStates/event-final-provider-error/deliveries/host-1'),
    ).toMatchObject({
      attempts: 3,
      providerErrorCode: 'resend_error:500',
      reason: 'provider_error',
      state: 'final_failed',
    });
    const statePayload = reminderStateJson(firestore);
    const logPayload = JSON.stringify(logger.entries);
    [statePayload, logPayload].forEach((payload) => {
      expect(payload).not.toContain('final-leak@private-domain.invalid');
      expect(payload).not.toContain('final-leak');
      expect(payload).not.toContain('private-domain');
    });
  });

  it('continues independent recipients after one provider failure and keeps the event pending', async () => {
    const firestore = new FakeFirestore();
    seedEvent(
      firestore,
      'event-partial',
      {
        hostUid: 'host-1',
        time: new Date('2026-06-05T00:00:00.000Z'),
      },
      {
        participants: [{ id: 'runner-1', data: { uid: 'runner-1' } }],
      },
    );
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    firestore.seedDoc('users/runner-1', { email: 'runner@example.com' });
    const emailClient = createEmailClient((message) => {
      if (message.to === 'host@example.com') {
        throw Object.assign(new Error('provider down'), { code: 'resend_503' });
      }

      return { id: 'runner-message' };
    });

    await sendEventReminderEmails(createDeliveryOptions({ emailClient, firestore }));

    expect(emailClient.sendEmail).toHaveBeenCalledTimes(2);
    expect(firestore.readDoc('eventReminderStates/event-partial/deliveries/host-1')).toMatchObject({
      attempts: 1,
      providerErrorCode: 'resend_503',
      state: 'failed',
    });
    expect(firestore.readDoc('eventReminderStates/event-partial/deliveries/runner-1')).toMatchObject({
      attempts: 1,
      providerMessageId: 'runner-message',
      state: 'sent',
    });
    expect(firestore.readDoc('eventReminderStates/event-partial')).toMatchObject({
      state: 'pending',
      terminalCounts: { finalFailed: 0, sent: 1, skipped: 0 },
    });
  });

  it('does not reserve failed deliveries leased by another run', async () => {
    const firestore = new FakeFirestore();
    seedEvent(firestore, 'event-leased', {
      hostUid: 'host-1',
      time: new Date('2026-06-05T00:00:00.000Z'),
    });
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    firestore.seedDoc('eventReminderStates/event-leased/deliveries/host-1', {
      attempts: 1,
      eventId: 'event-leased',
      leaseExpiresAt: new Date('2026-06-04T00:05:00.000Z'),
      leaseOwner: 'other-run',
      state: 'failed',
      uid: 'host-1',
    });
    const emailClient = createEmailClient();

    await sendEventReminderEmails(createDeliveryOptions({ emailClient, firestore, runId: 'run-2' }));

    expect(emailClient.sendEmail).not.toHaveBeenCalled();
    expect(firestore.readDoc('eventReminderStates/event-leased/deliveries/host-1')).toMatchObject({
      attempts: 1,
      leaseOwner: 'other-run',
      state: 'failed',
    });
    expect(firestore.readDoc('eventReminderStates/event-leased')).toMatchObject({
      state: 'pending',
    });
  });

  it('does not let late provider failure from a stale lease overwrite newer sent state', async () => {
    const firestore = new FakeFirestore();
    seedEvent(firestore, 'event-stale-failure', {
      hostUid: 'host-1',
      time: new Date('2026-06-05T00:00:00.000Z'),
    });
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    const staleEmailClient = createEmailClient(() => {
      firestore.writeDoc(
        'eventReminderStates/event-stale-failure/deliveries/host-1',
        {
          attempts: 2,
          eventId: 'event-stale-failure',
          leaseExpiresAt: null,
          leaseOwner: null,
          providerMessageId: 'newer-message',
          sentAt: new Date('2026-06-04T00:05:30.000Z'),
          state: 'sent',
          uid: 'host-1',
          updatedAt: new Date('2026-06-04T00:05:30.000Z'),
        },
        { merge: true },
      );
      throw Object.assign(new Error('late provider failure'), { code: 'resend_503' });
    });

    await sendEventReminderEmails(
      createDeliveryOptions({ emailClient: staleEmailClient, firestore, runId: 'run-A' }),
    );

    expect(firestore.readDoc('eventReminderStates/event-stale-failure/deliveries/host-1')).toMatchObject({
      attempts: 2,
      providerMessageId: 'newer-message',
      state: 'sent',
    });
    expect(firestore.readDoc('eventReminderStates/event-stale-failure')).toMatchObject({
      state: 'complete',
      terminalCounts: { finalFailed: 0, sent: 1, skipped: 0 },
    });

    const nextEmailClient = createEmailClient();
    await sendEventReminderEmails(
      createDeliveryOptions({
        emailClient: nextEmailClient,
        firestore,
        now: new Date('2026-06-04T00:06:00.000Z'),
        runId: 'run-C',
      }),
    );

    expect(nextEmailClient.sendEmail).not.toHaveBeenCalled();
    expect(firestore.readDoc('eventReminderStates/event-stale-failure/deliveries/host-1')).toMatchObject({
      attempts: 2,
      providerMessageId: 'newer-message',
      state: 'sent',
    });
  });

  it('does not let late provider success from a stale lease overwrite newer final state', async () => {
    const firestore = new FakeFirestore();
    seedEvent(firestore, 'event-stale-success', {
      hostUid: 'host-1',
      time: new Date('2026-06-05T00:00:00.000Z'),
    });
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    const staleEmailClient = createEmailClient(() => {
      firestore.writeDoc(
        'eventReminderStates/event-stale-success/deliveries/host-1',
        {
          attempts: 3,
          eventId: 'event-stale-success',
          finalFailedAt: new Date('2026-06-04T00:05:30.000Z'),
          leaseExpiresAt: null,
          leaseOwner: null,
          providerErrorCode: 'resend_500',
          reason: 'provider_error',
          state: 'final_failed',
          uid: 'host-1',
          updatedAt: new Date('2026-06-04T00:05:30.000Z'),
        },
        { merge: true },
      );
      return { id: 'late-success-message' };
    });

    await sendEventReminderEmails(
      createDeliveryOptions({ emailClient: staleEmailClient, firestore, runId: 'run-A' }),
    );

    expect(firestore.readDoc('eventReminderStates/event-stale-success/deliveries/host-1')).toMatchObject({
      attempts: 3,
      providerErrorCode: 'resend_500',
      state: 'final_failed',
    });
    expect(firestore.readDoc('eventReminderStates/event-stale-success/deliveries/host-1')).not.toMatchObject({
      providerMessageId: 'late-success-message',
      state: 'sent',
    });
    expect(firestore.readDoc('eventReminderStates/event-stale-success')).toMatchObject({
      state: 'complete',
      terminalCounts: { finalFailed: 1, sent: 0, skipped: 0 },
    });
  });

  it('does not let missing or invalid email skips overwrite active foreign leases or complete the event', async () => {
    const firestore = new FakeFirestore();
    seedEvent(
      firestore,
      'event-skip-lease',
      {
        hostUid: 'host-1',
        time: new Date('2026-06-05T00:00:00.000Z'),
      },
      {
        participants: [{ id: 'runner-1', data: { uid: 'runner-1' } }],
      },
    );
    firestore.seedDoc('users/host-1', { name: 'No Email' });
    firestore.seedDoc('users/runner-1', { email: 'runner@example' });
    firestore.seedDoc('eventReminderStates/event-skip-lease/deliveries/host-1', {
      attempts: 1,
      eventId: 'event-skip-lease',
      lastAttemptAt: new Date('2026-06-04T00:00:00.000Z'),
      leaseExpiresAt: new Date('2026-06-04T00:05:00.000Z'),
      leaseOwner: 'sending-run',
      state: 'failed',
      uid: 'host-1',
    });
    firestore.seedDoc('eventReminderStates/event-skip-lease/deliveries/runner-1', {
      attempts: 1,
      eventId: 'event-skip-lease',
      lastAttemptAt: new Date('2026-06-04T00:00:00.000Z'),
      leaseExpiresAt: new Date('2026-06-04T00:05:00.000Z'),
      leaseOwner: 'sending-run',
      state: 'failed',
      uid: 'runner-1',
    });
    const emailClient = createEmailClient();

    await sendEventReminderEmails(
      createDeliveryOptions({ emailClient, firestore, runId: 'skip-run' }),
    );

    expect(emailClient.sendEmail).not.toHaveBeenCalled();
    expect(firestore.readDoc('eventReminderStates/event-skip-lease/deliveries/host-1')).toMatchObject({
      attempts: 1,
      leaseOwner: 'sending-run',
      state: 'failed',
    });
    expect(firestore.readDoc('eventReminderStates/event-skip-lease/deliveries/runner-1')).toMatchObject({
      attempts: 1,
      leaseOwner: 'sending-run',
      state: 'failed',
    });
    expect(firestore.readDoc('eventReminderStates/event-skip-lease')).toMatchObject({
      state: 'pending',
      terminalCounts: { finalFailed: 0, sent: 0, skipped: 0 },
    });
  });

  it('writes structured logs without recipient emails or message content', async () => {
    const firestore = new FakeFirestore();
    seedEvent(firestore, 'event-logs', {
      description: 'Do not log this reminder body.',
      hostUid: 'host-1',
      time: new Date('2026-06-05T00:00:00.000Z'),
    });
    firestore.seedDoc('users/host-1', { email: 'host@example.com' });
    const emailClient = createEmailClient(() => ({ id: 'log-message' }));
    const logger = createLogger();

    await sendEventReminderEmails(createDeliveryOptions({ emailClient, firestore, logger }));

    expect(logger.info).toHaveBeenCalledWith(
      'event reminder scan started',
      expect.objectContaining({
        runId: 'run-1',
        windowEnd: '2026-06-05T00:45:00.000Z',
        windowStart: '2026-06-04T23:30:00.000Z',
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      'event reminder recipient sent',
      expect.objectContaining({
        attempts: 1,
        eventId: 'event-logs',
        providerMessageId: 'log-message',
        state: 'sent',
        uid: 'host-1',
      }),
    );
    const logPayload = JSON.stringify(logger.entries);
    expect(logPayload).not.toContain('host@example.com');
    expect(logPayload).not.toContain('no-reply@platform.example');
    expect(logPayload).not.toContain('Do not log this reminder body.');
  });

  it('sends Resend email requests through the HTTP adapter', async () => {
    const fetchImpl = vi.fn(async () => ({
      json: async () => ({ id: 'resend-message' }),
      ok: true,
      status: 200,
    }));
    const message = {
      from: 'Dive Into Run <no-reply@platform.example>',
      html: '<p>Hello</p>',
      subject: 'Reminder',
      text: 'Hello',
      to: 'runner@example.com',
    };

    const client = createResendEmailClient({ apiKey: 'resend-test-key', fetchImpl });
    const result = await client.sendEmail(message);

    expect(result).toEqual({ id: 'resend-message' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.resend.com/emails', {
      body: JSON.stringify(message),
      headers: {
        Authorization: 'Bearer resend-test-key',
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  });
});
