/**
 * @file Playwright global setup for emulator-backed quality gate E2E tests.
 * @description Seeds an authenticated event-comment surface for interactive axe scans.
 */

import {
  cleanupEmulator,
  createTestUser,
  seedDoc,
  ts,
  verifyEmulatorRunning,
} from '../../_helpers/e2e-helpers.js';

/**
 * Creates a signed-in reachable event detail state with an editable comment.
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
  await verifyEmulatorRunning();
  await cleanupEmulator();

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
    description: 'quality gate emulator-backed axe 測試用活動',
    hostUid,
    hostName: 'Test Host',
    hostPhotoURL: '',
    time: ts('2026-04-15T10:00:00Z'),
    registrationDeadline: ts('2026-04-14T23:59:59Z'),
    createdAt: ts('2026-03-30T00:00:00Z'),
  });

  await seedDoc('events/test-event-comments/comments', 'seed-comment-commenter', {
    authorUid: commenterUid,
    authorName: 'Test Commenter',
    authorPhotoURL: '',
    content: '留言者的測試留言',
    createdAt: ts('2026-04-01T11:00:00Z'),
    updatedAt: null,
    isEdited: false,
  });
}
