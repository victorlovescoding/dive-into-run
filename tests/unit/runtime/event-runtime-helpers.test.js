import { describe, expect, it } from 'vitest';
import * as eventRuntimeHelpers from '@/runtime/events/event-runtime-helpers';
import {
  evaluateEventEditStartedLock,
  isEventStarted,
} from '@/runtime/events/event-runtime-helpers';

const startIso = '2026-07-01T10:00:00.000Z';
const beforeStart = new Date('2026-07-01T09:59:59.999Z');
const exactStart = new Date(startIso);
const afterStart = new Date('2026-07-01T10:00:00.001Z');

/**
 * 建立 runtime helper 可接受的活動 fixture。
 * @param {string | { toDate: () => Date }} time - 活動開始時間。
 * @returns {{ time: string | { toDate: () => Date } }} 活動 fixture。
 */
function eventWithTime(time) {
  return { time };
}

/**
 * 建立 Firestore Timestamp-like fixture，不依賴 Firebase SDK。
 * @param {string} iso - ISO timestamp 字串。
 * @returns {{ toDate: () => Date }} Timestamp-like fixture。
 */
function timestampLike(iso) {
  return {
    toDate: () => new Date(iso),
  };
}

describe('isEventStarted', () => {
  it('treats client now before event.time as not started', () => {
    expect(isEventStarted(eventWithTime(startIso), beforeStart)).toBe(false);
  });

  it('treats client now equal to event.time as started', () => {
    expect(isEventStarted(eventWithTime(startIso), exactStart)).toBe(true);
  });

  it('treats client now after event.time as started', () => {
    expect(isEventStarted(eventWithTime(startIso), afterStart)).toBe(true);
  });

  it('supports Firestore Timestamp-like event.time values', () => {
    expect(isEventStarted(eventWithTime(timestampLike(startIso)), exactStart)).toBe(true);
  });

  it('returns false for missing or invalid event time values', () => {
    expect(isEventStarted(null, exactStart)).toBe(false);
    expect(isEventStarted(eventWithTime('not-a-date'), exactStart)).toBe(false);
  });
});

describe('evaluateEventEditStartedLock', () => {
  it('allows host edit before event.time', () => {
    expect(evaluateEventEditStartedLock(eventWithTime(startIso), beforeStart)).toEqual({
      locked: false,
      startedLock: null,
    });
  });

  it('locks host edit when client now equals event.time', () => {
    const result = evaluateEventEditStartedLock(eventWithTime(startIso), exactStart);

    expect(result.locked).toBe(true);
    expect(result.startedLock).toMatchObject({
      code: 'event_started_lock',
      status: 'started_locked',
      message: '活動已開始，無法編輯或刪除。',
    });
  });

  it('locks host edit after event.time', () => {
    expect(evaluateEventEditStartedLock(eventWithTime(startIso), afterStart)).toMatchObject({
      locked: true,
      startedLock: {
        code: 'event_started_lock',
        status: 'started_locked',
        message: '活動已開始，無法編輯或刪除。',
      },
    });
  });
});

describe('validateEventDeadlineBeforeStart', () => {
  it('returns the shared inline error when registration deadline is not before event time', () => {
    expect(
      eventRuntimeHelpers.validateEventDeadlineBeforeStart(
        '2026-07-01T10:00',
        '2026-07-01T10:00',
      ),
    ).toBe(eventRuntimeHelpers.EVENT_DEADLINE_BEFORE_START_ERROR);

    expect(
      eventRuntimeHelpers.validateEventDeadlineBeforeStart(
        '2026-07-01T10:00',
        '2026-07-01T10:30',
      ),
    ).toBe(eventRuntimeHelpers.EVENT_DEADLINE_BEFORE_START_ERROR);
  });

  it('returns an empty string for valid, blank, or unparsable deadline comparisons', () => {
    expect(
      eventRuntimeHelpers.validateEventDeadlineBeforeStart(
        '2026-07-01T10:00',
        '2026-07-01T09:59',
      ),
    ).toBe('');
    expect(eventRuntimeHelpers.validateEventDeadlineBeforeStart('', '2026-07-01T09:59')).toBe('');
    expect(eventRuntimeHelpers.validateEventDeadlineBeforeStart('2026-07-01T10:00', '')).toBe('');
    expect(
      eventRuntimeHelpers.validateEventDeadlineBeforeStart('not-a-date', '2026-07-01T09:59'),
    ).toBe('');
    expect(
      eventRuntimeHelpers.validateEventDeadlineBeforeStart('2026-07-01T10:00', 'not-a-date'),
    ).toBe('');
  });
});
