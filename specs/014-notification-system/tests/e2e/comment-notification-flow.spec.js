/**
 * @file E2E test: Post comment notification flow (T037).
 * @description
 * Happy path 2: 文章留言通知 → 作者收到通知 → 點擊導航至文章頁 → 滾動至留言並高亮。
 *
 * Strategy: Since the Firestore security rules prevent non-authors from
 * updating post commentsCount (needed by addComment's transaction), and the
 * notification create rule enforces `createdAt == request.time`, we seed
 * the notification + comment directly via REST API using `Bearer owner`
 * (emulator admin token that bypasses security rules), then verify the
 * author sees the notification and can navigate to the post.
 */

import { test, expect } from '@playwright/test';

const AUTH_EMULATOR_URL = 'http://localhost:9099';
const FIRESTORE_EMULATOR_URL = 'http://localhost:8080';
const PROJECT_ID = 'dive-into-run';

/**
 * 以 Email/密碼登入 Firebase Auth Emulator 並取得 idToken。
 * @param {string} email - 使用者 email。
 * @param {string} password - 使用者密碼。
 * @returns {Promise<{ localId: string, idToken: string }>} 登入結果。
 */
async function signInAndGetToken(email, password) {
  const res = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  return /** @type {Promise<{ localId: string, idToken: string }>} */ (res.json());
}

/**
 * 透過 Playwright 登入使用者。
 * @param {import('@playwright/test').Page} page - Playwright page。
 * @param {string} email - 使用者 email。
 * @param {string} password - 使用者密碼。
 */
async function loginAsUser(page, email, password) {
  await page.goto('/posts');
  await page.waitForFunction(() => Boolean(window.testFirebaseHelpers), { timeout: 10000 });
  await page.evaluate(
    async ({ email: e, password: p }) => {
      const { auth, signIn } = window.testFirebaseHelpers;
      await signIn(auth, e, p);
    },
    { email, password },
  );
  // Reload so React auth context picks up the persisted login state
  await page.reload();
  await page.locator('[aria-controls="notification-panel"]').waitFor({ timeout: 10000 });
}

/**
 * 將普通物件轉為 Firestore REST API document 格式。
 * @param {Record<string, unknown>} data - 資料物件。
 * @returns {{ fields: Record<string, unknown> }} Firestore 格式。
 */
function toFirestoreDoc(data) {
  /** @type {Record<string, unknown>} */
  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === 'object' && 'timestampValue' in value) {
      fields[key] = value;
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number' && Number.isInteger(value)) {
      fields[key] = { integerValue: String(value) };
    } else if (typeof value === 'number') {
      fields[key] = { doubleValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null) {
      fields[key] = { nullValue: 'NULL_VALUE' };
    }
  }
  return { fields };
}

test.describe('Notification Flow - Post Comment (T037)', () => {
  test('author sees notification after a comment notification is created', async ({ page }) => {
    // Step 1: Seed a notification for the post author via REST API
    // Use signInAndGetToken only to obtain UIDs; seeding uses `Bearer owner`
    // (emulator admin token) to bypass security rules — the notification
    // create rule enforces `createdAt == request.time` which rejects
    // client-provided timestamps.
    const { localId: participantUid } = await signInAndGetToken(
      'test-participant@example.com',
      'test-password',
    );
    const { localId: authorUid } = await signInAndGetToken(
      'test-author@example.com',
      'test-password',
    );

    // Seed a comment doc directly (Bearer owner bypasses rules)
    const commentId = 'test-comment-e2e';
    const commentUrl = `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/posts/test-post-notif/comments/${commentId}`;
    const adminHeaders = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
    await fetch(commentUrl, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify(
        toFirestoreDoc({
          authorUid: participantUid,
          authorName: 'Test Participant',
          authorImgURL: '',
          comment: 'E2E seeded comment',
          createdAt: { timestampValue: new Date().toISOString() },
        }),
      ),
    });

    // Seed a notification for the author (as if notifyPostNewComment ran)
    const notifUrl = `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/notifications/test-comment-notif-e2e`;
    await fetch(notifUrl, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify(
        toFirestoreDoc({
          recipientUid: authorUid,
          type: 'post_new_comment',
          actorUid: participantUid,
          actorName: 'Test Participant',
          actorPhotoURL: '',
          entityType: 'post',
          entityId: 'test-post-notif',
          entityTitle: 'E2E 通知測試文章',
          commentId,
          message: '你的文章『E2E 通知測試文章』有一則新的留言',
          read: false,
          createdAt: { timestampValue: new Date().toISOString() },
        }),
      ),
    });

    // Step 2: Login as author and verify notification
    await loginAsUser(page, 'test-author@example.com', 'test-password');

    // Wait for unread badge
    const bellButton = page.locator('[aria-controls="notification-panel"]');
    await expect(page.locator('[class*="badge"]')).toBeVisible({ timeout: 30000 });

    // Step 3: Open panel and verify notification
    await bellButton.click();
    const panel = page.getByRole('region', { name: /通知面板/i });
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/新的留言/i)).toBeVisible();

    // Step 4: Click notification → navigates to post
    const notifItem = panel.locator('button').filter({ hasText: /新的留言/i });
    await notifItem.click();

    await expect(page).toHaveURL(/\/posts\/test-post-notif/);
    await expect(page).toHaveURL(/commentId=/);

    // Step 5: Panel should close
    await expect(panel).not.toBeVisible();

    // Step 6: Verify scroll-to-comment — the seeded comment element should be visible
    const commentEl = page.locator(`#${commentId}`);
    await expect(commentEl).toBeVisible({ timeout: 10000 });

    // Step 7: Verify highlight class is applied (300ms delay in PostDetailClient)
    await expect(commentEl).toHaveClass(/commentHighlight/, { timeout: 5000 });
  });
});
