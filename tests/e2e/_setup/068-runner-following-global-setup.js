/**
 * @file Playwright global setup for runner-following E2E tests.
 * @description Seeds deterministic Auth and Firestore emulator data for T401.
 */

import {
  PROJECT_ID,
  AUTH_EMULATOR_URL,
  verifyEmulatorRunning,
  cleanupEmulator,
  seedDoc,
  ts,
} from '../../_helpers/e2e-helpers.js';

const PASSWORD = 'test-password';
const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer owner',
};

const USERS = {
  viewer: {
    uid: 'viewer-runner',
    email: 't401-viewer@example.com',
    name: 'T401 Viewer Runner',
  },
  target: {
    uid: 'target-runner',
    email: 't401-target@example.com',
    name: 'T401 Target Runner',
  },
  existingFollower: {
    uid: 'existing-follower-runner',
    email: 't401-existing-follower@example.com',
    name: 'T401 Existing Follower',
  },
  following: {
    uid: 'following-runner',
    email: 't401-following@example.com',
    name: 'T401 Following Runner',
  },
  memberAlpha: {
    uid: 'member-alpha-runner',
    email: 't401-member-alpha@example.com',
    name: 'T401 Member Alpha',
  },
  memberBeta: {
    uid: 'member-beta-runner',
    email: 't401-member-beta@example.com',
    name: 'T401 Member Beta',
  },
  host: {
    uid: 'host-runner',
    email: 't401-host@example.com',
    name: 'T401 Host Runner',
  },
  participant: {
    uid: 'participant-runner',
    email: 't401-participant@example.com',
    name: 'T401 Participant Runner',
  },
};

/**
 * Creates an Auth Emulator user with a deterministic uid.
 * @param {{ uid: string, email: string, name: string }} user - Seed user.
 * @returns {Promise<void>}
 */
