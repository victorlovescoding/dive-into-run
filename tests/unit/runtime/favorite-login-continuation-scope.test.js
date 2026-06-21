import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = process.cwd();
const SOURCE_ROOT = path.join(REPO_ROOT, 'src');
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx']);

const CONTINUATION_SOURCE_FILES = [
  'src/runtime/hooks/useEventsPageRuntime.js',
  'src/runtime/hooks/useEventDetailRuntime.js',
  'src/runtime/hooks/usePostsPageRuntime.js',
  'src/runtime/hooks/usePostsSearchPageRuntime.js',
  'src/runtime/hooks/usePostDetailRuntime.js',
  'src/ui/events/EventsPageScreen.jsx',
  'src/ui/events/EventDetailScreen.jsx',
  'src/ui/posts/PostsPageScreen.jsx',
  'src/ui/posts/PostsSearchPageScreen.jsx',
  'src/ui/posts/PostDetailScreen.jsx',
  'src/runtime/hooks/useFavoriteLoginContinuation.js',
  'src/runtime/client/use-cases/favorite-login-continuation-use-cases.js',
  'src/runtime/favorites/favorite-login-continuation-helpers.js',
  'src/components/FavoriteLoginContinuationDialog.jsx',
].sort();

const RUNTIME_ENTRY_POINTS = [
  'src/runtime/hooks/useEventsPageRuntime.js',
  'src/runtime/hooks/useEventDetailRuntime.js',
  'src/runtime/hooks/usePostsPageRuntime.js',
  'src/runtime/hooks/usePostsSearchPageRuntime.js',
  'src/runtime/hooks/usePostDetailRuntime.js',
].sort();

const SCREEN_ENTRY_POINTS = [
  'src/ui/events/EventsPageScreen.jsx',
  'src/ui/events/EventDetailScreen.jsx',
  'src/ui/posts/PostsPageScreen.jsx',
  'src/ui/posts/PostsSearchPageScreen.jsx',
  'src/ui/posts/PostDetailScreen.jsx',
].sort();

const EXCLUDED_SCOPE_FILES = [
  'src/runtime/hooks/useWeatherFavorites.js',
  'src/runtime/hooks/useWeatherPageRuntime.js',
  'src/ui/weather/WeatherPageScreen.jsx',
  'src/components/weather/FavoriteButton.jsx',
  'src/components/weather/FavoritesBar.jsx',
  'src/runtime/hooks/useMemberFavoritesRuntime.js',
  'src/ui/member/MemberFavoritesScreen.jsx',
  'src/runtime/hooks/usePostComments.js',
  'src/runtime/hooks/usePostCommentsHelpers.js',
  'src/components/CommentCard.jsx',
  'src/components/CommentSection.jsx',
  'src/components/reports/ReportMenuItem.jsx',
  'src/runtime/hooks/useReportDialogRuntime.js',
  'src/runtime/hooks/useEventDetailParticipation.js',
  'src/runtime/hooks/useEventParticipation.js',
  'src/app/runs/page.jsx',
  'src/runtime/hooks/useRunsPageRuntime.js',
  'src/ui/runs/RunsPageScreen.jsx',
  'src/runtime/server/use-cases/strava-server-use-cases.js',
  'src/repo/client/post-composer-draft-storage-repo.js',
  'src/components/PostCard.jsx',
];

const CONTINUATION_TOKEN_PATTERN =
  /FavoriteLoginContinuation|useFavoriteLoginContinuation|favorite-login-continuation/;

