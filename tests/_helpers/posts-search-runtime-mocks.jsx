import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const DEFAULT_PATHNAME = '/posts/search';

const routerMocks = {
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

let currentPathname = DEFAULT_PATHNAME;
let currentSearchParams = new URLSearchParams();

/**
 * Updates the mocked App Router pathname.
 * @param {string} pathname Pathname returned by `usePathname`.
 * @returns {void}
 */
export function setPostsSearchPathname(pathname = DEFAULT_PATHNAME) {
  currentPathname = pathname;
}

/**
 * Creates URLSearchParams from the input shape used by tests.
 * @param {string | URLSearchParams | Record<string, string | number | boolean | null | undefined>} params
 *   Query params represented as a query string, URLSearchParams, or object.
 * @returns {URLSearchParams} Normalized params.
 */
function createSearchParams(params) {
  if (params instanceof URLSearchParams) {
    return new URLSearchParams(params);
  }

  if (typeof params === 'string') {
    return new URLSearchParams(params.startsWith('?') ? params.slice(1) : params);
  }

  const nextParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value == null) return;
    nextParams.set(key, String(value));
  });
  return nextParams;
}

/**
 * Updates the mocked App Router search params.
 * @param {string | URLSearchParams | Record<string, string | number | boolean | null | undefined>} [params]
 *   Query params represented as a query string, URLSearchParams, or object.
 * @returns {URLSearchParams} Active mocked search params.
 */
export function setPostsSearchParams(params = '') {
  currentSearchParams = createSearchParams(params);
  return currentSearchParams;
}

/**
 * Resets router spies and URL state between tests.
 * @param {object} [options] Reset options.
 * @param {string} [options.pathname] Pathname to expose after reset.
 * @param {string | URLSearchParams | Record<string, string | number | boolean | null | undefined>} [options.searchParams]
 *   Search params to expose after reset.
 * @returns {void}
 */
export function resetPostsSearchRuntimeMocks({
  pathname = DEFAULT_PATHNAME,
  searchParams = '',
} = {}) {
  Object.values(routerMocks).forEach((mock) => {
    mock.mockReset();
  });
  currentPathname = pathname;
  currentSearchParams = createSearchParams(searchParams);
}

/**
 * Installs shared App Router navigation mocks for posts search tests.
 * Call before importing runtime or screen modules that read `next/navigation`.
 * @returns {{
 *   router: typeof routerMocks,
 *   setPathname: typeof setPostsSearchPathname,
 *   setSearchParams: typeof setPostsSearchParams,
 *   reset: typeof resetPostsSearchRuntimeMocks
 * }} Navigation mock controls.
 */
export function mockPostsSearchNavigation() {
  vi.doMock('next/navigation', () => ({
    usePathname: () => currentPathname,
    useRouter: () => routerMocks,
    useSearchParams: () => currentSearchParams,
  }));

  return {
    router: routerMocks,
    setPathname: setPostsSearchPathname,
    setSearchParams: setPostsSearchParams,
    reset: resetPostsSearchRuntimeMocks,
  };
}

/**
 * Creates a user-event instance for posts search interaction tests.
 * @param {Parameters<typeof userEvent.setup>[0]} [options] user-event setup options.
 * @returns {ReturnType<typeof userEvent.setup>} Configured user-event instance.
 */
export function setupPostsSearchUser(options) {
  return userEvent.setup(options);
}

/**
 * Exposes the shared router spies for direct assertions.
 * @returns {typeof routerMocks} Shared router mock methods.
 */
export function getPostsSearchRouterMocks() {
  return routerMocks;
}
