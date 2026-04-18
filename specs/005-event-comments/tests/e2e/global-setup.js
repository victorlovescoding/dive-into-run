/**
 * @file Playwright global setup for Event Comments E2E tests.
 * @description
 * Creates 3 test users and seeds 1 event with 2 comments for comment feature testing.
 */

import {
  verifyEmulatorRunning,
  cleanupEmulator,
  createTestUser,
  seedDoc,
  ts,
} from '../../../test-utils/e2e-helpers.js';

/**
 * Playwright global setup: creates 3 test accounts, seeds 1 event and 2 comments.
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
  const { localId: commenterUid } = await createTestUser(
    'test-commenter@example.com',
    'test-password',
    'Test Commenter',
  );
  await createTestUser('test-viewer@example.com', 'test-password', 'Test Viewer');

  // Seed 1 event owned by test-host
  await seedDoc('events', 'test-event-comments', {
    title: 'E2E 留言測試活動',
    city: '台北市',
    district: '大安區',
    meetPlace: '大安森林公園捷運站',
    runType: 'road',
    distanceKm: 5.0,
    paceSec: 360,
    maxParticipants: 10,
    participantsCount: 0,
    remainingSeats: 10,
    description: '留言功能 E2E 測試用活動',
    hostUid,
    hostName: 'Test Host',
    hostPhotoURL: '',
    time: ts('2026-04-15T10:00:00Z'),
    registrationDeadline: ts('2026-04-14T23:59:59Z'),
    createdAt: ts('2026-03-30T00:00:00Z'),
  });

  // Seed 2 comments in events/test-event-comments/comments subcollection
  const commentsPath = 'events/test-event-comments/comments';

  await seedDoc(commentsPath, 'seed-comment-host', {
    authorUid: hostUid,
    authorName: 'Test Host',
    authorPhotoURL: '',
    content: '主揪的測試留言',
    createdAt: ts('2026-04-01T10:00:00Z'),
    updatedAt: null,
    isEdited: false,
  });

  await seedDoc(commentsPath, 'seed-comment-commenter', {
    authorUid: commenterUid,
    authorName: 'Test Commenter',
    authorPhotoURL: '',
    content: '留言者的測試留言',
    createdAt: ts('2026-04-01T11:00:00Z'),
    updatedAt: null,
    isEdited: false,
  });
}