const FORBIDDEN_EXCLUDED_SCOPE_PATTERNS = [
  {
    label: 'favorite login continuation flow',
    pattern: CONTINUATION_TOKEN_PATTERN,
  },
  {
    label: 'Google sign-in continuation auth',
    pattern: /\bsignInWithGoogle\b/,
  },
  {
    label: 'email/password auth helpers',
    pattern:
      /\b(signInWithEmail|signInWithEmailAndPassword|createUserWithEmailAndPassword|EmailAuthProvider|reauthenticateWithCredential|sendPasswordResetEmail|updatePassword)\b/,
  },
  {
    label: 'full login page router fallback',
    pattern: /\b(?:router\.(?:push|replace)|redirect)\(\s*['"`]\/login(?:[/?#'"`)]|$)/,
  },
];

/**
 * Converts an absolute path to a POSIX repo-relative path.
 * @param {string} absolutePath - Absolute path.
 * @returns {string} Repo-relative path.
 */
function toRepoRelativePath(absolutePath) {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/');
}

/**
 * Returns source files below a directory.
 * @param {string} directory - Absolute directory path.
 * @returns {string[]} Relative source file paths.
 */
function listSourceFiles(directory) {
  return readdirSync(directory).flatMap((entryName) => {
    const absolutePath = path.join(directory, entryName);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      return listSourceFiles(absolutePath);
    }
    if (!stats.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entryName))) {
      return [];
    }
    return [toRepoRelativePath(absolutePath)];
  });
}

/**
 * Reads a repo-relative UTF-8 file.
 * @param {string} relativePath - Repo-relative path.
 * @returns {string} File contents.
 */
function readSource(relativePath) {
  return readFileSync(path.join(REPO_ROOT, relativePath), 'utf8');
}

/**
 * Finds source files whose contents match a pattern.
 * @param {RegExp} pattern - Content pattern.
 * @returns {string[]} Matching repo-relative paths.
 */
function findSourceFilesMatching(pattern) {
  return listSourceFiles(SOURCE_ROOT)
    .filter((relativePath) => pattern.test(readSource(relativePath)))
    .sort();
}

describe('favorite login continuation source scope', () => {
  it('keeps continuation code limited to the shared flow and supported event/post entry points', () => {
    expect(findSourceFilesMatching(CONTINUATION_TOKEN_PATTERN)).toEqual(
      CONTINUATION_SOURCE_FILES,
    );
  });

  it('limits hook and dialog imports to the supported runtime and screen entry points', () => {
    expect(
      findSourceFilesMatching(
        /import\s+useFavoriteLoginContinuation\s+from\s+['"]@\/runtime\/hooks\/useFavoriteLoginContinuation['"]/,
      ),
    ).toEqual(RUNTIME_ENTRY_POINTS);

    expect(
      findSourceFilesMatching(
        /import\s+FavoriteLoginContinuationDialog\s+from\s+['"]@\/components\/FavoriteLoginContinuationDialog['"]/,
      ),
    ).toEqual(SCREEN_ENTRY_POINTS);
  });

  it('keeps excluded favorite-like surfaces out of continuation and auth-login fallback paths', () => {
    const violations = EXCLUDED_SCOPE_FILES.flatMap((relativePath) => {
      const source = readSource(relativePath);
      return FORBIDDEN_EXCLUDED_SCOPE_PATTERNS
        .filter(({ pattern }) => pattern.test(source))
        .map(({ label }) => `${relativePath}: ${label}`);
    });

    expect(violations).toEqual([]);
  });

  it('keeps PostCard as a pass-through favorite component without continuation imports', () => {
    const postCardSource = readSource('src/components/PostCard.jsx');

    expect(postCardSource).toMatch(/onToggleFavorite\?\.\(post\.id\)/);
    expect(postCardSource).not.toMatch(CONTINUATION_TOKEN_PATTERN);
  });

  it('keeps the continuation use-case on Google add-only without login-page or email-password fallback', () => {
    const source = readSource(
      'src/runtime/client/use-cases/favorite-login-continuation-use-cases.js',
    );

    expect(source).toMatch(/\bsignInWithGoogle\b/);
    expect(source).toMatch(/\baddContentFavorite\b/);
    expect(source).not.toMatch(
      /\b(signInWithEmail|signInWithEmailAndPassword|createUserWithEmailAndPassword|EmailAuthProvider|reauthenticateWithCredential|sendPasswordResetEmail|updatePassword)\b/,
    );
    expect(source).not.toMatch(/\b(?:router\.(?:push|replace)|redirect)\(\s*['"`]\/login/);
    expect(source).not.toMatch(/\bremoveContentFavorite\b/);
  });
});
