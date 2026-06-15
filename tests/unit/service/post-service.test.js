import { beforeAll, describe, expect, it } from 'vitest';
import {
  POST_SEARCH_CHINESE_KEYWORD,
  POST_SEARCH_KEYWORD,
  createPostSearchFixtureSet,
  createPostSearchPost,
  createPostSearchTimestamp,
} from '../../_helpers/posts-search-fixtures';

/** @type {Record<string, (...args: Array<unknown>) => unknown>} */
let postSearchService = {};

beforeAll(async () => {
  postSearchService = /** @type {Record<string, (...args: Array<unknown>) => unknown>} */ (
    await import('@/service/post-service')
  );
});

/**
 * Reads search helper exports dynamically so this TDD RED test fails in Vitest
 * until T006 implements the helper contract.
 * @param {string} name - Search helper export name.
 * @returns {(...args: Array<unknown>) => unknown} Search helper function.
 */
function getPostSearchHelper(name) {
  return postSearchService[name];
}

/**
 * @param {string} rawKeyword - Raw search keyword.
 * @returns {unknown} Normalized keyword contract.
 */
function normalizePostSearchKeyword(rawKeyword) {
  return getPostSearchHelper('normalizePostSearchKeyword')(rawKeyword);
}

/**
 * @param {unknown} post - Candidate post.
 * @param {unknown} keyword - Normalized keyword.
 * @returns {unknown} Post search match or null.
 */
function buildPostSearchMatch(post, keyword) {
  return getPostSearchHelper('buildPostSearchMatch')(post, keyword);
}

/**
 * @param {unknown[]} matches - Unsorted search matches.
 * @returns {unknown[]} Sorted search matches.
 */
function sortPostSearchMatches(matches) {
  return /** @type {unknown[]} */ (getPostSearchHelper('sortPostSearchMatches')(matches));
}

/**
 * @param {unknown[]} posts - Candidate posts.
 * @param {string} rawKeyword - Raw search keyword.
 * @returns {unknown[]} Ranked search matches.
 */
function filterAndRankPostSearchMatches(posts, rawKeyword) {
  return /** @type {unknown[]} */ (
    getPostSearchHelper('filterAndRankPostSearchMatches')(posts, rawKeyword)
  );
}

describe('normalizePostSearchKeyword', () => {
  it('trims keyword input and case-folds English for matching', () => {
    expect(normalizePostSearchKeyword('  ReEf  ')).toEqual({
      rawValue: '  ReEf  ',
      value: 'ReEf',
      caseFoldedValue: 'reef',
    });
  });

  it('treats one trimmed character as a valid keyword', () => {
    expect(normalizePostSearchKeyword(' r ')).toEqual({
      rawValue: ' r ',
      value: 'r',
      caseFoldedValue: 'r',
    });
  });

  it('returns null for blank keyword input after trimming', () => {
    expect(normalizePostSearchKeyword('   ')).toBeNull();
  });
});

describe('buildPostSearchMatch', () => {
  it('classifies title-only, content-only, and title-plus-content hits into the expected tiers', () => {
    const fixture = createPostSearchFixtureSet();
    const keyword = normalizePostSearchKeyword(POST_SEARCH_KEYWORD);

    const titleOnly = buildPostSearchMatch(fixture.posts.titleHitNewest, keyword);
    const contentOnly = buildPostSearchMatch(fixture.posts.contentHit, keyword);
    const titleAndContent = buildPostSearchMatch(fixture.posts.titleAndContentHit, keyword);

    expect(titleOnly).toMatchObject({
      hitType: 'title',
      matchedFields: { title: true, content: false },
      rankKey: { hitTypeRank: 0 },
    });
    expect(contentOnly).toMatchObject({
      hitType: 'content',
      matchedFields: { title: false, content: true },
      rankKey: { hitTypeRank: 1 },
    });
    expect(titleAndContent).toMatchObject({
      hitType: 'title',
      matchedFields: { title: true, content: true },
      rankKey: { hitTypeRank: 0 },
    });
  });

  it('matches title and content only, with English case-insensitive contains', () => {
    const fixture = createPostSearchFixtureSet();
    const titleAndContent = buildPostSearchMatch(
      fixture.posts.titleAndContentHit,
      normalizePostSearchKeyword(' REEF '),
    );
    const authorOnly = buildPostSearchMatch(
      fixture.posts.authorNameOnly,
      normalizePostSearchKeyword(POST_SEARCH_KEYWORD),
    );

    expect(titleAndContent).toMatchObject({
      post: fixture.posts.titleAndContentHit,
      hitType: 'title',
      matchedFields: { title: true, content: true },
      firstMatchIndex: 6,
      rankKey: {
        hitTypeRank: 0,
        postAt: fixture.posts.titleAndContentHit.postAt,
        id: fixture.posts.titleAndContentHit.id,
      },
    });
    expect(authorOnly).toBeNull();
  });

  it('matches Chinese keywords literally without tokenization', () => {
    const fixture = createPostSearchFixtureSet();
    const match = buildPostSearchMatch(
      fixture.posts.chineseContentHit,
      normalizePostSearchKeyword(POST_SEARCH_CHINESE_KEYWORD),
    );

    expect(match).toMatchObject({
      post: fixture.posts.chineseContentHit,
      hitType: 'content',
      matchedFields: { title: false, content: true },
      firstMatchIndex: 6,
    });
    expect(match.snippet).toContain(POST_SEARCH_CHINESE_KEYWORD);
  });

  it('returns content-hit snippets around the first match and highlight ranges for the snippet', () => {
    const content =
      'Opening miles stayed deliberately quiet while the group crossed downtown. ' +
      'The turn before the reef climb finally split the pack into small groups. ' +
      'Cooldown notes came later after everyone regrouped.';
    const post = createPostSearchPost({
      id: 'post-search-long-content',
      title: 'Harbor progression',
      content,
    });
    const match = buildPostSearchMatch(post, normalizePostSearchKeyword(POST_SEARCH_KEYWORD));
    const snippetHighlight = match.highlightRanges.find((range) => range.field === 'snippet');

    expect(match).toMatchObject({
      post,
      hitType: 'content',
      matchedFields: { title: false, content: true },
    });
    expect(match.snippet).toContain('before the reef climb');
    expect(match.snippet).not.toBe(content.slice(0, match.snippet.length));
    expect(snippetHighlight).toEqual(expect.objectContaining({ field: 'snippet' }));
    expect(
      match.snippet.slice(snippetHighlight.start, snippetHighlight.end).toLowerCase(),
    ).toBe(POST_SEARCH_KEYWORD);
  });

  it('returns title highlight metadata without unsafe HTML strings', () => {
    const fixture = createPostSearchFixtureSet();
    const match = buildPostSearchMatch(
      fixture.posts.titleHitNewest,
      normalizePostSearchKeyword(POST_SEARCH_KEYWORD),
    );
    const titleHighlight = match.highlightRanges.find((range) => range.field === 'title');

    expect(titleHighlight).toEqual({ field: 'title', start: 0, end: 4 });
    expect(fixture.posts.titleHitNewest.title.slice(titleHighlight.start, titleHighlight.end)).toBe(
      'REEF',
    );
    expect(match.snippet).not.toContain('<mark>');
    expect(match.highlightRanges).not.toContainEqual(expect.objectContaining({ html: expect.any(String) }));
  });

  it('returns first-match highlight ranges for title and snippet text', () => {
    const post = createPostSearchPost({
      id: 'post-search-title-and-snippet-highlights',
      title: 'REEF ladder after reef repeats',
      content: 'Warmup before reef climbs and reef cooldown notes.',
    });
    const match = buildPostSearchMatch(post, normalizePostSearchKeyword('reef'));
    const titleHighlight = match.highlightRanges.find((range) => range.field === 'title');
    const snippetHighlight = match.highlightRanges.find((range) => range.field === 'snippet');

    expect(match.highlightRanges).toEqual(expect.arrayContaining([
      { field: 'title', start: 0, end: 4 },
      { field: 'snippet', start: 14, end: 18 },
    ]));
    expect(post.title.slice(titleHighlight.start, titleHighlight.end)).toBe('REEF');
    expect(match.snippet.slice(snippetHighlight.start, snippetHighlight.end)).toBe('reef');
  });
});

