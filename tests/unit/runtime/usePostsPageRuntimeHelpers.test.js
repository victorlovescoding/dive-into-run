import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createPostSearchMatch,
  createPostSearchPost,
  POST_SEARCH_VIEWER_UID,
} from '../../_helpers/posts-search-fixtures';

vi.mock('@/config/client/firebase-client', () => ({
  auth: {},
  db: {},
  provider: {},
  storage: {},
}));

/**
 * @typedef {{ post: Record<string, unknown>, snippet?: string }} PostSearchMatchForTest
 */

/** @type {Record<string, (...args: Array<unknown>) => unknown>} */
let postsPageRuntimeHelpers = {};

beforeAll(async () => {
  postsPageRuntimeHelpers = /** @type {Record<string, (...args: Array<unknown>) => unknown>} */ (
    await import('@/runtime/hooks/usePostsPageRuntimeHelpers')
  );
});

/**
 * Resolves future search helper exports dynamically so this TDD RED test fails
 * in Vitest until T009 implements the helper contract.
 * @param {string} name - Runtime helper export name.
 * @returns {(...args: Array<unknown>) => unknown} Runtime helper function.
 */
function getPostsPageRuntimeHelper(name) {
  const helper = Reflect.get(postsPageRuntimeHelpers, name);
  expect(typeof helper).toBe('function');
  return /** @type {(...args: Array<unknown>) => unknown} */ (helper);
}

/**
 * @param {PostSearchMatchForTest[]} matches - Search matches to hydrate.
 * @param {string | null} userUid - Current viewer uid.
 * @param {Set<string>} [likedPostIds] - Liked post ids.
 * @param {Set<string>} [favoritePostIds] - Favorite post ids.
 * @returns {PostSearchMatchForTest[]} Hydrated search matches.
 */
function hydratePostSearchMatches(
  matches,
  userUid,
  likedPostIds = new Set(),
  favoritePostIds = new Set(),
) {
  return /** @type {PostSearchMatchForTest[]} */ (
    getPostsPageRuntimeHelper('hydratePostSearchMatches')(
      matches,
      userUid,
      likedPostIds,
      favoritePostIds,
    )
  );
}

/**
 * @param {PostSearchMatchForTest[]} previousMatches - Existing search matches.
 * @param {PostSearchMatchForTest[]} nextMatches - Incoming search matches.
 * @returns {PostSearchMatchForTest[]} Merged search matches.
 */
function mergeUniquePostSearchMatches(previousMatches, nextMatches) {
  return /** @type {PostSearchMatchForTest[]} */ (
    getPostsPageRuntimeHelper('mergeUniquePostSearchMatches')(previousMatches, nextMatches)
  );
}

/**
 * @param {PostSearchMatchForTest[]} matches - Existing search matches.
 * @param {string} postId - Target post id.
 * @param {boolean} liked - Target liked state.
 * @param {number} likesCount - Target likes count.
 * @returns {PostSearchMatchForTest[]} Updated search matches.
 */
function applyPostSearchMatchLikeState(matches, postId, liked, likesCount) {
  return /** @type {PostSearchMatchForTest[]} */ (
    getPostsPageRuntimeHelper('applyPostSearchMatchLikeState')(
      matches,
      postId,
      liked,
      likesCount,
    )
  );
}

/**
 * @param {PostSearchMatchForTest[]} matches - Existing search matches.
 * @param {string} postId - Target post id.
 * @param {boolean} isFavorited - Target favorite state.
 * @returns {PostSearchMatchForTest[]} Updated search matches.
 */
function applyPostSearchMatchFavoriteState(matches, postId, isFavorited) {
  return /** @type {PostSearchMatchForTest[]} */ (
    getPostsPageRuntimeHelper('applyPostSearchMatchFavoriteState')(matches, postId, isFavorited)
  );
}

/**
 * @param {PostSearchMatchForTest[]} matches - Existing search matches.
 * @param {string} postId - Target post id.
 * @returns {PostSearchMatchForTest[]} Remaining search matches.
 */
function removePostSearchMatchByPostId(matches, postId) {
  return /** @type {PostSearchMatchForTest[]} */ (
    getPostsPageRuntimeHelper('removePostSearchMatchByPostId')(matches, postId)
  );
}

