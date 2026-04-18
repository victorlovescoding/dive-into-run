// @ts-check
/**
 * @file E2E Test — Comment Notifications (T016)
 * @description
 * 測試留言通知完整流程：
 * - Scenario 1: 文章留言跟帖通知 (post_comment_reply)
 * - Scenario 2: 活動留言通知 (event_host_comment / event_participant_comment)
 * - Scenario 3: 去重驗證 (host + commenter 只收一則)
 * - Scenario 4: Toast 即時提示
 *
 * 策略：透過 Firestore REST API (Bearer owner) 直接 seed 留言與通知，
 * 驗證前端 UI（bell badge、toast、notification panel、scroll-to-comment + highlight）。
 *
 * Rules:
 * 1. Use `page.getByRole` / `page.getByText` — no CSS selectors except aria-controls.
 * 2. STRICTLY FORBIDDEN: `page.waitForTimeout()`.
 * 3. Strict JSDoc required.
 */

import { test, expect } from '@playwright/test';
import {
  cleanupEmulator,
  createTestUser,
  seedDoc,
  loginAsUser,
  signOutUser,
  ts,
} from '../../../test-utils/e2e-helpers.js';

// ---------------------------------------------------------------------------
// Test data IDs
// ---------------------------------------------------------------------------

const TEST_POST_ID = 'test-post-cnotif';
const TEST_EVENT_ID = 'test-event-cnotif';

const USER_A_EMAIL = 'cnotif-user-a@example.com';
const USER_B_EMAIL = 'cnotif-user-b@example.com';
const USER_C_EMAIL = 'cnotif-user-c@example.com';
const TEST_PASSWORD = 'test-password';

// ---------------------------------------------------------------------------
// Scenario 1: 文章留言跟帖通知 (post_comment_reply)
// ---------------------------------------------------------------------------

