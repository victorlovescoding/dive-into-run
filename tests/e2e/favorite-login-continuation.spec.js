import { expect, test } from '@playwright/test';
import admin from 'firebase-admin';

const PROJECT_ID = 'dive-into-run';
const AUTH_EMULATOR_ORIGIN = process.env.FIREBASE_AUTH_EMULATOR_ORIGIN
  || 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR_ORIGIN = process.env.FIRESTORE_EMULATOR_ORIGIN
  || 'http://127.0.0.1:8080';
const DIALOG_TITLE = '登入後即可收藏';
const EVENT_ID = 'e2e-event-a';
const POST_ID = 'e2e-post-a';
const SECOND_POST_ID = 'e2e-post-b';
const COMMENT_ID = 'e2e-comment-a';
const SIGN_IN_CLOSE_TIMEOUT_MS = 30_000;
const SIGN_IN_SUBMIT_ATTEMPT_TIMEOUT_MS = 5_000;
const EMULATOR_RESET_ATTEMPTS = 30;
const EMULATOR_RESET_RETRY_MS = 500;

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.GCLOUD_PROJECT ||= PROJECT_ID;

if (!admin.apps.length) {
  admin.initializeApp({ projectId: PROJECT_ID });
}

const db = admin.firestore();

function timestamp(isoString) {
  return admin.firestore.Timestamp.fromDate(new Date(isoString));
}

function favoriteDialog(page) {
  return page.getByRole('dialog', { name: DIALOG_TITLE });
}

function eventFavoriteButton(page, eventTitle = 'E2E 活動收藏接續') {
  return page.getByRole('button', { name: `收藏活動：${eventTitle}` });
}

function postFavoriteButton(page) {
  return page.getByRole('button', { name: '收藏文章' }).first();
}

function activePostFavoriteButton(page) {
  return page.getByRole('button', { name: '取消收藏文章' }).first();
}

async function deleteEmulatorData(url) {
  let lastError;

  for (let attempt = 1; attempt <= EMULATOR_RESET_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'DELETE' });
      if (response.ok) {
        return;
      }
      lastError = new Error(
        `Failed to clear emulator data: ${response.status} ${await response.text()}`,
      );
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, EMULATOR_RESET_RETRY_MS);
    });
  }

  throw lastError;
}

async function resetEmulators() {
  await Promise.all([
    deleteEmulatorData(`${AUTH_EMULATOR_ORIGIN}/emulator/v1/projects/${PROJECT_ID}/accounts`),
    deleteEmulatorData(
      `${FIRESTORE_EMULATOR_ORIGIN}/emulator/v1/projects/${PROJECT_ID}`
        + '/databases/(default)/documents',
    ),
  ]);
}

async function seedBaseDocuments() {
  const eventTime = timestamp('2026-07-20T01:00:00Z');
  const eventDeadline = timestamp('2026-07-19T01:00:00Z');
  const postAt = timestamp('2026-07-18T01:00:00Z');
  const earlierPostAt = timestamp('2026-07-17T01:00:00Z');

  await Promise.all([
    db.collection('users').doc('host-user').set({
      uid: 'host-user',
      name: 'Host Runner',
      email: 'host@example.test',
      photoURL: '',
      accountStatus: 'active',
      createdAt: earlierPostAt,
    }),
    db.collection('users').doc('author-user').set({
      uid: 'author-user',
      name: 'Author Runner',
      email: 'author@example.test',
      photoURL: '',
      accountStatus: 'active',
      createdAt: earlierPostAt,
    }),
    db.collection('users').doc('comment-user').set({
      uid: 'comment-user',
      name: 'Comment Runner',
      email: 'comment@example.test',
      photoURL: '',
      accountStatus: 'active',
      createdAt: earlierPostAt,
    }),
    db.collection('events').doc(EVENT_ID).set({
      title: 'E2E 活動收藏接續',
      city: '臺北市',
      district: '大安區',
      meetPlace: '大安森林公園',
      distanceKm: 5,
      maxParticipants: 8,
      participantsCount: 1,
      remainingSeats: 7,
      paceSec: 360,
      time: eventTime,
      registrationDeadline: eventDeadline,
      hostUid: 'host-user',
      hostName: 'Host Runner',
      hostPhotoURL: '',
      createdAt: earlierPostAt,
    }),
    db.collection('posts').doc(POST_ID).set({
      title: 'e2e post continuation',
      content: 'This seeded post exercises favorite continuation in browser.',
      authorUid: 'author-user',
      authorName: 'Author Runner',
      authorImgURL: '',
      postAt,
      likesCount: 0,
      commentsCount: 1,
    }),
    db.collection('posts').doc(SECOND_POST_ID).set({
      title: 'e2e post continuation second',
      content: 'This second seeded post keeps search results from being single-item only.',
      authorUid: 'author-user',
      authorName: 'Author Runner',
      authorImgURL: '',
      postAt: earlierPostAt,
      likesCount: 0,
      commentsCount: 0,
    }),
    db.collection('posts').doc(POST_ID).collection('comments').doc(COMMENT_ID).set({
      authorUid: 'comment-user',
      authorName: 'Comment Runner',
      authorImgURL: '',
      comment: 'Seeded comment for continuation exclusion coverage.',
      createdAt: postAt,
    }),
  ]);
}