describe('sortPostSearchMatches', () => {
  it('sorts title-hit tier before content-only tier, then by postAt desc and id desc', () => {
    const fixture = createPostSearchFixtureSet();
    const keyword = normalizePostSearchKeyword(POST_SEARCH_KEYWORD);
    const unsortedMatches = [
      fixture.posts.contentHitOlder,
      fixture.posts.titleHitSameTimeLowId,
      fixture.posts.contentHit,
      fixture.posts.titleAndContentHit,
      fixture.posts.titleHitSameTimeHighId,
      fixture.posts.titleHitNewest,
    ].map((post) => buildPostSearchMatch(post, keyword));

    expect(sortPostSearchMatches(unsortedMatches).map((match) => match.post.id)).toEqual(
      fixture.expected.fullResultOrder,
    );
  });

  it('keeps title-plus-content results in the title tier before newer content-only hits', () => {
    const fixture = createPostSearchFixtureSet();
    const keyword = normalizePostSearchKeyword(POST_SEARCH_KEYWORD);
    const unsortedMatches = [
      fixture.posts.contentHit,
      fixture.posts.titleAndContentHit,
      fixture.posts.contentHitOlder,
    ].map((post) => buildPostSearchMatch(post, keyword));

    expect(sortPostSearchMatches(unsortedMatches).map((match) => match.post.id)).toEqual([
      fixture.posts.titleAndContentHit.id,
      fixture.posts.contentHit.id,
      fixture.posts.contentHitOlder.id,
    ]);
  });

  it('uses post id descending as the stable tie-break inside the same postAt tier', () => {
    const samePostAt = createPostSearchTimestamp('2026-06-14T13:00:00.000Z');
    const keyword = normalizePostSearchKeyword(POST_SEARCH_KEYWORD);
    const alpha = createPostSearchPost({
      id: 'post-search-same-time-a',
      title: 'Reef alpha',
      postAt: samePostAt,
    });
    const zulu = createPostSearchPost({
      id: 'post-search-same-time-z',
      title: 'Reef zulu',
      postAt: samePostAt,
    });

    const sortedIds = sortPostSearchMatches([
      buildPostSearchMatch(alpha, keyword),
      buildPostSearchMatch(zulu, keyword),
    ]).map((match) => match.post.id);

    expect(sortedIds).toEqual([zulu.id, alpha.id]);
  });
});

describe('filterAndRankPostSearchMatches', () => {
  it('excludes non-public-active posts and returns sorted title/content matches', () => {
    const fixture = createPostSearchFixtureSet();
    const results = filterAndRankPostSearchMatches(
      Object.values(fixture.posts),
      ` ${POST_SEARCH_KEYWORD.toUpperCase()} `,
    );

    expect(results.map((match) => match.post.id)).toEqual(fixture.expected.fullResultOrder);
    expect(results.map((match) => match.post.id)).not.toEqual(
      expect.arrayContaining(fixture.expected.excludedIds),
    );
  });
});
