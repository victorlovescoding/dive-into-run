/**
 * @file Playwright global setup for Notification System E2E tests.
 * @description
 * Creates 3 test users and seeds event, participant, post, and user docs.
 */

import {
  verifyEmulatorRunning,
  cleanupEmulator,
  createTestUser,
  seedDoc,
  ts,
} from '../../_helpers/e2e-helpers.js';

/**
 * Playwright global setup: creates 3 test accounts and seeds event, participant, and post data.
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
  await verifyEmulatorRunning();
  await cleanupEmulator();

  // Create 3 test accounts
  const { localId: hostUid } = await createTestUser(
    'test-host@example.com',
    'test-password',
    'Test Host',
  );
  const { localId: participantUid } = await createTestUser(
    'test-participant@example.com',
    'test-password',
    'Test Participant',
  );
  const { localId: authorUid } = await createTestUser(
    'test-author@example.com',
    'test-password',
    'Test Author',
  );

  // Seed user docs
  await seedDoc('users', hostUid, {
    name: 'Test Host',
    email: 'test-host@example.com',
    photoURL: '',
  });

  await seedDoc('users', participantUid, {
    name: 'Test Participant',
    email: 'test-participant@example.com',
    photoURL: '',
  });

  await seedDoc('users', authorUid, {
    name: 'Test Author',
    email: 'test-author@example.com',
    photoURL: '',
  });

  // Seed 1 event owned by host
  await seedDoc('events', 'test-event-notif', {
    title: 'E2E 通知測試活動',
    city: '台北市',
    district: '信義區',
    meetPlace: '象山捷運站',
    runType: 'road',
    distanceKm: 5.0,
    paceSec: 360,
    maxParticipants: 10,
    participantsCount: 1,
    remainingSeats: 9,
    description: '通知系統 E2E 測試用活動',
    hostUid,
    hostName: 'Test Host',
    hostPhotoURL: '',
    time: ts('2026-05-15T10:00:00Z'),
    registrationDeadline: ts('2026-05-14T23:59:59Z'),
    createdAt: ts('2026-04-01T00:00:00Z'),
  });

  // Seed participant into the event
  await seedDoc('events/test-event-notif/participants', participantUid, {
    uid: participantUid,
    eventId: 'test-event-notif',
    name: 'Test Participant',
    photoURL: '',
    joinedAt: ts('2026-04-02T00:00:00Z'),
  });

  // Seed 1 post by test-author
  await seedDoc('posts', 'test-post-notif', {
    title: 'E2E 通知測試文章',
    content: '這是通知系統 E2E 測試用文章內容',
    authorUid,
    authorImgURL: '',
    postAt: ts('2026-04-01T00:00:00Z'),
    likesCount: 0,
    commentsCount: 0,
  });
}
