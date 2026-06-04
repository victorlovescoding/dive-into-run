'use strict';

/* eslint-disable no-await-in-loop -- recipient delivery is sequenced to keep per-recipient logs deterministic. */

const REMINDER_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;
const REMINDER_WINDOW_BEFORE_MS = 30 * 60 * 1000;
const REMINDER_WINDOW_AFTER_MS = 45 * 60 * 1000;
const MAX_DELIVERY_ATTEMPTS = 3;
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const DESCRIPTION_LABEL = '\u6ce8\u610f\u4e8b\u9805';
const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const TERMINAL_DELIVERY_STATES = new Set(['sent', 'skipped', 'final_failed']);
const DEFAULT_LOGGER = Object.freeze({
  info: () => undefined,
  warn: () => undefined,
});

/**
 * Return a trimmed string value.
 * @param {unknown} value - Possible string value.
 * @returns {string} Trimmed string or blank.
 */
function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Check whether a Firestore-like snapshot exists.
 * @param {object | null | undefined} snapshot - Firestore document snapshot.
 * @returns {boolean} Whether the snapshot exists.
 */
function documentExists(snapshot) {
  if (!snapshot) {
    return false;
  }

  if (typeof snapshot.exists === 'function') {
    return snapshot.exists();
  }

  return snapshot.exists !== false;
}

/**
 * Return data from a Firestore-like snapshot.
 * @param {object | null | undefined} snapshot - Firestore document snapshot.
 * @returns {object} Snapshot data or blank object.
 */
function getSnapshotData(snapshot) {
  return documentExists(snapshot) && typeof snapshot?.data === 'function'
    ? snapshot.data() || {}
    : {};
}

/**
 * Read docs from a Firestore-like query.
 * @param {{ get: () => Promise<{ docs?: Array<object> }> }} query - Firestore query.
 * @returns {Promise<Array<object>>} Query docs.
 */
async function getQueryDocs(query) {
  const querySnapshot = await query.get();
  return Array.isArray(querySnapshot?.docs) ? querySnapshot.docs : [];
}

/**
 * Check whether a Date is usable.
 * @param {Date} date - Date candidate.
 * @returns {boolean} Whether the Date has a valid timestamp.
 */
function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Convert supported event time shapes into a Date.
 * @param {unknown} value - Event time value.
 * @returns {Date | null} Normalized Date or null when invalid.
 */
function normalizeEventTime(value) {
  if (value instanceof Date) {
    return isValidDate(value) ? new Date(value.getTime()) : null;
  }

  if (value && typeof value === 'object' && typeof value.toDate === 'function') {
    return normalizeEventTime(value.toDate());
  }

  if (value && typeof value === 'object' && typeof value.seconds === 'number') {
    const milliseconds =
      value.seconds * 1000 +
      Math.floor((typeof value.nanoseconds === 'number' ? value.nanoseconds : 0) / 1000000);
    return normalizeEventTime(new Date(milliseconds));
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return normalizeEventTime(new Date(value));
  }

  return null;
}

/**
 * Return an ISO string for a supported time value.
 * @param {unknown} value - Time value.
 * @returns {string | null} ISO timestamp or null.
 */
function toIsoString(value) {
  const date = normalizeEventTime(value);
  return date ? date.toISOString() : null;
}

/**
 * Build the rolling reminder scan window for a scheduler run.
 * @param {unknown} now - Scheduler run time.
 * @returns {{ start: Date, end: Date }} Reminder scan window.
 */
function getReminderWindow(now) {
  const nowDate = normalizeEventTime(now);
  if (!nowDate) {
    throw new Error('getReminderWindow: valid now is required');
  }

  const targetMs = nowDate.getTime() + REMINDER_LOOKAHEAD_MS;
  return {
    start: new Date(targetMs - REMINDER_WINDOW_BEFORE_MS),
    end: new Date(targetMs + REMINDER_WINDOW_AFTER_MS),
  };
}

/**
 * Add a trimmed non-blank UID to a set.
 * @param {Set<string>} uids - UID set.
 * @param {unknown} value - UID candidate.
 */
function addUid(uids, value) {
  const uid = trimString(value);
  if (uid) {
    uids.add(uid);
  }
}

/**
 * Read participant data from a Firestore-like snapshot or plain object.
 * @param {object | null | undefined} participantDoc - Participant document.
 * @returns {object} Participant data.
 */