async function seedMemberFavorite(uid) {
  await db.collection('users').doc(uid).collection('favoritePosts').doc(POST_ID).set({
    targetId: POST_ID,
    createdAt: timestamp('2026-07-19T01:00:00Z'),
  });
}

async function resetAndSeed() {
  await resetEmulators();
  await seedBaseDocuments();
}

async function waitForNoPopup(page, timeout = 700) {
  const popup = await page.waitForEvent('popup', { timeout }).catch(() => null);
  expect(popup).toBeNull();
}

async function completeAuthEmulatorGooglePopup(popup) {
  await popup.bringToFront();
  await popup.waitForLoadState('domcontentloaded');
  const addAccountButton = popup.locator('button').filter({ hasText: /Add new account/i })
    .first();
  await expect(addAccountButton).toBeVisible();
  await addAccountButton.click();

  const autoGenerateButton = popup.locator('button')
    .filter({ hasText: /Auto-generate user information/i })
    .first();
  await expect(autoGenerateButton).toBeEnabled();
  await autoGenerateButton.click();

  const accountInputs = popup.locator('input');
  await expect(accountInputs.nth(0)).not.toHaveValue('');

  const submitButton = popup.locator('button[type="submit"]')
    .filter({ hasText: /Sign in with Google\.com/i })
    .first();
  await expect(submitButton).toBeEnabled();
  const deadline = Date.now() + SIGN_IN_CLOSE_TIMEOUT_MS;
  while (!popup.isClosed() && Date.now() < deadline) {
    await popup.bringToFront();
    const closed = popup.waitForEvent('close', { timeout: SIGN_IN_SUBMIT_ATTEMPT_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    await submitButton.click({ force: true });
    if (await closed) return;
  }

  if (!popup.isClosed()) {
    const popupUrl = popup.url();
    const popupText = await popup.locator('body').innerText({ timeout: 1_000 }).catch(() => '');
    const inputDump = await popup.locator('input').evaluateAll((inputs) =>
      inputs.map((input) => ({
        type: input.type,
        name: input.getAttribute('name'),
        ariaLabel: input.getAttribute('aria-label'),
        placeholder: input.getAttribute('placeholder'),
        value: input.value,
      }))).catch(() => []);
    const buttonDump = await popup.locator('button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        type: button.getAttribute('type'),
        disabled: button.disabled,
        text: button.textContent?.trim(),
      }))).catch(() => []);
    const formCount = await popup.locator('form').count().catch(() => 0);
    throw new Error(
      `Sign-in popup did not close after submit retries.\n`
      + `Popup URL: ${popupUrl}\nPopup body: ${popupText}\n`
      + `Popup inputs: ${JSON.stringify(inputDump)}\n`
      + `Popup buttons: ${JSON.stringify(buttonDump)}\n`
      + `Popup forms: ${formCount}`,
    );
  }
}

