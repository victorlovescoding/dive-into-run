/**
 * @file Playwright global setup for Posts UI E2E tests.
 * @description
 * Creates test users and seeds Firestore with test posts.
 */

import {
  verifyEmulatorRunning,
  cleanupEmulator,
  createTestUser,
  seedDoc,
  ts,
} from '../../_helpers/e2e-helpers.js';

/**
 * Playwright global setup: creates test accounts and seeds test posts.
 * @returns {Promise<void>}
 */
export default async function globalSetup() {
  await verifyEmulatorRunning();
  await cleanupEmulator();

  // Create test user
  const { localId: authorUid } = await createTestUser(
    'test-author@example.com',
    'test-password',
    'Test Author',
  );

  // Seed 2 posts owned by test-author
  await seedDoc('posts', 'test-post-1', {
    authorUid,
    authorName: 'Test Author',
    authorImgURL: '',
    title: 'E2E 測試文章一',
    content: '這是第一篇測試文章的內容，用於驗證文章列表顯示。',
    postAt: ts('2026-04-10T10:00:00Z'),
    likesCount: 3,
    commentsCount: 1,
  });

  await seedDoc('posts', 'test-post-2', {
    authorUid,
    authorName: 'Test Author',
    authorImgURL: '',
    title: 'E2E 測試文章二',
    content: '這是第二篇測試文章的內容，用於驗證文章詳細頁功能。',
    postAt: ts('2026-04-11T14:30:00Z'),
    likesCount: 0,
    commentsCount: 0,
  });
}
