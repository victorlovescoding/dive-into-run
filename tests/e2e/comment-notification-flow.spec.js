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
import {
  seedDoc,
  toFirestoreDoc,
  loginAsUser,
  FIRESTORE_EMULATOR_URL,
  PROJECT_ID,
} from '../_helpers/e2e-helpers.js';

test.describe('Notification Flow - Post Comment (T037)', () => {
  test('author sees notification after a comment notification is created', async ({ page }) => {
    // Step 1: Seed a comment + notification for the post author via REST API
    // Use signIn to obtain UIDs; seeding uses `Bearer owner` to bypass rules.

    // Seed a comment doc directly (post comments use `comment` field)
    const commentId = 'test-comment-e2e';
    const adminHeaders = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
    const commentUrl = `${FIRESTORE_EMULATOR_URL}/v1/projects/${PROJECT_ID}/databases/(default)/documents/posts/test-post-notif/comments/${commentId}`;
    await fetch(commentUrl, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify(
        toFirestoreDoc({
          authorUid: 'participant-uid-placeholder',
          authorName: 'Test Participant',
          authorImgURL: '',
          comment: 'E2E seeded comment',
          createdAt: { timestampValue: new Date().toISOString() },
        }),
      ),
    });

    // Seed a notification for the author (as if notifyPostNewComment ran)
    await seedDoc('notifications', 'test-comment-notif-e2e', {
      recipientUid: 'author-uid-placeholder',
      type: 'post_new_comment',
      actorUid: 'participant-uid-placeholder',
      actorName: 'Test Participant',
      actorPhotoURL: '',
      entityType: 'post',
      entityId: 'test-post-notif',
      entityTitle: 'E2E 通知測試文章',
      commentId,
      message: '你的文章『E2E 通知測試文章』有一則新的留言',
      read: false,
      createdAt: { timestampValue: new Date().toISOString() },
    });

    // We need real UIDs — re-seed with correct UIDs from global-setup
    // The global-setup creates users and we need their UIDs.
    // Since we can't access UIDs from global-setup, sign in to get them.
    const authUrl =
      'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key';
    const participantRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-participant@example.com',
        password: 'test-password',
        returnSecureToken: true,
      }),
    });
    const { localId: participantUid } = await participantRes.json();

    const authorRes = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-author@example.com',
        password: 'test-password',
        returnSecureToken: true,
      }),
    });
    const { localId: authorUid } = await authorRes.json();

    // Re-seed with correct UIDs
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

    await seedDoc('notifications', 'test-comment-notif-e2e', {
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
    });

    // Step 2: Login as author and verify notification
    await loginAsUser(page, 'test-author@example.com', 'test-password', {
      startPage: '/posts',
      waitForSelector: '[aria-controls="notification-panel"]',
    });

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
    await expect(commentEl).toBeVisible({ timeout: 15000 });

    // Step 7: Verify highlight class is applied
    await expect(commentEl).toHaveClass(/commentHighlight/, { timeout: 5000 });
  });
});
