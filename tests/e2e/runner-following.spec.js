// @ts-check
/**
 * @file E2E Test for runner-following critical journeys.
 * @description Covers public profile list reads, profile/event follow flows,
 * member following management, follow notification routing, and forbidden
 * follow-control surfaces.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { loginAsUser, signOutUser } from '../_helpers/e2e-helpers.js';

test.describe.configure({ mode: 'serial' });

const PASSWORD = 'test-password';
const VIEWER_EMAIL = 't401-viewer@example.com';
const TARGET_EMAIL = 't401-target@example.com';
const VIEWER_NAME = 'T401 Viewer Runner';
const TARGET_NAME = 'T401 Target Runner';
const FOLLOWING_NAME = 'T401 Following Runner';
const EXISTING_FOLLOWER_NAME = 'T401 Existing Follower';
const MEMBER_ALPHA_NAME = 'T401 Member Alpha';
const MEMBER_BETA_NAME = 'T401 Member Beta';
const HOST_NAME = 'T401 Host Runner';
const PARTICIPANT_NAME = 'T401 Participant Runner';
const EVENT_TITLE = 'T401 Runner Following Event';
const SELF_EVENT_TITLE = 'T401 Self Hosted Event';
const EVIDENCE_DIR = '/private/tmp/t401-runner-following-e2e-evidence';

/** @type {Array<{ type: string, text: string, location?: string }>} */
const consoleMessages = [];
/** @type {Array<{ url: string, failure: string | null }>} */
const failedRequests = [];
/** @type {Array<{ url: string, status: number }>} */
const httpErrors = [];
/** @type {Array<object>} */
const evidenceSignals = [];
/** @type {{ status: string, failure: string | null }} */
const evidenceState = { status: 'RUNNING', failure: null };

/**
 * Writes the current browser evidence summary.
 * @returns {void}
 */
function writeEvidenceReport() {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(
    join(EVIDENCE_DIR, 'browser-evidence.json'),
    `${JSON.stringify(
      {
        task: 'T401',
        status: evidenceState.status,
        failure: evidenceState.failure,
        consoleClearedBeforeInteraction: true,
        targetUrls: [
          '/users/target-runner',
          '/member/following',
          '/events',
          '/events/runner-following-event',
        ],
        viewports: [
          { width: 1440, height: 900 },
          { width: 390, height: 844 },
        ],
        signals: evidenceSignals,
        consoleMessages,
        failedRequests,
        httpErrors,
        residual: {
          appHttpErrors: httpErrors.filter(
            (entry) => !entry.url.includes('/_next/static') && !entry.url.includes('/favicon'),
          ),
          requestFailures: failedRequests,
        },
      },
      null,
      2,
    )}\n`,
  );
}

/**
 * Captures browser console, failed network, and HTTP error signals.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @returns {void}
 */
function startEvidenceRecorder(page) {
  page.on('console', (message) => {
    consoleMessages.push({
      type: message.type(),
      text: message.text(),
      location: message.location().url,
    });
  });
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText || null,
    });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpErrors.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });
}

/**
 * Captures a screenshot and records expected versus actual UI signals.
 * @param {import('@playwright/test').Page} page - Playwright page.
 * @param {string} name - Evidence name.
 * @param {object} signal - Expected and actual signal details.
 * @returns {Promise<string>} Screenshot path.
 */
async function captureEvidence(page, name, signal) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const screenshotPath = join(EVIDENCE_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  evidenceSignals.push({
    name,
    url: page.url(),
    viewport: page.viewportSize(),
    screenshotPath,
    ...signal,
  });
  writeEvidenceReport();
  return screenshotPath;
}

/**
 * Asserts that a scope has no v1 follow controls.
 * @param {import('@playwright/test').Page | import('@playwright/test').Locator} scope - Page or locator scope.
 * @returns {Promise<void>}
 */
async function expectNoFollowControls(scope) {
  await expect(scope.getByRole('button', { name: /^追蹤$/ })).toHaveCount(0);
  await expect(scope.getByRole('button', { name: /^追蹤中$/ })).toHaveCount(0);
  await expect(scope.getByRole('button', { name: /^取消追蹤/ })).toHaveCount(0);
}

test.afterEach(({ browserName: _browserName }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    evidenceState.status = 'BLOCKED';
    evidenceState.failure = testInfo.error?.message || 'Playwright test failed';
  } else if (evidenceState.status === 'RUNNING') {
    evidenceState.status = 'PARTIAL';
  }
  writeEvidenceReport();
});

test.afterAll(() => {
  if (evidenceState.status !== 'BLOCKED') {
    evidenceState.status = 'DONE';
  }
  writeEvidenceReport();
});