describe('hydratePostSearchMatches', () => {
  it('hydrates nested search result posts with liked, favorite, and author flags', () => {
    const authorPost = createPostSearchPost({
      id: 'post-search-owned',
      authorUid: POST_SEARCH_VIEWER_UID,
    });
    const likedPost = createPostSearchPost({
      id: 'post-search-liked',
      authorUid: 'another-runner',
    });
    const favoritePost = createPostSearchPost({
      id: 'post-search-favorited',
      authorUid: 'another-runner',
    });
    const matches = [
      createPostSearchMatch({ post: authorPost }),
      createPostSearchMatch({ post: likedPost }),
      createPostSearchMatch({ post: favoritePost }),
    ];

    const hydrated = hydratePostSearchMatches(
      matches,
      POST_SEARCH_VIEWER_UID,
      new Set([likedPost.id]),
      new Set([favoritePost.id]),
    );

    expect(hydrated).toEqual([
      expect.objectContaining({
        post: expect.objectContaining({
          id: authorPost.id,
          liked: false,
          isFavorited: false,
          isAuthor: true,
        }),
      }),
      expect.objectContaining({
        post: expect.objectContaining({
          id: likedPost.id,
          liked: true,
          isFavorited: false,
          isAuthor: false,
        }),
      }),
      expect.objectContaining({
        post: expect.objectContaining({
          id: favoritePost.id,
          liked: false,
          isFavorited: true,
          isAuthor: false,
        }),
      }),
    ]);
  });

  it('treats anonymous viewers as non-author with no liked or favorite flags', () => {
    const post = createPostSearchPost({ id: 'post-search-anonymous' });

    expect(hydratePostSearchMatches([createPostSearchMatch({ post })], null)).toEqual([
      expect.objectContaining({
        post: expect.objectContaining({
          id: post.id,
          liked: false,
          isFavorited: false,
          isAuthor: false,
        }),
      }),
    ]);
  });
});

describe('mergeUniquePostSearchMatches', () => {
  it('appends load-more matches after deduping by nested post id', () => {
    const firstPost = createPostSearchPost({ id: 'post-search-first' });
    const duplicatePost = createPostSearchPost({ id: 'post-search-duplicate' });
    const newPost = createPostSearchPost({ id: 'post-search-new' });
    const previousMatches = [
      createPostSearchMatch({ post: firstPost }),
      createPostSearchMatch({ post: duplicatePost, snippet: 'kept previous snippet' }),
    ];
    const nextMatches = [
      createPostSearchMatch({ post: duplicatePost, snippet: 'discard duplicate snippet' }),
      createPostSearchMatch({ post: newPost }),
    ];

    const merged = mergeUniquePostSearchMatches(previousMatches, nextMatches);

    expect(merged.map((match) => match.post.id)).toEqual([
      firstPost.id,
      duplicatePost.id,
      newPost.id,
    ]);
    expect(merged[1].snippet).toBe('kept previous snippet');
  });
});

describe('post search match interaction helpers', () => {
  it('updates liked state and likesCount on the matched nested post only', () => {
    const targetPost = createPostSearchPost({
      id: 'post-search-like-target',
      likesCount: 2,
    });
    const otherPost = createPostSearchPost({
      id: 'post-search-like-other',
      likesCount: 7,
    });
    const matches = [
      createPostSearchMatch({ post: targetPost }),
      createPostSearchMatch({ post: otherPost }),
    ];

    const updated = applyPostSearchMatchLikeState(matches, targetPost.id, true, 3);

    expect(updated[0].post).toMatchObject({
      id: targetPost.id,
      liked: true,
      likesCount: 3,
    });
    expect(updated[1].post).toMatchObject({
      id: otherPost.id,
      likesCount: 7,
    });
    expect(updated[1].post).not.toHaveProperty('liked', true);
  });

  it('updates favorite state on the matched nested post only', () => {
    const targetPost = createPostSearchPost({ id: 'post-search-favorite-target' });
    const otherPost = createPostSearchPost({ id: 'post-search-favorite-other' });
    const matches = [
      createPostSearchMatch({ post: targetPost }),
      createPostSearchMatch({ post: otherPost }),
    ];

    const updated = applyPostSearchMatchFavoriteState(matches, targetPost.id, true);

    expect(updated[0].post).toMatchObject({
      id: targetPost.id,
      isFavorited: true,
    });
    expect(updated[1].post).toMatchObject({
      id: otherPost.id,
    });
    expect(updated[1].post).not.toHaveProperty('isFavorited', true);
  });
});

describe('removePostSearchMatchByPostId', () => {
  it('removes a search result by nested post id while preserving other match metadata', () => {
    const removedPost = createPostSearchPost({ id: 'post-search-remove-target' });
    const keptPost = createPostSearchPost({ id: 'post-search-remove-kept' });
    const keptMatch = createPostSearchMatch({
      post: keptPost,
      snippet: 'metadata should survive removal',
    });

    const remaining = removePostSearchMatchByPostId(
      [createPostSearchMatch({ post: removedPost }), keptMatch],
      removedPost.id,
    );

    expect(remaining).toEqual([keptMatch]);
  });
});