function getParticipantData(participantDoc) {
  if (!participantDoc || typeof participantDoc !== 'object') {
    return {};
  }

  if (typeof participantDoc.data === 'function') {
    return participantDoc.data() || {};
  }

  return participantDoc.data && typeof participantDoc.data === 'object' ? participantDoc.data : {};
}

/**
 * Build a deduped send-time UID list from an event and participant documents.
 * @param {object | null | undefined} eventData - Event document data.
 * @param {Array<object>} participantDocs - Participant snapshots.
 * @returns {string[]} Recipient UIDs.
 */
function normalizeRecipientUids(eventData, participantDocs) {
  const recipientUids = new Set();
  addUid(recipientUids, eventData?.hostUid);

  (Array.isArray(participantDocs) ? participantDocs : []).forEach((participantDoc) => {
    addUid(recipientUids, participantDoc?.id);
    addUid(recipientUids, getParticipantData(participantDoc).uid);
  });

  return Array.from(recipientUids);
}

/**
 * Check whether an email is a conservative single-address value.
 * @param {unknown} email - Email candidate.
 * @returns {boolean} Whether the email is usable for delivery.
 */
function isUsableEmail(email) {
  if (typeof email !== 'string' || email.length === 0 || /\s/.test(email)) {
    return false;
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const [localPart, domain] = parts;
  const domainLabels = domain.split('.');
  return (
    localPart.length > 0 &&
    domain.length > 0 &&
    domainLabels.length > 1 &&
    domainLabels.every((label) => label.length > 0)
  );
}

/**
 * Return whether a delivery state is terminal.
 * @param {unknown} state - Delivery state.
 * @returns {boolean} Whether the state is terminal.
 */
function isTerminalDeliveryState(state) {
  return typeof state === 'string' && TERMINAL_DELIVERY_STATES.has(state);
}

/**
 * Return a normalized non-negative delivery attempt count.
 * @param {object} deliveryData - Delivery document data.
 * @returns {number} Attempt count.
 */
function getDeliveryAttempts(deliveryData) {
  return typeof deliveryData.attempts === 'number' && deliveryData.attempts > 0
    ? Math.floor(deliveryData.attempts)
    : 0;
}

/**
 * Check whether a delivery has a non-expired lease.
 * @param {object} deliveryData - Delivery document data.
 * @param {Date} nowDate - Current run time.
 * @returns {boolean} Whether a delivery lease is currently active.
 */
function hasActiveLease(deliveryData, nowDate) {
  const leaseOwner = trimString(deliveryData.leaseOwner);
  const leaseExpiresAt = normalizeEventTime(deliveryData.leaseExpiresAt);

  return (
    leaseOwner.length > 0 &&
    !!leaseExpiresAt &&
    leaseExpiresAt.getTime() > nowDate.getTime()
  );
}

/**
 * Check whether a delivery has an active lease owned by another run.
 * @param {object} deliveryData - Delivery document data.
 * @param {Date} nowDate - Current run time.
 * @param {string} runId - Current run ID.
 * @returns {boolean} Whether another run currently owns the delivery lease.
 */
function hasActiveForeignLease(deliveryData, nowDate, runId) {
  const leaseOwner = trimString(deliveryData.leaseOwner);
  return hasActiveLease(deliveryData, nowDate) && leaseOwner !== runId;
}

/**
 * Check whether the current delivery doc still matches a provider reservation.
 * @param {object} deliveryData - Delivery document data.
 * @param {{
 *   attempts: number,
 *   leaseExpiresAt?: Date | null,
 *   runId: string,
 * }} reservation - Provider reservation identity.
 * @returns {boolean} Whether the reservation still owns this delivery.
 */
function matchesProviderReservation(deliveryData, reservation) {
  const currentLeaseExpiresAt = normalizeEventTime(deliveryData.leaseExpiresAt);
  const expectedLeaseExpiresAt = normalizeEventTime(reservation.leaseExpiresAt);
  const leaseExpiryMatches =
    !expectedLeaseExpiresAt ||
    (!!currentLeaseExpiresAt &&
      currentLeaseExpiresAt.getTime() === expectedLeaseExpiresAt.getTime());

  return (
    deliveryData.state === 'failed' &&
    trimString(deliveryData.leaseOwner) === reservation.runId &&
    getDeliveryAttempts(deliveryData) === reservation.attempts &&
    leaseExpiryMatches
  );
}

/**
 * Return a safe provider error code for state and logs.
 * @param {unknown} error - Provider error.
 * @returns {string} Normalized provider error code.
 */
function getProviderErrorCode(error) {
  if (error && typeof error === 'object' && typeof error.code === 'string') {
    const code = trimString(error.code);
    if (/^(provider_error|resend_[0-9]{3}|resend_error:[0-9]{3})$/.test(code)) {
      return code;
    }
  }

  const message = error && typeof error === 'object' ? trimString(error.message) : '';
  if (message.startsWith('resend_error:')) {
    const [, status] = message.match(/^resend_error:([0-9]{3})/) || [];
    return status ? `resend_error:${status}` : 'resend_error';
  }

  return 'provider_error';
}

/**
 * Build the configured event detail URL.
 * @param {unknown} publicAppBaseUrl - Public application base URL.
 * @param {unknown} eventId - Event ID.
 * @returns {string} Event detail URL.
 */
function buildEventDetailUrl(publicAppBaseUrl, eventId) {
  const base = String(publicAppBaseUrl ?? '').replace(/\/+$/, '');
  return `${base}/events/${encodeURIComponent(String(eventId ?? ''))}`;
}

/**
 * Escape text for HTML email content.
 * @param {string} value - Text value.
 * @returns {string} Escaped text.
 */
function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/=/g, '&#61;');
}