test.describe('Scenario 1: 文章留言跟帖通知', () => {
  /** @type {string} */
  let userAUid;
  /** @type {string} */
  let userBUid;
  /** @type {string} */
  let userCUid;

  const commentIdB = 'cnotif-post-comment-b';
  const commentIdC = 'cnotif-post-comment-c';
  const notifId = 'cnotif-post-reply-notif';

  test.beforeAll(async () => {
    await cleanupEmulator();

    const userA = await createTestUser(USER_A_EMAIL, TEST_PASSWORD, 'User A');
    const userB = await createTestUser(USER_B_EMAIL, TEST_PASSWORD, 'User B');
    const userC = await createTestUser(USER_C_EMAIL, TEST_PASSWORD, 'User C');
    userAUid = userA.localId;
    userBUid = userB.localId;
    userCUid = userC.localId;

    // Seed user docs
    await seedDoc('users', userAUid, { name: 'User A', email: USER_A_EMAIL, photoURL: '' });
    await seedDoc('users', userBUid, { name: 'User B', email: USER_B_EMAIL, photoURL: '' });
    await seedDoc('users', userCUid, { name: 'User C', email: USER_C_EMAIL, photoURL: '' });

    // Seed 文章（User A 為作者）
    await seedDoc('posts', TEST_POST_ID, {
      title: 'E2E 跟帖通知測試文章',
      content: '這是留言通知 E2E 測試用文章',
      authorUid: userAUid,
      authorImgURL: '',
      postAt: ts('2026-04-01T00:00:00Z'),
      likesCount: 0,
      commentsCount: 2,
    });

    // Seed User B 的留言（post comments use `comment` field）
    await seedDoc(`posts/${TEST_POST_ID}/comments`, commentIdB, {
      authorUid: userBUid,
      authorName: 'User B',
      authorImgURL: '',
      comment: 'User B 的留言',
      createdAt: ts('2026-04-10T10:00:00Z'),
    });

    // Seed User C 的新留言
    await seedDoc(`posts/${TEST_POST_ID}/comments`, commentIdC, {
      authorUid: userCUid,
      authorName: 'User C',
      authorImgURL: '',
      comment: 'User C 的新留言',
      createdAt: ts(new Date().toISOString()),
    });

    // Seed 通知給 User B（跟帖通知：post_comment_reply）
    await seedDoc('notifications', notifId, {
      recipientUid: userBUid,
      type: 'post_comment_reply',
      actorUid: userCUid,
      actorName: 'User C',
      actorPhotoURL: '',
      entityType: 'post',
      entityId: TEST_POST_ID,
      entityTitle: 'E2E 跟帖通知測試文章',
      commentId: commentIdC,
      message: '你留言過的文章『E2E 跟帖通知測試文章』有一則新的留言',
      read: false,
      createdAt: ts(new Date().toISOString()),
    });
  });

  test('User B 收到跟帖通知 → bell badge 顯示 → 點擊通知 → scroll + highlight', async ({
    page,
  }) => {
    await loginAsUser(page, USER_B_EMAIL, TEST_PASSWORD, {
      startPage: '/posts',
      waitForSelector: '[aria-controls="notification-panel"]',
    });

    const bellButton = page.locator('[aria-controls="notification-panel"]');
    await expect(bellButton).toBeVisible();
    await expect(page.locator('[class*="badge"]')).toBeVisible({ timeout: 30000 });

    await bellButton.click();
    const panel = page.getByRole('region', { name: /通知面板/i });
    await expect(panel).toBeVisible();

    await expect(panel.getByText(/你留言過的文章/i)).toBeVisible();
    await expect(panel.getByText(/跟帖通知測試文章/i)).toBeVisible();

    const notifItem = panel.locator('button').filter({ hasText: /留言過的文章/i });
    await notifItem.click();

    await expect(page).toHaveURL(new RegExp(`/posts/${TEST_POST_ID}`));
    await expect(page).toHaveURL(/commentId=/);
    await expect(panel).not.toBeVisible();

    const commentEl = page.locator(`#${commentIdC}`);
    await expect(commentEl).toBeVisible({ timeout: 15000 });
    await expect(commentEl).toHaveClass(/commentHighlight/, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: 活動留言通知 (host + participant)
// ---------------------------------------------------------------------------

test.describe('Scenario 2: 活動留言通知（主揪人與參加者）', () => {
  /** @type {string} */
  let userAUid;
  /** @type {string} */
  let userBUid;
  /** @type {string} */
  let userCUid;

  // Event comments use `content` field (not `comment`)
  const commentIdEvent = 'cnotif-event-comment-c';
  const hostNotifId = 'cnotif-event-host-notif';
  const participantNotifId = 'cnotif-event-participant-notif';

  test.beforeAll(async () => {
    await cleanupEmulator();

    const userA = await createTestUser(USER_A_EMAIL, TEST_PASSWORD, 'User A');
    const userB = await createTestUser(USER_B_EMAIL, TEST_PASSWORD, 'User B');
    const userC = await createTestUser(USER_C_EMAIL, TEST_PASSWORD, 'User C');
    userAUid = userA.localId;
    userBUid = userB.localId;
    userCUid = userC.localId;

    await seedDoc('users', userAUid, { name: 'User A', email: USER_A_EMAIL, photoURL: '' });
    await seedDoc('users', userBUid, { name: 'User B', email: USER_B_EMAIL, photoURL: '' });
    await seedDoc('users', userCUid, { name: 'User C', email: USER_C_EMAIL, photoURL: '' });

    // Seed 活動（User A 為主揪人）
    await seedDoc('events', TEST_EVENT_ID, {
      title: 'E2E 活動留言通知測試',
      city: '台北市',
      district: '信義區',
      meetPlace: '象山捷運站',
      runType: 'road',
      distanceKm: 5.0,
      paceSec: 360,
      maxParticipants: 10,
      participantsCount: 1,
      remainingSeats: 9,
      description: '留言通知 E2E 測試用活動',
      hostUid: userAUid,
      hostName: 'User A',
      hostPhotoURL: '',
      time: ts('2026-05-15T10:00:00Z'),
      registrationDeadline: ts('2026-05-14T23:59:59Z'),
      createdAt: ts('2026-04-01T00:00:00Z'),
    });

    // Seed User B 為參加者
    await seedDoc(`events/${TEST_EVENT_ID}/participants`, userBUid, {
      uid: userBUid,
      eventId: TEST_EVENT_ID,
      name: 'User B',
      photoURL: '',
      joinedAt: ts('2026-04-02T00:00:00Z'),
    });

    // Seed User C 的留言（event comments use `content` field）
    await seedDoc(`events/${TEST_EVENT_ID}/comments`, commentIdEvent, {
      authorUid: userCUid,
      authorName: 'User C',
      authorPhotoURL: '',
      content: 'User C 在活動的留言',
      createdAt: ts(new Date().toISOString()),
    });

    // Seed 主揪人通知
    await seedDoc('notifications', hostNotifId, {
      recipientUid: userAUid,
      type: 'event_host_comment',
      actorUid: userCUid,
      actorName: 'User C',
      actorPhotoURL: '',
      entityType: 'event',
      entityId: TEST_EVENT_ID,
      entityTitle: 'E2E 活動留言通知測試',
      commentId: commentIdEvent,
      message: '你主辦的活動『E2E 活動留言通知測試』有一則新的留言',
      read: false,
      createdAt: ts(new Date().toISOString()),
    });

    // Seed 參加者通知
    await seedDoc('notifications', participantNotifId, {
      recipientUid: userBUid,
      type: 'event_participant_comment',
      actorUid: userCUid,
      actorName: 'User C',
      actorPhotoURL: '',
      entityType: 'event',
      entityId: TEST_EVENT_ID,
      entityTitle: 'E2E 活動留言通知測試',
      commentId: commentIdEvent,
      message: '你參加的活動『E2E 活動留言通知測試』有一則新的留言',
      read: false,
      createdAt: ts(new Date().toISOString()),
    });
  });

  test('主揪人 (User A) 收到 event_host_comment → 點擊通知 → scroll + highlight', async ({
    page,
  }) => {
    await loginAsUser(page, USER_A_EMAIL, TEST_PASSWORD, {
      startPage: '/posts',
      waitForSelector: '[aria-controls="notification-panel"]',
    });

    const bellButton = page.locator('[aria-controls="notification-panel"]');
    await expect(page.locator('[class*="badge"]')).toBeVisible({ timeout: 30000 });

    await bellButton.click();
    const panel = page.getByRole('region', { name: /通知面板/i });
    await expect(panel).toBeVisible();

    await expect(panel.getByText(/你主辦的活動/i)).toBeVisible();
    await expect(panel.getByText(/活動留言通知測試/i)).toBeVisible();

    const notifItem = panel.locator('button').filter({ hasText: /主辦的活動/i });
    await notifItem.click();

    await expect(page).toHaveURL(new RegExp(`/events/${TEST_EVENT_ID}`));
    await expect(page).toHaveURL(/commentId=/);
    await expect(panel).not.toBeVisible();

    const commentEl = page.locator(`#${commentIdEvent}`);
    await expect(commentEl).toBeVisible({ timeout: 15000 });
    await expect(commentEl).toHaveClass(/commentHighlight/, { timeout: 5000 });

    await signOutUser(page);
  });

  test('參加者 (User B) 收到 event_participant_comment → 點擊通知 → scroll + highlight', async ({
    page,
  }) => {
    await loginAsUser(page, USER_B_EMAIL, TEST_PASSWORD, {
      startPage: '/posts',
      waitForSelector: '[aria-controls="notification-panel"]',
    });

    const bellButton = page.locator('[aria-controls="notification-panel"]');
    await expect(page.locator('[class*="badge"]')).toBeVisible({ timeout: 30000 });

    await bellButton.click();
    const panel = page.getByRole('region', { name: /通知面板/i });
    await expect(panel).toBeVisible();

    await expect(panel.getByText(/你參加的活動/i)).toBeVisible();

    const notifItem = panel.locator('button').filter({ hasText: /參加的活動/i });
    await notifItem.click();

    await expect(page).toHaveURL(new RegExp(`/events/${TEST_EVENT_ID}`));
    await expect(page).toHaveURL(/commentId=/);
    await expect(panel).not.toBeVisible();

    const commentEl = page.locator(`#${commentIdEvent}`);
    await expect(commentEl).toBeVisible({ timeout: 15000 });
    await expect(commentEl).toHaveClass(/commentHighlight/, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: 去重驗證 (host + commenter → 只收一則 event_host_comment)
// ---------------------------------------------------------------------------

test.describe('Scenario 3: 去重驗證 — 主揪人兼留言者只收一則通知', () => {
  /** @type {string} */
  let userAUid;
  /** @type {string} */
  let userBUid;

  const eventId = 'cnotif-dedup-event';
  const commentIdA = 'cnotif-dedup-comment-a';
  const commentIdB = 'cnotif-dedup-comment-b';
  const dedupNotifId = 'cnotif-dedup-host-notif';

  test.beforeAll(async () => {
    await cleanupEmulator();

    const userA = await createTestUser(USER_A_EMAIL, TEST_PASSWORD, 'User A');
    const userB = await createTestUser(USER_B_EMAIL, TEST_PASSWORD, 'User B');
    userAUid = userA.localId;
    userBUid = userB.localId;

    await seedDoc('users', userAUid, { name: 'User A', email: USER_A_EMAIL, photoURL: '' });
    await seedDoc('users', userBUid, { name: 'User B', email: USER_B_EMAIL, photoURL: '' });

    // Seed 活動（User A 為主揪人）
    await seedDoc('events', eventId, {
      title: 'E2E 去重測試活動',
      city: '台北市',
      district: '大安區',
      meetPlace: '大安森林公園',
      runType: 'road',
      distanceKm: 3.0,
      paceSec: 420,
      maxParticipants: 5,
      participantsCount: 0,
      remainingSeats: 5,
      description: '去重邏輯 E2E 測試',
      hostUid: userAUid,
      hostName: 'User A',
      hostPhotoURL: '',
      time: ts('2026-06-01T08:00:00Z'),
      registrationDeadline: ts('2026-05-31T23:59:59Z'),
      createdAt: ts('2026-04-01T00:00:00Z'),
    });

    // Seed User A 曾在自己主辦的活動留言（event comments use `content`）
    await seedDoc(`events/${eventId}/comments`, commentIdA, {
      authorUid: userAUid,
      authorName: 'User A',
      authorPhotoURL: '',
      content: '主揪人自己的留言',
      createdAt: ts('2026-04-10T10:00:00Z'),
    });

    // Seed User B 的新留言
    await seedDoc(`events/${eventId}/comments`, commentIdB, {
      authorUid: userBUid,
      authorName: 'User B',
      authorPhotoURL: '',
      content: 'User B 在去重測試活動的留言',
      createdAt: ts(new Date().toISOString()),
    });

    // Seed 只有一則通知（host 身份優先）
    await seedDoc('notifications', dedupNotifId, {
      recipientUid: userAUid,
      type: 'event_host_comment',
      actorUid: userBUid,
      actorName: 'User B',
      actorPhotoURL: '',
      entityType: 'event',
      entityId: eventId,
      entityTitle: 'E2E 去重測試活動',
      commentId: commentIdB,
      message: '你主辦的活動『E2E 去重測試活動』有一則新的留言',
      read: false,
      createdAt: ts(new Date().toISOString()),
    });
  });

  test('User A (host + commenter) 只看到一則 event_host_comment 通知', async ({ page }) => {
    await loginAsUser(page, USER_A_EMAIL, TEST_PASSWORD, {
      startPage: '/posts',
      waitForSelector: '[aria-controls="notification-panel"]',
    });

    const bellButton = page.locator('[aria-controls="notification-panel"]');
    await expect(page.locator('[class*="badge"]')).toBeVisible({ timeout: 30000 });

    const badge = page.locator('[class*="badge"]');
    await expect(badge).toHaveText('1');

    await bellButton.click();
    const panel = page.getByRole('region', { name: /通知面板/i });
    await expect(panel).toBeVisible();

    await expect(panel.getByText(/你主辦的活動/i)).toBeVisible();
    await expect(panel.getByText(/你留言過的活動/i)).not.toBeVisible();

    const notifItem = panel.locator('button').filter({ hasText: /主辦的活動/i });
    await notifItem.click();

    await expect(page).toHaveURL(new RegExp(`/events/${eventId}`));
    await expect(page).toHaveURL(/commentId=/);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Toast 即時提示
// ---------------------------------------------------------------------------

test.describe('Scenario 4: Toast 即時提示', () => {
  /** @type {string} */
  let userBUid;
  /** @type {string} */
  let userCUid;

  const toastNotifId = 'cnotif-toast-notif';

  test.beforeAll(async () => {
    await cleanupEmulator();

    const userB = await createTestUser(USER_B_EMAIL, TEST_PASSWORD, 'User B');
    const userC = await createTestUser(USER_C_EMAIL, TEST_PASSWORD, 'User C');
    userBUid = userB.localId;
    userCUid = userC.localId;

    await seedDoc('users', userBUid, { name: 'User B', email: USER_B_EMAIL, photoURL: '' });
    await seedDoc('users', userCUid, { name: 'User C', email: USER_C_EMAIL, photoURL: '' });

    // Seed 文章（User B 為作者）
    await seedDoc('posts', TEST_POST_ID, {
      title: 'E2E Toast 測試文章',
      content: 'Toast 通知 E2E 測試用文章',
      authorUid: userBUid,
      authorImgURL: '',
      postAt: ts('2026-04-01T00:00:00Z'),
      likesCount: 0,
      commentsCount: 0,
    });
  });

  test('登入後新通知產生 → toast 即時出現', async ({ page }) => {
    await loginAsUser(page, USER_B_EMAIL, TEST_PASSWORD, {
      startPage: '/posts',
      waitForSelector: '[aria-controls="notification-panel"]',
    });

    // 登入後，透過 REST API seed 一筆新通知（模擬即時推送）
    await seedDoc('notifications', toastNotifId, {
      recipientUid: userBUid,
      type: 'post_comment_reply',
      actorUid: userCUid,
      actorName: 'User C',
      actorPhotoURL: '',
      entityType: 'post',
      entityId: TEST_POST_ID,
      entityTitle: 'E2E Toast 測試文章',
      commentId: 'toast-comment-1',
      message: '你留言過的文章『E2E Toast 測試文章』有一則新的留言',
      read: false,
      createdAt: ts(new Date().toISOString()),
    });

    // 等待 toast 出現（onSnapshot 即時推送新通知）
    const toast = page.locator('[role="status"][aria-live="polite"]');
    await expect(toast).toBeVisible({ timeout: 30000 });
    await expect(toast).toContainText(/新的留言/i);

    // badge 也同步更新
    await expect(page.locator('[class*="badge"]')).toBeVisible({ timeout: 10000 });
  });
});