async function clickGoogleContinuationAndComplete(page) {
  const popupPromise = page.waitForEvent('popup');
  await favoriteDialog(page).getByRole('button', { name: '使用 Google 登入' }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/providerId=google\.com/);
  await expect(popup).toHaveURL(/authType=signInViaPopup/);
  await completeAuthEmulatorGooglePopup(popup);
}

async function signInWithNavbar(page) {
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '登入' }).first().click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/providerId=google\.com/);
  await completeAuthEmulatorGooglePopup(popup);
  await expect(page.getByRole('button', { name: '使用者選單' })).toBeVisible();
}

async function getSignedInUserUidFromFirestore() {
  const snapshot = await db.collection('users').get();
  const seededUids = new Set(['host-user', 'author-user', 'comment-user']);
  const signedInUsers = snapshot.docs.filter((doc) => !seededUids.has(doc.id));
  expect(signedInUsers).toHaveLength(1);
  return signedInUsers[0].id;
}

async function expectNoContinuation(page) {
  await expect(favoriteDialog(page)).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page).not.toHaveURL(/\/login(?:[/?#]|$)/);
}

async function mockWeatherApi(page) {
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).pathname !== '/api/weather') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        data: {
          locationName: '臺北市',
          locationNameShort: '臺北',
          today: {
            currentTemp: 26,
            weatherDesc: '晴',
            weatherCode: '01',
            morningTemp: 25,
            eveningTemp: 22,
            rainProb: 10,
            humidity: 60,
            uv: { value: 4, level: '中量級' },
            aqi: { value: 35, status: '良好' },
          },
          tomorrow: {
            weatherDesc: '多雲',
            weatherCode: '02',
            morningTemp: 27,
            eveningTemp: 23,
            rainProb: 20,
            humidity: 62,
            uv: { value: 5, level: '中量級' },
          },
        },
      }),
    });
  });
}

async function seedWeatherLocation(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('dive-weather-last-location', JSON.stringify({
      countyCode: '63000',
      countyName: '台北市',
      townshipCode: null,
      townshipName: null,
      displaySuffix: null,
    }));
  });
}

test.beforeEach(async () => {
  await resetAndSeed();
});

test('unauthenticated event favorite opens continuation only after click and Google primary completes the add-only flow', async ({ page }) => {
  await page.goto('/events');
  await expect(page.getByText('E2E 活動收藏接續')).toBeVisible();

  await eventFavoriteButton(page).click();
  await expect(favoriteDialog(page)).toContainText('登入後會自動將這個活動加入收藏。');
  await expect(favoriteDialog(page)).not.toContainText('E2E 活動收藏接續');
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await waitForNoPopup(page);

  await clickGoogleContinuationAndComplete(page);

  await expect(page.getByRole('button', { name: '取消收藏活動：E2E 活動收藏接續' }))
    .toBeVisible();
  await expect(page.getByText('登入成功，已加入收藏')).toBeVisible();
  await expect(favoriteDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/events$/);
});

test('post list, search, and detail routes open post continuation; reload clears pending intent', async ({ page }) => {
  await page.goto('/posts');
  await expect(page.getByRole('link', { name: 'e2e post continuation', exact: true }))
    .toBeVisible();

  await postFavoriteButton(page).click();
  await expect(favoriteDialog(page)).toContainText('登入後會自動將這篇文章加入收藏。');
  await expect(favoriteDialog(page)).not.toContainText('e2e post continuation');
  await waitForNoPopup(page);

  await page.reload();
  await expect(favoriteDialog(page)).toHaveCount(0);

  await page.goto('/posts/search?q=e2e');
  await expect(page.getByRole('link', { name: 'e2e post continuation', exact: true }))
    .toBeVisible();
  await postFavoriteButton(page).click();
  await expect(favoriteDialog(page)).toContainText('登入後會自動將這篇文章加入收藏。');
  await favoriteDialog(page).getByRole('button', { name: '稍後再說' }).click();
  await expect(favoriteDialog(page)).toHaveCount(0);

  await page.goto(`/posts/${POST_ID}`);
  await expect(page.getByText('This seeded post exercises favorite continuation in browser.'))
    .toBeVisible();
  await postFavoriteButton(page).click();
  await expect(favoriteDialog(page)).toContainText('登入後會自動將這篇文章加入收藏。');
});

