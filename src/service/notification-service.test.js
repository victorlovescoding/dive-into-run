import { describe, expect, test } from 'vitest';
import { buildNotificationMessage } from './notification-service';

describe('notification service host join messages', () => {
  test('builds event_host_joined message with actor name and event title', () => {
    expect(
      buildNotificationMessage('event_host_joined', '週末晨跑', {
        uid: 'runner-1',
        name: '小明',
        photoURL: '',
      }),
    ).toBe('小明 報名了你的活動「週末晨跑」');
  });

  test('keeps existing event modified message compatible without actor', () => {
    expect(buildNotificationMessage('event_modified', '週末晨跑')).toBe(
      '你所參加的『週末晨跑』活動資訊有更動',
    );
  });

  test('throws when event_host_joined is missing actor', () => {
    expect(() => buildNotificationMessage('event_host_joined', '週末晨跑')).toThrow(
      'event_host_joined notification requires actor name',
    );
  });

  test('throws when event_host_joined actor name is blank', () => {
    expect(() =>
      buildNotificationMessage('event_host_joined', '週末晨跑', {
        uid: 'runner-1',
        name: '   ',
        photoURL: '',
      }),
    ).toThrow('event_host_joined notification requires actor name');
  });
});
