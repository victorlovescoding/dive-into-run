/**
 * @typedef {object} PublicProfileDateFixture
 * @property {string} uid - User UID.
 * @property {string} name - Display name.
 * @property {string} photoURL - Avatar URL.
 * @property {string} [bio] - Profile bio.
 * @property {Date} createdAt - Joined date.
 */

/**
 * @typedef {object} PublicProfileTimestampFixture
 * @property {string} uid - User UID.
 * @property {string} name - Display name.
 * @property {string} photoURL - Avatar URL.
 * @property {string} [bio] - Profile bio.
 * @property {{ toDate: () => Date }} createdAt - Firestore timestamp-like joined date.
 */

/**
 * @typedef {object} ProfileStatsFixture
 * @property {number} hostedCount - Hosted event count.
 * @property {number} joinedCount - Joined event count.
 * @property {number | null} totalDistanceKm - Total running distance, or null when unavailable.
 */

const DEFAULT_JOINED_DATE = new Date(2024, 2, 15);

/**
 * Creates a public profile fixture whose `createdAt` is a Date.
 * Used by ProfileClient tests because the server-provided profile prop has this shape.
 * @param {Partial<PublicProfileDateFixture>} [overrides] - Field overrides.
 * @returns {PublicProfileDateFixture} Public profile fixture.
 */
export function createPublicProfileDateFixture(overrides = {}) {
  return {
    uid: 'user-abc',
    name: 'Alice Runner',
    photoURL: 'https://example.com/alice.jpg',
    bio: '每天晨跑 5 公里。',
    createdAt: DEFAULT_JOINED_DATE,
    ...overrides,
  };
}

/**
 * Creates a public profile fixture whose `createdAt` is Firestore Timestamp-like.
 * Used by ProfileHeader tests because that component accepts normalized timestamp data.
 * @param {Partial<PublicProfileTimestampFixture>} [overrides] - Field overrides.
 * @returns {PublicProfileTimestampFixture} Public profile fixture.
 */
export function createPublicProfileTimestampFixture(overrides = {}) {
  return {
    uid: 'user-abc',
    name: 'Alice Runner',
    photoURL: 'https://example.com/alice.jpg',
    bio: '每天晨跑 5 公里，週末登山路跑。',
    createdAt: { toDate: () => DEFAULT_JOINED_DATE },
    ...overrides,
  };
}

/**
 * Creates a profile stats fixture.
 * @param {Partial<ProfileStatsFixture>} [overrides] - Field overrides.
 * @returns {ProfileStatsFixture} Profile stats fixture.
 */
export function createProfileStatsFixture(overrides = {}) {
  return {
    hostedCount: 5,
    joinedCount: 12,
    totalDistanceKm: 42.7,
    ...overrides,
  };
}