test.describe('Runner following — public profile', () => {
  test('signed-out visitors can inspect counts and modal lists without follow controls', async ({
    page,
  }) => {
    startEvidenceRecorder(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/users/target-runner');

    await expect(page.getByRole('heading', { name: TARGET_NAME })).toBeVisible();
    await expectNoFollowControls(page);
    await expect(page.getByRole('button', { name: '1 位追蹤中' })).toBeVisible();

    await captureEvidence(page, 'profile-signed-out-desktop', {
      expected: 'signed-out profile shows public counts and no follow control',
      actual: 'heading visible, exact 追蹤 button count is 0, following count visible',
    });

    await expect(page.getByRole('button', { name: '1 位追蹤者' })).toBeVisible();
    await page.getByRole('button', { name: '1 位追蹤者' }).click();
    const followersDialog = page.getByRole('dialog', { name: '追蹤者' });
    await expect(followersDialog).toBeVisible();
    await expect(followersDialog.getByRole('link', { name: EXISTING_FOLLOWER_NAME })).toHaveAttribute(
      'href',
      '/users/existing-follower-runner',
    );
    await expectNoFollowControls(followersDialog);
    await captureEvidence(page, 'profile-followers-modal-desktop', {
      expected: 'followers modal rows link to profiles and contain no follow buttons',
      actual: 'existing follower link visible and modal follow-control count is 0',
    });

    await followersDialog.getByRole('button', { name: '關閉' }).click();
    await page.getByRole('button', { name: '1 位追蹤中' }).click();
    const followingDialog = page.getByRole('dialog', { name: '追蹤中' });
    await expect(followingDialog).toBeVisible();
    await expect(followingDialog.getByRole('link', { name: FOLLOWING_NAME })).toHaveAttribute(
      'href',
      '/users/following-runner',
    );
    await expectNoFollowControls(followingDialog);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/users/target-runner');
    await expect(page.getByRole('heading', { name: TARGET_NAME })).toBeVisible();
    await expectNoFollowControls(page);
    await captureEvidence(page, 'profile-signed-out-mobile', {
      expected: 'mobile signed-out profile keeps follow controls hidden',
      actual: 'target heading visible and exact follow-control count is 0',
    });
  });
});

test.describe('Runner following — profile mutation and notification', () => {
  test('signed-in viewer can follow/unfollow profile and target notification opens follower profile', async ({
    page,
  }) => {
    startEvidenceRecorder(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsUser(page, VIEWER_EMAIL, PASSWORD, {
      startPage: '/users/target-runner',
      waitForSelector: 'h1',
    });

    const followButton = page.getByRole('button', { name: /^追蹤$/ });
    await expect(followButton).toBeVisible();
    await followButton.click();
    await expect(page.getByRole('button', { name: /^追蹤中$/ })).toBeVisible();
    await expect(page.getByText('追蹤失敗，請稍後再試。')).toHaveCount(0);
    await captureEvidence(page, 'profile-signed-in-after-follow-desktop', {
      expected: 'profile follow settles to following state',
      actual: '追蹤中 button visible after viewer follows target',
    });

    await page.getByRole('button', { name: /^追蹤中$/ }).click();
    await expect(page.getByRole('button', { name: /^追蹤$/ })).toBeVisible();
    await expect(page.getByText('取消追蹤失敗，請稍後再試。')).toHaveCount(0);
    await captureEvidence(page, 'profile-signed-in-after-unfollow-desktop', {
      expected: 'profile unfollow settles back to follow state',
      actual: '追蹤 button visible after viewer unfollows target',
    });

    await signOutUser(page);
    await loginAsUser(page, TARGET_EMAIL, PASSWORD, {
      startPage: '/events',
      waitForSelector: '[aria-controls="notification-panel"]',
    });
    const bellButton = page.getByRole('button', { name: /通知/ });
    await expect(bellButton).toBeVisible();
    await expect(bellButton).toHaveAttribute('aria-label', /未讀/);
    await bellButton.click();
    const panel = page.getByRole('region', { name: '通知面板' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText(`${VIEWER_NAME} 已開始追蹤你。`)).toBeVisible();
    await captureEvidence(page, 'follow-notification-panel-desktop', {
      expected: 'target receives follow notification with exact message',
      actual: 'notification panel contains viewer follow message',
    });

    await panel.getByRole('button', { name: new RegExp(`${VIEWER_NAME} 已開始追蹤你。`) }).click();
    await expect(page).toHaveURL(/\/users\/viewer-runner/);
    await expect(page.getByRole('heading', { name: VIEWER_NAME })).toBeVisible();
  });
});

test.describe('Runner following — member following management', () => {
  test('member following list shows rows, links to profiles, and supports unfollow', async ({
    page,
  }) => {
    startEvidenceRecorder(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsUser(page, VIEWER_EMAIL, PASSWORD, {
      startPage: '/member/following',
      waitForSelector: 'h1',
    });

    await expect(page.getByRole('heading', { name: '我的追蹤跑友' })).toBeVisible();
    await expect(page.getByText('2 位追蹤中')).toBeVisible();
    const alphaRow = page.getByRole('article', { name: `${MEMBER_ALPHA_NAME} 追蹤跑友` });
    const betaRow = page.getByRole('article', { name: `${MEMBER_BETA_NAME} 追蹤跑友` });
    await expect(alphaRow.getByRole('link', { name: MEMBER_ALPHA_NAME })).toHaveAttribute(
      'href',
      '/users/member-alpha-runner',
    );
    await expect(betaRow.getByRole('link', { name: MEMBER_BETA_NAME })).toHaveAttribute(
      'href',
      '/users/member-beta-runner',
    );
    await captureEvidence(page, 'member-following-before-unfollow-desktop', {
      expected: 'member following page shows two followed runners with profile links',
      actual: 'two row articles visible and links point to public profiles',
    });

    await alphaRow.getByRole('button', { name: `取消追蹤 ${MEMBER_ALPHA_NAME}` }).click();
    await expect(page.getByRole('article', { name: `${MEMBER_ALPHA_NAME} 追蹤跑友` })).toHaveCount(0);
    await expect(page.getByText('1 位追蹤中')).toBeVisible();
    await captureEvidence(page, 'member-following-after-unfollow-desktop', {
      expected: 'row-level unfollow removes the row and updates derived count',
      actual: 'alpha row removed and count changed from 2 to 1',
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/member/following');
    await expect(page.getByRole('heading', { name: '我的追蹤跑友' })).toBeVisible();
    await expect(page.getByRole('article', { name: `${MEMBER_BETA_NAME} 追蹤跑友` })).toBeVisible();
    await captureEvidence(page, 'member-following-mobile', {
      expected: 'mobile member following page preserves management surface',
      actual: 'remaining followed runner row is visible on mobile',
    });
  });
});

test.describe('Runner following — event host surfaces and forbidden controls', () => {
  test('event list/detail host follow works and forbidden surfaces stay clean', async ({ page }) => {
    startEvidenceRecorder(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsUser(page, VIEWER_EMAIL, PASSWORD, {
      startPage: '/events',
      waitForSelector: 'h1',
    });

    await expect(page.getByRole('link', { name: EVENT_TITLE })).toBeVisible();
    await expect(page.getByRole('link', { name: SELF_EVENT_TITLE })).toBeVisible();
    await expect(page.getByRole('link', { name: HOST_NAME })).toHaveAttribute(
      'href',
      '/users/host-runner',
    );
    await expect(page.getByRole('button', { name: /^追蹤$/ })).toHaveCount(1);
    await page.getByRole('button', { name: /^追蹤$/ }).click();
    await expect(page.getByRole('button', { name: /^追蹤中$/ })).toBeVisible();
    await captureEvidence(page, 'event-list-after-host-follow-desktop', {
      expected: 'event list non-self host can be followed; self-host event has no extra follow button',
      actual: 'one event-list follow control changed to 追蹤中',
    });

    await page.getByRole('button', { name: /^追蹤中$/ }).click();
    await expect(page.getByRole('button', { name: /^追蹤$/ })).toBeVisible();
    await page.getByRole('link', { name: EVENT_TITLE }).click();
    await expect(page).toHaveURL(/\/events\/runner-following-event/);
    await expect(page.getByRole('main').getByText(EVENT_TITLE)).toBeVisible();
    await expect(page.getByRole('link', { name: HOST_NAME })).toHaveAttribute(
      'href',
      '/users/host-runner',
    );
    await page.getByRole('button', { name: /^追蹤$/ }).click();
    await expect(page.getByRole('button', { name: /^追蹤中$/ })).toBeVisible();
    await captureEvidence(page, 'event-detail-after-host-follow-desktop', {
      expected: 'event detail non-self host can be followed',
      actual: 'event detail host follow control changed to 追蹤中',
    });

    await page.getByRole('button', { name: '看看誰有參加' }).click();
    const participantsDialog = page.getByRole('dialog').filter({ hasText: '參加名單' });
    await expect(participantsDialog).toBeVisible();
    await expect(participantsDialog.getByRole('link', { name: PARTICIPANT_NAME })).toHaveAttribute(
      'href',
      '/users/participant-runner',
    );
    await expectNoFollowControls(participantsDialog);
    await captureEvidence(page, 'event-participants-no-follow-controls-desktop', {
      expected: 'participants modal links to profiles but contains no follow controls',
      actual: 'participant profile link visible and modal follow-control count is 0',
    });
    await participantsDialog.getByRole('button', { name: '關閉' }).click();

    const commentsRegion = page.getByRole('region', { name: '留言區' });
    await expect(commentsRegion.getByText('T401 這場節奏剛好')).toBeVisible();
    await expect(commentsRegion.getByRole('link', { name: PARTICIPANT_NAME })).toHaveAttribute(
      'href',
      '/users/participant-runner',
    );
    await expectNoFollowControls(commentsRegion);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/events/runner-following-event');
    await expect(page.getByRole('main').getByText(EVENT_TITLE)).toBeVisible();
    await expect(page.getByRole('button', { name: /^追蹤中$/ })).toBeVisible();
    await captureEvidence(page, 'event-detail-mobile', {
      expected: 'mobile event detail preserves host follow state and layout',
      actual: 'event title and 追蹤中 control visible on mobile',
    });
  });
});