async function createAuthUser(user) {
  const url = `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts?key=fake-key`;
  const res = await fetch(url, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({
      localId: user.uid,
      email: user.email,
      password: PASSWORD,
      displayName: user.name,
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create auth user ${user.uid}: ${await res.text()}`);
  }
}

/**
 * Creates the public Firestore user profile document.
 * @param {{ uid: string, email: string, name: string }} user - Seed user.
 * @param {number} followersCount - Public denormalized follower count.
 * @returns {Promise<void>}
 */
async function seedUserDoc(user, followersCount = 0) {
  await seedDoc('users', user.uid, {
    uid: user.uid,
    name: user.name,
    email: user.email,
    photoURL: '',
    bio: `${user.name} 的 E2E 測試公開檔案`,
    followersCount,
    createdAt: ts('2026-01-01T00:00:00Z'),
  });
}

/**
 * Seeds mirrored follow relationship documents.
 * @param {{ uid: string, name: string }} follower - Follower user.
 * @param {{ uid: string, name: string }} target - Followed target user.
 * @param {string} createdAtIso - Created time.
 * @returns {Promise<void>}
 */
async function seedFollow(follower, target, createdAtIso) {
  const payload = {
    followerUid: follower.uid,
    followerName: follower.name,
    followerPhotoURL: '',
    targetUid: target.uid,
    targetName: target.name,
    targetPhotoURL: '',
    status: 'following',
    createdAt: ts(createdAtIso),
  };

  await seedDoc(`users/${follower.uid}/following`, target.uid, payload);
  await seedDoc(`users/${target.uid}/followers`, follower.uid, payload);
}

/**
 * Seeds the primary event used by list/detail E2E coverage.
 * @returns {Promise<void>}
 */
async function seedPrimaryEvent() {
  await seedDoc('events', 'runner-following-event', {
    title: 'T401 Runner Following Event',
    city: '台北市',
    district: '信義區',
    meetPlace: '象山捷運站 2 號出口',
    runType: 'road',
    distanceKm: 8,
    paceSec: 360,
    maxParticipants: 12,
    participantsCount: 2,
    remainingSeats: 10,
    description: 'T401 event host follow E2E fixture',
    hostUid: USERS.host.uid,
    hostName: USERS.host.name,
    hostPhotoURL: '',
    time: ts('2030-06-02T22:00:00Z'),
    registrationDeadline: ts('2030-06-01T22:00:00Z'),
    createdAt: ts('2026-05-01T00:00:00Z'),
  });

  await seedDoc('events/runner-following-event/participants', USERS.host.uid, {
    uid: USERS.host.uid,
    eventId: 'runner-following-event',
    name: USERS.host.name,
    photoURL: '',
    joinedAt: ts('2026-05-01T01:00:00Z'),
  });

  await seedDoc('events/runner-following-event/participants', USERS.participant.uid, {
    uid: USERS.participant.uid,
    eventId: 'runner-following-event',
    name: USERS.participant.name,
    photoURL: '',
    joinedAt: ts('2026-05-01T02:00:00Z'),
  });

  await seedDoc('events/runner-following-event/comments', 'runner-following-comment', {
    authorUid: USERS.participant.uid,
    authorName: USERS.participant.name,
    authorPhotoURL: '',
    content: 'T401 這場節奏剛好',
    createdAt: ts('2026-05-01T03:00:00Z'),
    updatedAt: null,
    isEdited: false,
  });
}

/**
 * Seeds a self-hosted event to prove self host surfaces do not show follow controls.
 * @returns {Promise<void>}
 */
async function seedSelfHostedEvent() {
  await seedDoc('events', 'runner-following-self-event', {
    title: 'T401 Self Hosted Event',
    city: '台北市',
    district: '大安區',
    meetPlace: '大安森林公園',
    runType: 'road',
    distanceKm: 5,
    paceSec: 390,
    maxParticipants: 8,
    participantsCount: 1,
    remainingSeats: 7,
    description: 'T401 self host hidden follow control fixture',
    hostUid: USERS.viewer.uid,
    hostName: USERS.viewer.name,
    hostPhotoURL: '',
    time: ts('2030-06-03T22:00:00Z'),
    registrationDeadline: ts('2030-06-02T22:00:00Z'),
    createdAt: ts('2026-05-01T00:30:00Z'),
  });
}

/**
 * Playwright global setup for the runner-following feature.
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
  await verifyEmulatorRunning();
  await cleanupEmulator();

  await Promise.all(Object.values(USERS).map((user) => createAuthUser(user)));

  await Promise.all([
    seedUserDoc(USERS.viewer, 0),
    seedUserDoc(USERS.target, 1),
    seedUserDoc(USERS.existingFollower, 0),
    seedUserDoc(USERS.following, 1),
    seedUserDoc(USERS.memberAlpha, 1),
    seedUserDoc(USERS.memberBeta, 1),
    seedUserDoc(USERS.host, 0),
    seedUserDoc(USERS.participant, 0),
  ]);

  await seedFollow(USERS.existingFollower, USERS.target, '2026-05-01T04:00:00Z');
  await seedFollow(USERS.target, USERS.following, '2026-05-01T05:00:00Z');
  await seedFollow(USERS.viewer, USERS.memberAlpha, '2026-05-01T06:00:00Z');
  await seedFollow(USERS.viewer, USERS.memberBeta, '2026-05-01T07:00:00Z');

  await seedPrimaryEvent();
  await seedSelfHostedEvent();

  await seedDoc('notifications', 'target-existing-read-marker', {
    recipientUid: USERS.target.uid,
    type: 'runner_followed',
    actorUid: USERS.existingFollower.uid,
    actorName: USERS.existingFollower.name,
    actorPhotoURL: '',
    entityType: 'user',
    entityId: USERS.existingFollower.uid,
    entityTitle: USERS.existingFollower.name,
    commentId: null,
    message: `${USERS.existingFollower.name} 已開始追蹤你。`,
    read: true,
    createdAt: ts('2026-05-01T08:00:00Z'),
  });
}