test('signed-in event and post favorites use existing toggle behavior without continuation dialog', async ({ page }) => {
  await page.goto('/events');
  await signInWithNavbar(page);

  await eventFavoriteButton(page).click();
  await expect(page.getByRole('button', { name: '取消收藏活動：E2E 活動收藏接續' }))
    .toBeVisible();
  await expect(page.getByText('已加入收藏')).toBeVisible();
  await waitForNoPopup(page);
  await expectNoContinuation(page);

  await page.goto('/posts');
  await expect(page.getByRole('link', { name: 'e2e post continuation', exact: true }))
    .toBeVisible();
  await postFavoriteButton(page).click();
  await expect(activePostFavoriteButton(page)).toBeVisible();
  await expect(page.getByText('已加入收藏')).toBeVisible();
  await expectNoContinuation(page);
});

test('excluded unauthenticated surfaces smoke: weather, likes, event participation, runs, and non-listed routes do not render continuation', async ({ page }) => {
  await mockWeatherApi(page);
  await seedWeatherLocation(page);
  const weatherResponsePromise = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/weather',
  );
  await page.goto('/weather');
  await weatherResponsePromise;
  await expect(page.getByText('臺北市')).toBeVisible();
  await expect(page.getByRole('button', { name: '加入收藏' })).toBeVisible();
  await page.getByRole('button', { name: '加入收藏' }).click();
  await expect(page.getByText('請先登入才能收藏')).toBeVisible();
  await expectNoContinuation(page);

  await page.goto('/posts');
  await expect(page.getByRole('link', { name: 'e2e post continuation', exact: true }))
    .toBeVisible();
  await page.getByRole('button', { name: '按讚' }).first().click();
  await expect(page.getByText('請先登入才能按讚')).toBeVisible();
  await expectNoContinuation(page);

  await page.goto('/events');
  await expect(page.getByText('加入活動前請先登入')).toBeVisible();
  await expectNoContinuation(page);

  await page.goto('/runs');
  await expect(page.getByRole('heading', { name: '請先登入以查看跑步紀錄' })).toBeVisible();
  await expectNoContinuation(page);

  await page.goto('/');
  await expectNoContinuation(page);
});

test('excluded signed-in surfaces smoke: member favorites, comments, report menus, post composer, and runs do not render continuation', async ({ page }) => {
  await page.goto('/posts');
  await signInWithNavbar(page);
  const uid = await getSignedInUserUidFromFirestore();
  await seedMemberFavorite(uid);

  await page.goto('/member/favorites');
  await expect(page.getByRole('heading', { name: '我的收藏' })).toBeVisible();
  await expect(page.getByText('e2e post continuation')).toBeVisible();
  await page.getByRole('button', { name: `移除收藏 ${POST_ID}` }).click();
  await expect(page.getByText('已取消收藏')).toBeVisible();
  await expectNoContinuation(page);

  await page.goto('/posts');
  await page.getByRole('button', { name: /分享你的跑步故事/ }).click();
  await expect(page.getByText('發表文章')).toBeVisible();
  await expectNoContinuation(page);

  await page.goto('/posts');
  await page.getByRole('button', { name: '更多選項' }).first().click();
  await page.getByRole('menuitem', { name: '檢舉文章' }).click();
  await expect(page.getByRole('dialog', { name: '檢舉這篇文章' })).toBeVisible();
  await expect(favoriteDialog(page)).toHaveCount(0);

  await page.goto(`/posts/${POST_ID}`);
  await expect(page.getByRole('group', { name: '留言輸入區' })).toBeVisible();
  await page.getByRole('textbox', { name: '留言' }).fill('Signed-in comment smoke');
  await page.getByRole('button', { name: '送出留言' }).click();
  await expectNoContinuation(page);

  await page.getByRole('button', { name: '更多操作' }).first().click();
  await page.getByRole('menuitem', { name: '檢舉留言' }).click();
  await expect(page.getByRole('dialog', { name: '檢舉這則留言' })).toBeVisible();
  await expect(favoriteDialog(page)).toHaveCount(0);

  await page.goto('/runs');
  await expectNoContinuation(page);
});
