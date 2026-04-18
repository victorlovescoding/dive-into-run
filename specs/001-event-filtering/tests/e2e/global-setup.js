/**
 * @file Playwright global setup for 001-event-filtering E2E tests.
 * @description
 * Creates a test user and seeds Firestore with test events that have varied
 * city/district/distanceKm values for meaningful filter testing.
 */

import {
  verifyEmulatorRunning,
  cleanupEmulator,
  createTestUser,
  seedDoc,
  ts,
} from '../../../test-utils/e2e-helpers.js';

/**
 * Playwright global setup: creates a test account and seeds test events
 * with varied city/district/distance values for filter E2E testing.
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
  await verifyEmulatorRunning();
  await cleanupEmulator();

  // Create test user
  const { localId: hostUid } = await createTestUser(
    'filter-test-host@example.com',
    'test-password',
    'Filter Test Host',
  );

  /** @type {Record<string, unknown>} */
  const baseEvent = {
    hostUid,
    hostName: 'Filter Test Host',
    hostPhotoURL: '',
    runType: 'road',
    maxParticipants: 10,
    participantsCount: 0,
    remainingSeats: 10,
    description: 'E2E 篩選測試用活動',
    createdAt: ts('2026-04-01T00:00:00Z'),
  };

  // Event 1: 台北市信義區, 5km
  await seedDoc('events', 'filter-event-1', {
    ...baseEvent,
    title: 'E2E 篩選活動一',
    city: '台北市',
    district: '信義區',
    meetPlace: '象山捷運站',
    distanceKm: 5.0,
    paceSec: 360,
    time: ts('2027-06-15T08:00:00Z'),
    registrationDeadline: ts('2027-06-14T23:59:59Z'),
  });

  // Event 2: 桃園市龜山區, 10km
  await seedDoc('events', 'filter-event-2', {
    ...baseEvent,
    title: 'E2E 篩選活動二',
    city: '桃園市',
    district: '龜山區',
    meetPlace: '體育大學',
    distanceKm: 10.0,
    paceSec: 330,
    time: ts('2027-07-20T07:00:00Z'),
    registrationDeadline: ts('2027-07-19T23:59:59Z'),
  });
}
