/**
 * @file Playwright global setup for Event Edit & Delete E2E tests.
 * @description
 * Creates test users and seeds 2 events owned by the host for edit/delete testing.
 */

import {
  verifyEmulatorRunning,
  cleanupEmulator,
  createTestUser,
  seedDoc,
  ts,
} from '../../_helpers/e2e-helpers.js';

/**
 * Playwright global setup: creates test accounts and seeds test events.
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
  await verifyEmulatorRunning();
  await cleanupEmulator();

  // Create test accounts
  const { localId: testHostUid } = await createTestUser(
    'test-host@example.com',
    'test-password',
    'Test Host',
  );
  await createTestUser('test-participant@example.com', 'test-password', 'Test Participant');

  // Seed 2 events owned by test-host (delete test removes one, leaving one for subsequent tests)
  /** @type {Record<string, unknown>} */
  const baseEvent = {
    city: '台北市',
    district: '信義區',
    meetPlace: '象山捷運站',
    runType: 'road',
    distanceKm: 5.0,
    paceSec: 360,
    maxParticipants: 10,
    participantsCount: 0,
    remainingSeats: 10,
    description: 'E2E 測試用活動，請勿操作',
    hostUid: testHostUid,
    hostName: 'Test Host',
    hostPhotoURL: '',
    registrationDeadline: ts('2026-04-14T23:59:59Z'),
    createdAt: ts('2026-03-30T00:00:00Z'),
  };

  await seedDoc('events', 'test-event-1', {
    ...baseEvent,
    title: 'E2E 測試活動一',
    time: ts('2026-04-15T10:00:00Z'),
  });

  await seedDoc('events', 'test-event-2', {
    ...baseEvent,
    title: 'E2E 測試活動二',
    time: ts('2026-04-16T10:00:00Z'),
  });
}
