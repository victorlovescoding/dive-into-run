import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import {
  EVENT_STARTED_LOCK_ERROR_CODE,
  EVENT_STARTED_LOCK_ERROR_MESSAGE,
  prepareEventUpdateFields,
} from '@/service/event-service';

const startIso = '2026-07-01T10:00:00.000Z';
const beforeStartIso = '2026-07-01T09:59:59.999Z';
const exactStartIso = startIso;
const afterStartIso = '2026-07-01T10:00:00.001Z';

/**
 * 建立 Firestore Timestamp fixture。
 * @param {string} iso - ISO timestamp 字串。
 * @returns {FirestoreTimestamp} Timestamp fixture。
 */
function timestamp(iso) {
  return FirestoreTimestamp.fromDate(new Date(iso));
}

/**
 * 建立 update service 可接受的活動 fixture。
 * @param {string} timeIso - 活動開始時間。
 * @returns {object} 目前活動資料。
 */
function currentEvent(timeIso = startIso) {
  return {
    hostUid: 'host-1',
    time: timestamp(timeIso),
    registrationDeadline: timestamp('2026-07-01T09:00:00.000Z'),
    participantsCount: 1,
  };
}

/**
 * 執行函式並回傳丟出的錯誤。
 * @param {() => void} fn - 預期會丟錯的函式。
 * @returns {unknown} 捕捉到的錯誤，沒有錯誤時為 null。
 */
function catchError(fn) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return null;
}

describe('prepareEventUpdateFields started edit lock', () => {
  it('allows host edits before the event starts', () => {
    expect(
      prepareEventUpdateFields(
        'event-1',
        { title: '更新後的活動' },
        currentEvent(),
        undefined,
        { actorUid: 'host-1', now: new Date(beforeStartIso) },
      ),
    ).toEqual({ title: '更新後的活動' });
  });

  it('rejects host edits at the exact event start boundary', () => {
    expect(() =>
      prepareEventUpdateFields(
        'event-1',
        { title: '不能更新' },
        currentEvent(),
        undefined,
        { actorUid: 'host-1', now: new Date(exactStartIso) },
      ),
    ).toThrow(EVENT_STARTED_LOCK_ERROR_MESSAGE);
  });

  it('rejects host edits after the event starts with started-lock classification', () => {
    const error = catchError(() =>
      prepareEventUpdateFields(
        'event-1',
        { title: '不能更新' },
        currentEvent(),
        undefined,
        { actorUid: 'host-1', now: new Date(afterStartIso) },
      ),
    );

    expect(error).toMatchObject({
      code: EVENT_STARTED_LOCK_ERROR_CODE,
      message: EVENT_STARTED_LOCK_ERROR_MESSAGE,
    });
  });

  it('keeps permission rejection ahead of started-lock rejection for non-host edits', () => {
    const error = catchError(() =>
      prepareEventUpdateFields(
        'event-1',
        { title: '不能更新' },
        currentEvent(),
        undefined,
        { actorUid: 'runner-1', now: new Date(afterStartIso) },
      ),
    );

    expect(error).toMatchObject({
      code: 'permission-denied',
      message: 'permission-denied',
    });
  });

  it('rejects updates that move resulting event time to now', () => {
    expect(() =>
      prepareEventUpdateFields(
        'event-1',
        { time: exactStartIso },
        currentEvent('2026-07-01T11:00:00.000Z'),
        undefined,
        { actorUid: 'host-1', now: new Date(exactStartIso) },
      ),
    ).toThrow('活動開始時間必須晚於目前時間');
  });

  it('rejects updates that move resulting event time to the past', () => {
    expect(() =>
      prepareEventUpdateFields(
        'event-1',
        { time: beforeStartIso },
        currentEvent('2026-07-01T11:00:00.000Z'),
        undefined,
        { actorUid: 'host-1', now: new Date(exactStartIso) },
      ),
    ).toThrow('活動開始時間必須晚於目前時間');
  });
});
