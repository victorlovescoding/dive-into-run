// @ts-check
/**
 * @file E2E coverage for saved content favorites.
 * @description
 * Covers unauthenticated bookmark guardrails, signed-in bookmark toggles, and
 * the member favorites remove/undo journey with Firebase Emulator data.
 */

import { test, expect } from '@playwright/test';
import {
  cleanupEmulator,
  createTestUser,
  FIRESTORE_EMULATOR_URL,
  loginAsUser,
  PROJECT_ID,
  seedDoc,
  ts,
  verifyEmulatorRunning,
} from '../_helpers/e2e-helpers.js';

test.describe.configure({ mode: 'serial' });

const TEST_EMAIL = 'favorites-runner@example.com';
const TEST_PASSWORD = 'test-password';
const TEST_DISPLAY_NAME = 'Favorites Runner';
const POST_ID = 'e2e-favorite-post';
const EVENT_ID = 'e2e-favorite-event';

/** @type {string} */
let testUserUid = '';

/**
 * Reads one Firestore emulator document and reports whether it exists.
 * @param {string} documentPath - Firestore document path.
 * @returns {Promise<boolean>} Whether the document exists.
 */
async function documentExists(documentPath) {
  const url =
    `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}` +
    `/databases/(default)/documents/${documentPath}`;
  const response = await fetch(url, {
    headers: { Authorization: 'Bearer owner' },
  });

  if (response.status === 404) return false;
  if (!response.ok) {
    throw new Error(`Failed to read ${documentPath}: ${await response.text()}`);
  }

  return true;
}

/**
 * Seeds public post and event documents used by all favorites E2E cases.
 * @returns {Promise<void>}
 */
async function seedContentDocuments() {
  await seedDoc('posts', POST_ID, {
    authorUid: testUserUid,
    authorName: TEST_DISPLAY_NAME,
    authorImgURL: '',
    title: 'E2E 收藏文章',
    content: '這是一篇用來驗證收藏流程的文章。',
    excerpt: '收藏流程文章摘要',
    postAt: ts('2026-05-01T10:00:00Z'),
    likesCount: 0,
    commentsCount: 0,
  });

  await seedDoc('events', EVENT_ID, {
    hostUid: testUserUid,
    hostName: TEST_DISPLAY_NAME,
    hostPhotoURL: '',
    title: 'E2E 收藏活動',
    city: '臺北市',
    district: '大安區',
    meetPlace: '大安森林公園',
    runType: 'road',
    distanceKm: 5,
    paceSec: 360,
    maxParticipants: 10,
    participantsCount: 0,
    remainingSeats: 10,
    description: 'E2E 收藏測試用活動',
    createdAt: ts('2026-05-01T09:00:00Z'),
    time: ts('2027-05-20T07:00:00Z'),
    registrationDeadline: ts('2027-05-19T23:00:00Z'),
  });
}

/**
 * Seeds favorites for the signed-in test user.
 * @returns {Promise<void>}
 */
async function seedFavoriteDocuments() {
  await seedDoc(`users/${testUserUid}/favoritePosts`, POST_ID, {
    targetId: POST_ID,
    createdAt: ts('2026-05-02T10:00:00Z'),
  });

  await seedDoc(`users/${testUserUid}/favoriteEvents`, EVENT_ID, {
    targetId: EVENT_ID,
    createdAt: ts('2026-05-02T11:00:00Z'),
  });
}

test.beforeEach(async () => {
  await verifyEmulatorRunning();
  await cleanupEmulator();
  const { localId } = await createTestUser(TEST_EMAIL, TEST_PASSWORD, TEST_DISPLAY_NAME);
  testUserUid = localId;
  await seedContentDocuments();
});

test('unauthenticated bookmark action shows login-required toast and no write', async ({
  page,
}) => {
  await page.goto('/posts');
  await expect(page.getByRole('heading', { name: '文章河道' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10000 });

  const bookmarkButton = page.getByRole('button', { name: '收藏文章' });
  await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'false');

  await bookmarkButton.click();

  await expect(page.getByRole('status').filter({ hasText: '請先登入才能收藏' })).toBeVisible();
  await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'false');
  await expect(documentExists(`users/${testUserUid}/favoritePosts/${POST_ID}`)).resolves.toBe(false);
  await expect(documentExists(`users/undefined/favoritePosts/${POST_ID}`)).resolves.toBe(false);
  await expect(documentExists(`users/null/favoritePosts/${POST_ID}`)).resolves.toBe(false);
});

test('signed-in add toggles filled icon state for post and event bookmarks', async ({
  page,
}) => {
  await loginAsUser(page, TEST_EMAIL, TEST_PASSWORD, {
    startPage: '/posts',
    waitForText: /文章河道/i,
  });

  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 10000 });
  const postBookmarkButton = page.getByRole('button', { name: '收藏文章' });
  await expect(postBookmarkButton).toHaveAttribute('aria-pressed', 'false');

  await postBookmarkButton.click();

  const activePostBookmarkButton = page.getByRole('button', { name: '取消收藏文章' });
  await expect(activePostBookmarkButton).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => documentExists(`users/${testUserUid}/favoritePosts/${POST_ID}`))
    .toBe(true);

  await page.goto('/events');
  await expect(page.getByRole('heading', { name: /活動列表/i })).toBeVisible();
  const eventBookmarkButton = page.getByRole('button', { name: `收藏活動：E2E 收藏活動` });
  await expect(eventBookmarkButton).toHaveAttribute('aria-pressed', 'false');

  await eventBookmarkButton.click();

  const activeEventBookmarkButton = page.getByRole('button', {
    name: `取消收藏活動：E2E 收藏活動`,
  });
  await expect(activeEventBookmarkButton).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() => documentExists(`users/${testUserUid}/favoriteEvents/${EVENT_ID}`))
    .toBe(true);
});

test('/member/favorites tabs, card links, remove, and undo', async ({ page }) => {
  await seedFavoriteDocuments();
  await loginAsUser(page, TEST_EMAIL, TEST_PASSWORD, {
    startPage: '/member/favorites',
    waitForText: /我的收藏/i,
  });

  const postTab = page.getByRole('tab', { name: '收藏文章' });
  const eventTab = page.getByRole('tab', { name: '收藏活動' });
  await expect(postTab).toHaveAttribute('aria-selected', 'true');
  await expect(eventTab).toHaveAttribute('aria-selected', 'false');

  const postLink = page.getByRole('link', { name: /E2E 收藏文章/i });
  await expect(postLink).toHaveAttribute('href', `/posts/${POST_ID}`);

  await eventTab.click();

  await expect(eventTab).toHaveAttribute('aria-selected', 'true');
  const eventLink = page.getByRole('link', { name: /E2E 收藏活動/i });
  await expect(eventLink).toHaveAttribute('href', `/events/${EVENT_ID}`);

  await postTab.click();
  await page.getByRole('button', { name: `移除收藏 ${POST_ID}` }).click();

  await expect(postLink).not.toBeVisible();
  await expect
    .poll(() => documentExists(`users/${testUserUid}/favoritePosts/${POST_ID}`))
    .toBe(false);

  await page.getByRole('button', { name: '復原' }).click();

  await expect(page.getByRole('link', { name: /E2E 收藏文章/i })).toBeVisible();
  await expect
    .poll(() => documentExists(`users/${testUserUid}/favoritePosts/${POST_ID}`))
    .toBe(true);
});