/**
 * Convert plain text line breaks into HTML breaks.
 * @param {string} value - Text value.
 * @returns {string} HTML-safe text with line breaks.
 */
function escapeHtmlWithBreaks(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

/**
 * Build a stable event display label.
 * @param {object} eventData - Event document data.
 * @param {unknown} eventId - Event ID.
 * @returns {string} Event label.
 */
function getEventLabel(eventData, eventId) {
  return trimString(eventData.title) || trimString(eventData.location) || String(eventId ?? '');
}

/**
 * Build a stable location display line.
 * @param {object} eventData - Event document data.
 * @returns {string} Event location.
 */
function getEventLocation(eventData) {
  return [eventData.city, eventData.district, eventData.meetPlace]
    .map(trimString)
    .filter(Boolean)
    .join(' ');
}

/**
 * Build reminder email subject and bodies for an event.
 * @param {{
 *   eventId: unknown,
 *   eventData?: object,
 *   publicAppBaseUrl: unknown,
 * }} options - Email input.
 * @returns {{ subject: string, text: string, html: string }} Email content.
 */
function buildReminderEmail(options) {
  const { eventId, eventData = {}, publicAppBaseUrl } = options || {};
  const eventTime = normalizeEventTime(eventData.time);
  const eventTimeText = eventTime ? eventTime.toISOString() : 'TBD';
  const eventLabel = getEventLabel(eventData, eventId);
  const location = getEventLocation(eventData) || 'TBD';
  const description = trimString(eventData.description);
  const detailUrl = buildEventDetailUrl(publicAppBaseUrl, eventId);
  const subject = `Dive Into Run event reminder: ${eventLabel}`;
  const textLines = [
    'Dive Into Run event reminder',
    `Event: ${eventLabel}`,
    `Start time: ${eventTimeText}`,
    `Location: ${location}`,
  ];

  if (description) {
    textLines.push(`${DESCRIPTION_LABEL}: ${description}`);
  }

  textLines.push(`Details: ${detailUrl}`);

  const descriptionHtml = description
    ? `<p><strong>${DESCRIPTION_LABEL}</strong><br>${escapeHtmlWithBreaks(description)}</p>`
    : '';
  const html = [
    '<!doctype html>',
    '<html>',
    '<body>',
    '<p>Dive Into Run event reminder</p>',
    '<ul>',
    `<li><strong>Event</strong>: ${escapeHtml(eventLabel)}</li>`,
    `<li><strong>Start time</strong>: ${escapeHtml(eventTimeText)}</li>`,
    `<li><strong>Location</strong>: ${escapeHtml(location)}</li>`,
    '</ul>',
    descriptionHtml,
    `<p><a href="${escapeHtml(detailUrl)}">View event details</a></p>`,
    '</body>',
    '</html>',
  ].join('');

  return {
    subject,
    text: textLines.join('\n'),
    html,
  };
}

/**
 * Create a minimal Resend HTTP email client.
 * @param {{
 *   apiKey: string,
 *   fetchImpl?: (url: string, options: object) => Promise<{
 *     json?: () => Promise<object>,
 *     ok: boolean,
 *     status: number,
 *   }>,
 * }} options - Resend adapter dependencies.
 * @returns {{ sendEmail: (message: object) => Promise<{ id: string }> }} Email client.
 */
function createResendEmailClient(options) {
  const { apiKey, fetchImpl = fetch } = options || {};
  const trimmedApiKey = trimString(apiKey);

  if (!trimmedApiKey) {
    throw new Error('createResendEmailClient: apiKey is required');
  }

  if (typeof fetchImpl !== 'function') {
    throw new Error('createResendEmailClient: fetchImpl is required');
  }

  return {
    async sendEmail(message) {
      const response = await fetchImpl(RESEND_EMAILS_URL, {
        body: JSON.stringify(message),
        headers: {
          Authorization: `Bearer ${trimmedApiKey}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });
      const payload =
        response && typeof response.json === 'function'
          ? await response.json().catch(() => ({}))
          : {};

      if (!response.ok) {
        throw new Error(`resend_error:${response.status}`);
      }

      return { id: trimString(payload.id) };
    },
  };
}

/**
 * Return the top-level reminder state document ref for an event.
 * @param {object} firestore - Firestore adapter.
 * @param {string} eventId - Event ID.
 * @returns {object} Reminder state document ref.
 */
function getReminderStateRef(firestore, eventId) {
  return firestore.collection('eventReminderStates').doc(eventId);
}

/**
 * Return the per-recipient delivery document ref for an event.
 * @param {object} firestore - Firestore adapter.
 * @param {string} eventId - Event ID.
 * @param {string} uid - Recipient UID.
 * @returns {object} Delivery document ref.
 */
function getDeliveryRef(firestore, eventId, uid) {
  return getReminderStateRef(firestore, eventId).collection('deliveries').doc(uid);
}

/**
 * Read an event's participant document snapshots.
 * @param {object} eventDoc - Event document snapshot.
 * @returns {Promise<Array<object>>} Participant docs.
 */
async function readParticipantDocs(eventDoc) {
  const participantsQuery = eventDoc?.ref?.collection?.('participants');
  return participantsQuery ? getQueryDocs(participantsQuery) : [];
}

/**
 * Resolve a recipient's current email eligibility from users/{uid}.
 * @param {object} firestore - Firestore adapter.
 * @param {string} uid - Recipient UID.
 * @returns {Promise<object>} Resolution result.
 */
async function resolveRecipientEmail(firestore, uid) {
  const userSnapshot = await firestore.collection('users').doc(uid).get();

  if (!documentExists(userSnapshot)) {
    return { action: 'skip', reason: 'missing_user' };
  }

  const email = trimString(getSnapshotData(userSnapshot).email);
  if (!email) {
    return { action: 'skip', reason: 'missing_email' };
  }

  if (!isUsableEmail(email)) {
    return { action: 'skip', reason: 'invalid_email' };
  }

  return { action: 'send', email };
}

/**
 * Log an info message when the logger supports it.
 * @param {object} logger - Structured logger.
 * @param {string} message - Log message.
 * @param {object} data - Log payload.
 */
function logInfo(logger, message, data) {
  if (typeof logger?.info === 'function') {
    logger.info(message, data);
  }
}

/**
 * Mark a recipient skipped without overwriting terminal delivery states.
 * @param {{
 *   firestore: object,
 *   eventId: string,
 *   nowDate: Date,
 *   reason: string,
 *   runId: string,
 *   uid: string,
 * }} options - Skip transition input.
 * @returns {Promise<{ action: 'skipped' | 'terminal' | 'leased', attempts: number, state: string }>}
 * Transition result.
 */
async function markSkippedDelivery(options) {
  const { firestore, eventId, nowDate, reason, runId, uid } = options;
  const deliveryRef = getDeliveryRef(firestore, eventId, uid);

  return firestore.runTransaction(async (transaction) => {
    const deliverySnapshot = await transaction.get(deliveryRef);
    const deliveryData = getSnapshotData(deliverySnapshot);
    const existingState = deliveryData.state;
    const attempts = getDeliveryAttempts(deliveryData);

    if (isTerminalDeliveryState(existingState)) {
      return { action: 'terminal', attempts, state: existingState };
    }

    if (hasActiveForeignLease(deliveryData, nowDate, runId)) {
      return { action: 'leased', attempts, state: existingState || 'failed' };
    }

    transaction.set(
      deliveryRef,
      {
        attempts,
        eventId,
        lastRunId: runId,
        leaseExpiresAt: null,
        leaseOwner: null,
        reason,
        skippedAt: nowDate,
        state: 'skipped',
        uid,
        updatedAt: nowDate,
      },
      { merge: true },
    );

    return { action: 'skipped', attempts, state: 'skipped' };
  });
}

/**
 * Reserve a provider delivery attempt in a transaction.
 * @param {{
 *   firestore: object,
 *   eventId: string,
 *   nowDate: Date,
 *   runId: string,
 *   uid: string,
 * }} options - Reservation input.
 * @returns {Promise<{
 *   action: 'send' | 'terminal' | 'leased' | 'final_failed',
 *   attempts: number,
 *   leaseExpiresAt?: Date,
 *   reason?: string,
 *   state: string,
 * }>} Reservation decision.
 */
async function reserveDeliveryAttempt(options) {
  const { firestore, eventId, nowDate, runId, uid } = options;
  const deliveryRef = getDeliveryRef(firestore, eventId, uid);
  const leaseExpiresAt = new Date(nowDate.getTime() + DELIVERY_LEASE_MS);

  return firestore.runTransaction(async (transaction) => {
    const deliverySnapshot = await transaction.get(deliveryRef);
    const deliveryData = getSnapshotData(deliverySnapshot);
    const existingState = deliveryData.state;
    const attempts = getDeliveryAttempts(deliveryData);

    if (isTerminalDeliveryState(existingState)) {
      return { action: 'terminal', attempts, state: existingState };
    }

    if (hasActiveForeignLease(deliveryData, nowDate, runId)) {
      return { action: 'leased', attempts, reason: 'leased', state: 'failed' };
    }

    if (existingState === 'failed' && attempts >= MAX_DELIVERY_ATTEMPTS) {
      transaction.set(
        deliveryRef,
        {
          eventId,
          finalFailedAt: nowDate,
          lastRunId: runId,
          reason: 'max_attempts',
          state: 'final_failed',
          uid,
          updatedAt: nowDate,
        },
        { merge: true },
      );

      return {
        action: 'final_failed',
        attempts,
        reason: 'max_attempts',
        state: 'final_failed',
      };
    }

    const nextAttempts = attempts + 1;
    transaction.set(
      deliveryRef,
      {
        attempts: nextAttempts,
        eventId,
        lastAttemptAt: nowDate,
        lastRunId: runId,
        leaseExpiresAt,
        leaseOwner: runId,
        state: 'failed',
        uid,
        updatedAt: nowDate,
      },
      { merge: true },
    );

    return {
      action: 'send',
      attempts: nextAttempts,
      leaseExpiresAt,
      state: 'failed',
    };
  });
}

/**
 * Mark a reserved delivery as sent.
 * @param {{
 *   attempts: number,
 *   firestore: object,
 *   eventId: string,
 *   nowDate: Date,
 *   providerMessageId?: string,
 *   runId: string,
 *   uid: string,
 * }} options - Sent transition input.
 * @returns {Promise<{ action: 'sent' | 'terminal' | 'stale_lease', attempts: number, state: string }>}
 * Sent transition result.
 */
async function markDeliverySent(options) {
  const {
    attempts,
    firestore,
    eventId,
    leaseExpiresAt = null,
    nowDate,
    providerMessageId = '',
    runId,
    uid,
  } = options;
  const deliveryRef = getDeliveryRef(firestore, eventId, uid);

  return firestore.runTransaction(async (transaction) => {
    const deliverySnapshot = await transaction.get(deliveryRef);
    const deliveryData = getSnapshotData(deliverySnapshot);
    const currentAttempts = getDeliveryAttempts(deliveryData);

    if (isTerminalDeliveryState(deliveryData.state)) {
      return { action: 'terminal', attempts: currentAttempts, state: deliveryData.state };
    }

    if (!matchesProviderReservation(deliveryData, { attempts, leaseExpiresAt, runId })) {
      return {
        action: 'stale_lease',
        attempts: currentAttempts,
        state: deliveryData.state || 'missing',
      };
    }

    transaction.set(
      deliveryRef,
      {
        attempts,
        eventId,
        lastRunId: runId,
        leaseExpiresAt: null,
        leaseOwner: null,
        providerMessageId,
        sentAt: nowDate,
        state: 'sent',
        uid,
        updatedAt: nowDate,
      },
      { merge: true },
    );

    return { action: 'sent', attempts, state: 'sent' };
  });
}

/**
 * Mark a reserved delivery as failed or final_failed after provider failure.
 * @param {{
 *   attempts: number,
 *   firestore: object,
 *   eventId: string,
 *   leaseExpiresAt?: Date,
 *   nowDate: Date,
 *   providerErrorCode: string,
 *   runId: string,
 *   uid: string,
 * }} options - Failure transition input.
 * @returns {Promise<{
 *   action: 'failed' | 'final_failed' | 'terminal' | 'stale_lease',
 *   attempts: number,
 *   state: string,
 * }>} Failure state.
 */
async function markDeliveryProviderFailure(options) {
  const {
    attempts,
    firestore,
    eventId,
    leaseExpiresAt = null,
    nowDate,
    providerErrorCode,
    runId,
    uid,
  } = options;
  const deliveryRef = getDeliveryRef(firestore, eventId, uid);

  return firestore.runTransaction(async (transaction) => {
    const deliverySnapshot = await transaction.get(deliveryRef);
    const deliveryData = getSnapshotData(deliverySnapshot);
    const currentAttempts = getDeliveryAttempts(deliveryData);

    if (isTerminalDeliveryState(deliveryData.state)) {
      return { action: 'terminal', attempts: currentAttempts, state: deliveryData.state };
    }

    if (!matchesProviderReservation(deliveryData, { attempts, leaseExpiresAt, runId })) {
      return {
        action: 'stale_lease',
        attempts: currentAttempts,
        state: deliveryData.state || 'missing',
      };
    }

    const isFinalFailure = attempts >= MAX_DELIVERY_ATTEMPTS;
    const state = isFinalFailure ? 'final_failed' : 'failed';

    transaction.set(
      deliveryRef,
      {
        attempts,
        eventId,
        lastFailureAt: nowDate,
        lastRunId: runId,
        leaseExpiresAt: isFinalFailure ? null : leaseExpiresAt,
        leaseOwner: isFinalFailure ? null : runId,
        providerErrorCode,
        reason: 'provider_error',
        state,
        uid,
        updatedAt: nowDate,
        ...(isFinalFailure ? { finalFailedAt: nowDate } : {}),
      },
      { merge: true },
    );

    return { action: state, attempts, state };
  });
}

/**
 * Build a provider message for one event reminder recipient.
 * @param {{
 *   config: object,
 *   email: string,
 *   eventData: object,
 *   eventId: string,
 * }} options - Provider message input.
 * @returns {{ from: string, html: string, subject: string, text: string, to: string }}
 * Resend message.
 */
function buildProviderMessage(options) {
  const { config, email, eventData, eventId } = options;
  const reminderEmail = buildReminderEmail({
    eventData,
    eventId,
    publicAppBaseUrl: config.publicAppBaseUrl,
  });

  return {
    from: trimString(config.emailFrom),
    html: reminderEmail.html,
    subject: reminderEmail.subject,
    text: reminderEmail.text,
    to: email,
  };
}

/**
 * Process one event reminder recipient.
 * @param {{
 *   config: object,
 *   emailClient: { sendEmail: (message: object) => Promise<{ id?: string }> },
 *   eventData: object,
 *   eventId: string,
 *   firestore: object,
 *   logger: object,
 *   nowDate: Date,
 *   runId: string,
 *   uid: string,
 * }} options - Recipient processing input.
 * @returns {Promise<void>} Resolves after the recipient decision is handled.
 */
async function processReminderRecipient(options) {
  const { config, emailClient, eventData, eventId, firestore, logger, nowDate, runId, uid } =
    options;
  const emailResolution = await resolveRecipientEmail(firestore, uid);

  if (emailResolution.action === 'skip') {
    const skipped = await markSkippedDelivery({
      firestore,
      eventId,
      nowDate,
      reason: emailResolution.reason,
      runId,
      uid,
    });
    if (skipped.action === 'skipped') {
      logInfo(logger, 'event reminder recipient skipped', {
        attempts: skipped.attempts,
        eventId,
        reason: emailResolution.reason,
        runId,
        state: skipped.state,
        uid,
      });
    } else {
      logInfo(logger, 'event reminder recipient skip deferred', {
        attempts: skipped.attempts,
        eventId,
        reason: skipped.action,
        runId,
        state: skipped.state,
        uid,
      });
    }
    return;
  }

  const reservation = await reserveDeliveryAttempt({ firestore, eventId, nowDate, runId, uid });
  if (reservation.action !== 'send') {
    logInfo(logger, 'event reminder recipient reserved skipped', {
      attempts: reservation.attempts,
      eventId,
      reason: reservation.reason || reservation.action,
      runId,
      state: reservation.state,
      uid,
    });
    return;
  }

  logInfo(logger, 'event reminder recipient send reserved', {
    attempts: reservation.attempts,
    eventId,
    reason: 'provider_send_reserved',
    runId,
    state: 'failed',
    uid,
  });

  try {
    const providerResult = await emailClient.sendEmail(
      buildProviderMessage({
        config,
        email: emailResolution.email,
        eventData,
        eventId,
      }),
    );
    const providerMessageId = trimString(providerResult?.id);
    const sent = await markDeliverySent({
      attempts: reservation.attempts,
      firestore,
      eventId,
      leaseExpiresAt: reservation.leaseExpiresAt,
      nowDate,
      providerMessageId,
      runId,
      uid,
    });
    if (sent.action === 'sent') {
      logInfo(logger, 'event reminder recipient sent', {
        attempts: sent.attempts,
        eventId,
        providerMessageId,
        runId,
        state: sent.state,
        uid,
      });
    } else {
      logInfo(logger, 'event reminder recipient completion skipped', {
        attempts: sent.attempts,
        eventId,
        reason: sent.action,
        runId,
        state: sent.state,
        uid,
      });
    }
  } catch (error) {
    const providerErrorCode = getProviderErrorCode(error);
    const failure = await markDeliveryProviderFailure({
      attempts: reservation.attempts,
      firestore,
      eventId,
      leaseExpiresAt: reservation.leaseExpiresAt,
      nowDate,
      providerErrorCode,
      runId,
      uid,
    });
    if (failure.action === 'failed' || failure.action === 'final_failed') {
      logInfo(logger, 'event reminder recipient failed', {
        attempts: failure.attempts,
        eventId,
        providerErrorCode,
        reason: 'provider_error',
        runId,
        state: failure.state,
        uid,
      });
    } else {
      logInfo(logger, 'event reminder recipient completion skipped', {
        attempts: failure.attempts,
        eventId,
        reason: failure.action,
        runId,
        state: failure.state,
        uid,
      });
    }
  }
}

/**
 * Count terminal delivery states for an event's send-time recipients.
 * @param {{
 *   firestore: object,
 *   eventId: string,
 *   nowDate: Date,
 *   recipientUids: string[],
 * }} options - Completion input.
 * @returns {Promise<{
 *   allTerminal: boolean,
 *   terminalCounts: { finalFailed: number, sent: number, skipped: number },
 * }>} Completion state.
 */
async function countTerminalDeliveries(options) {
  const { firestore, eventId, nowDate, recipientUids } = options;
  const deliverySnapshots = await Promise.all(
    recipientUids.map((uid) => getDeliveryRef(firestore, eventId, uid).get()),
  );
  const terminalCounts = { finalFailed: 0, sent: 0, skipped: 0 };
  let terminalTotal = 0;

  deliverySnapshots.forEach((deliverySnapshot) => {
    const deliveryData = getSnapshotData(deliverySnapshot);
    const { state } = deliveryData;

    if (hasActiveLease(deliveryData, nowDate)) {
      return;
    }

    if (state === 'sent') {
      terminalCounts.sent += 1;
      terminalTotal += 1;
    } else if (state === 'skipped') {
      terminalCounts.skipped += 1;
      terminalTotal += 1;
    } else if (state === 'final_failed') {
      terminalCounts.finalFailed += 1;
      terminalTotal += 1;
    }
  });

  return {
    allTerminal: terminalTotal === recipientUids.length,
    terminalCounts,
  };
}

/**
 * Update event-level reminder state after recipient processing.
 * @param {{
 *   eventData: object,
 *   eventId: string,
 *   firestore: object,
 *   nowDate: Date,
 *   recipientUids: string[],
 *   runId: string,
 * }} options - Event completion input.
 * @returns {Promise<{ state: 'complete' | 'pending', terminalCounts: object }>}
 * Event reminder state.
 */
async function updateEventReminderState(options) {
  const { eventData, eventId, firestore, nowDate, recipientUids, runId } = options;
  const { allTerminal, terminalCounts } = await countTerminalDeliveries({
    firestore,
    eventId,
    nowDate,
    recipientUids,
  });
  const state = allTerminal ? 'complete' : 'pending';

  await getReminderStateRef(firestore, eventId).set(
    {
      completedAt: allTerminal ? nowDate : null,
      eventId,
      eventTime: eventData.time ?? null,
      lastRunId: runId,
      recipientUids,
      state,
      terminalCounts,
      updatedAt: nowDate,
    },
    { merge: true },
  );

  return { state, terminalCounts };
}

/**
 * Process reminder delivery for events in the configured scan window.
 * @param {{
 *   config?: { emailFrom?: string, publicAppBaseUrl?: string },
 *   emailClient: { sendEmail: (message: object) => Promise<{ id?: string }> },
 *   firestore: object,
 *   logger?: { info?: (message: string, data?: object) => void },
 *   now?: unknown,
 *   runId?: string,
 * }} options - Reminder orchestration dependencies.
 * @returns {Promise<{ processedEvents: number, scannedEvents: number, skippedEvents: number }>}
 * Scan counts.
 */
async function sendEventReminderEmails(options) {
  const {
    config = {},
    emailClient,
    firestore,
    logger = DEFAULT_LOGGER,
    now = new Date(),
    runId,
  } = options || {};

  if (!firestore) {
    throw new Error('sendEventReminderEmails: firestore is required');
  }

  if (!emailClient || typeof emailClient.sendEmail !== 'function') {
    throw new Error('sendEventReminderEmails: emailClient is required');
  }

  const nowDate = normalizeEventTime(now);
  if (!nowDate) {
    throw new Error('sendEventReminderEmails: valid now is required');
  }

  const effectiveRunId = trimString(runId) || nowDate.toISOString();
  const window = getReminderWindow(nowDate);
  const eventsQuery = firestore
    .collection('events')
    .where('time', '>=', window.start)
    .where('time', '<', window.end);
  logInfo(logger, 'event reminder scan started', {
    runId: effectiveRunId,
    windowEnd: window.end.toISOString(),
    windowStart: window.start.toISOString(),
  });

  const eventDocs = await getQueryDocs(eventsQuery);
  let processedEvents = 0;
  let skippedEvents = 0;

  for (const eventDoc of eventDocs) {
    if (!documentExists(eventDoc)) {
      skippedEvents += 1;
      continue;
    }

    const eventId = trimString(eventDoc.id);
    const eventData = getSnapshotData(eventDoc);

    if (Object.prototype.hasOwnProperty.call(eventData, 'deletedAt')) {
      skippedEvents += 1;
      logInfo(logger, 'event reminder event skipped', {
        eventId,
        reason: 'deleted',
        runId: effectiveRunId,
      });
      continue;
    }

    const reminderStateSnapshot = await getReminderStateRef(firestore, eventId).get();
    if (getSnapshotData(reminderStateSnapshot).state === 'complete') {
      skippedEvents += 1;
      logInfo(logger, 'event reminder event skipped', {
        eventId,
        reason: 'complete',
        runId: effectiveRunId,
      });
      continue;
    }

    const participantDocs = await readParticipantDocs(eventDoc);
    const recipientUids = normalizeRecipientUids(eventData, participantDocs);
    processedEvents += 1;
    logInfo(logger, 'event reminder event processing', {
      eventId,
      recipientCount: recipientUids.length,
      runId: effectiveRunId,
      time: toIsoString(eventData.time),
    });

    for (const uid of recipientUids) {
      await processReminderRecipient({
        config,
        emailClient,
        eventData,
        eventId,
        firestore,
        logger,
        nowDate,
        runId: effectiveRunId,
        uid,
      });
    }

    const eventState = await updateEventReminderState({
      eventData,
      eventId,
      firestore,
      nowDate,
      recipientUids,
      runId: effectiveRunId,
    });
    logInfo(logger, 'event reminder event state updated', {
      eventId,
      recipientCount: recipientUids.length,
      runId: effectiveRunId,
      state: eventState.state,
      terminalCounts: eventState.terminalCounts,
    });
  }

  logInfo(logger, 'event reminder scan finished', {
    processedEvents,
    runId: effectiveRunId,
    scannedEvents: eventDocs.length,
    skippedEvents,
  });

  return {
    processedEvents,
    scannedEvents: eventDocs.length,
    skippedEvents,
  };
}

module.exports = {
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
};
