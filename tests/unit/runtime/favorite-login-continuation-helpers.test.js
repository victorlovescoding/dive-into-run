// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  buildFavoriteLoginContinuationDialogState,
  createFavoriteLoginContinuationIntent,
  FAVORITE_LOGIN_CONTINUATION_CONTENT_TYPES,
  FAVORITE_LOGIN_CONTINUATION_COPY,
  FAVORITE_LOGIN_CONTINUATION_STATUSES,
  getFavoriteLoginContinuationCopy,
  openFavoriteLoginContinuationIntent,
  setFavoriteLoginContinuationStatus,
} from '@/runtime/favorites/favorite-login-continuation-helpers';
import {
  createFavoriteContinuationIntent,
  createFavoriteContinuationRequest,
  FAVORITE_LOGIN_TEST_COPY,
} from '../../_helpers/favorite-login-continuation-helpers';

describe('favorite login continuation helper copy and normalization', () => {
  it('selects exact event and post dialog copy without target metadata', () => {
    expect(FAVORITE_LOGIN_CONTINUATION_COPY.TITLE).toBe(FAVORITE_LOGIN_TEST_COPY.title);
    expect(FAVORITE_LOGIN_CONTINUATION_COPY.PRIMARY_LABEL).toBe(
      FAVORITE_LOGIN_TEST_COPY.primaryLabel,
    );
    expect(FAVORITE_LOGIN_CONTINUATION_COPY.SECONDARY_LABEL).toBe(
      FAVORITE_LOGIN_TEST_COPY.secondaryLabel,
    );
    expect(getFavoriteLoginContinuationCopy(FAVORITE_LOGIN_CONTINUATION_CONTENT_TYPES.EVENT))
      .toEqual({
        title: FAVORITE_LOGIN_TEST_COPY.title,
        body: FAVORITE_LOGIN_TEST_COPY.eventBody,
        primaryLabel: FAVORITE_LOGIN_TEST_COPY.primaryLabel,
        secondaryLabel: FAVORITE_LOGIN_TEST_COPY.secondaryLabel,
      });
    expect(getFavoriteLoginContinuationCopy(FAVORITE_LOGIN_CONTINUATION_CONTENT_TYPES.POST))
      .toEqual({
        title: FAVORITE_LOGIN_TEST_COPY.title,
        body: FAVORITE_LOGIN_TEST_COPY.postBody,
        primaryLabel: FAVORITE_LOGIN_TEST_COPY.primaryLabel,
        secondaryLabel: FAVORITE_LOGIN_TEST_COPY.secondaryLabel,
      });
  });

  it('normalizes supported targets and rejects unsupported types or empty ids', () => {
    expect(
      createFavoriteLoginContinuationIntent(
        createFavoriteContinuationRequest({
          contentType: 'post',
          targetId: ' post-1 ',
        }),
        { nowMs: () => 123 },
      ),
    ).toEqual({
      contentType: 'post',
      targetId: 'post-1',
      copyKind: 'post',
      status: 'open',
      createdAtMs: 123,
    });

    expect(() =>
      createFavoriteLoginContinuationIntent({
        contentType: 'weather',
        targetId: 'weather-1',
      }),
    ).toThrow('Unsupported favorite continuation content type');
    expect(() =>
      createFavoriteLoginContinuationIntent({
        contentType: 'event',
        targetId: ' ',
      }),
    ).toThrow('Favorite continuation targetId is required');
    expect(() =>
      createFavoriteLoginContinuationIntent({
        contentType: 'post',
        targetId: null,
      }),
    ).toThrow('Favorite continuation targetId is required');
  });
});

describe('favorite login continuation state transitions', () => {
  it('builds closed, open, and pending dialog render state from intent status', () => {
    const openIntent = createFavoriteContinuationIntent();

    expect(buildFavoriteLoginContinuationDialogState(null)).toEqual({
      isOpen: false,
      contentType: null,
      title: FAVORITE_LOGIN_TEST_COPY.title,
      body: '',
      primaryLabel: FAVORITE_LOGIN_TEST_COPY.primaryLabel,
      secondaryLabel: FAVORITE_LOGIN_TEST_COPY.secondaryLabel,
      isSubmitting: false,
    });
    expect(buildFavoriteLoginContinuationDialogState(openIntent)).toMatchObject({
      isOpen: true,
      contentType: 'event',
      body: FAVORITE_LOGIN_TEST_COPY.eventBody,
      isSubmitting: false,
    });
    expect(
      buildFavoriteLoginContinuationDialogState(
        setFavoriteLoginContinuationStatus(
          openIntent,
          FAVORITE_LOGIN_CONTINUATION_STATUSES.AUTHENTICATING,
        ),
      ),
    ).toMatchObject({
      isOpen: true,
      isSubmitting: true,
    });
    expect(
      buildFavoriteLoginContinuationDialogState(
        setFavoriteLoginContinuationStatus(
          openIntent,
          FAVORITE_LOGIN_CONTINUATION_STATUSES.APPLYING_FAVORITE,
        ),
      ),
    ).toMatchObject({
      isOpen: true,
      isSubmitting: true,
    });
  });

  it('guards a single active intent and leaves later open requests unchanged', () => {
    const firstIntent = openFavoriteLoginContinuationIntent(
      null,
      createFavoriteContinuationRequest({ contentType: 'event', targetId: 'event-1' }),
      { nowMs: () => 100 },
    );
    const secondIntent = openFavoriteLoginContinuationIntent(
      firstIntent,
      createFavoriteContinuationRequest({ contentType: 'post', targetId: 'post-2' }),
      { nowMs: () => 200 },
    );

    expect(secondIntent).toBe(firstIntent);
    expect(secondIntent).toMatchObject({
      contentType: 'event',
      targetId: 'event-1',
      createdAtMs: 100,
    });
  });

  it('rejects unknown status transitions', () => {
    expect(() =>
      setFavoriteLoginContinuationStatus(createFavoriteContinuationIntent(), 'persisting'),
    ).toThrow('Unsupported favorite continuation status');
  });
});

describe('favorite login continuation persistence guard', () => {
  it('keeps pending intent in memory only without browser persistence or URL mutation', () => {
    const storageSetItem = vi.spyOn(Storage.prototype, 'setItem');
    const storageRemoveItem = vi.spyOn(Storage.prototype, 'removeItem');
    const historyPushState = vi.spyOn(window.history, 'pushState');
    const historyReplaceState = vi.spyOn(window.history, 'replaceState');
    const cookieBefore = document.cookie;

    const intent = openFavoriteLoginContinuationIntent(
      null,
      createFavoriteContinuationRequest(),
      { nowMs: () => 300 },
    );

    expect(buildFavoriteLoginContinuationDialogState(intent)).toMatchObject({
      isOpen: true,
      body: FAVORITE_LOGIN_TEST_COPY.eventBody,
    });
    expect(storageSetItem).not.toHaveBeenCalled();
    expect(storageRemoveItem).not.toHaveBeenCalled();
    expect(historyPushState).not.toHaveBeenCalled();
    expect(historyReplaceState).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookieBefore);

    storageSetItem.mockRestore();
    storageRemoveItem.mockRestore();
    historyPushState.mockRestore();
    historyReplaceState.mockRestore();
  });

  it('does not reference persistence APIs in the helper source', () => {
    const source = readFileSync(
      `${process.cwd()}/src/runtime/favorites/favorite-login-continuation-helpers.js`,
      'utf8',
    );

    expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|document\.cookie/);
    expect(source).not.toMatch(/Firestore|firebase|globalThis|window\.location/);
  });
});
