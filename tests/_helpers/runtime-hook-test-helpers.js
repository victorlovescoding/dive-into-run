import { vi } from 'vitest';

/**
 * 建立可手動 resolve / reject 的 promise。
 * 避免測試檔直接寫 `new Promise(...)`。
 * @template T
 * @returns {{
 *   promise: Promise<T>,
 *   resolve: (value: T | PromiseLike<T>) => void,
 *   reject: (reason?: unknown) => void
 * }} deferred 物件。
 */
export function createDeferred() {
  return Promise.withResolvers();
}

/**
 * 安裝可控的 IntersectionObserver mock。
 * @returns {{
 *   observe: import('vitest').Mock,
 *   disconnect: import('vitest').Mock,
 *   trigger: (entries?: Array<{ isIntersecting: boolean }>) => void,
 *   restore: () => void
 * }} observer mock 控制器。
 */
export function installIntersectionObserverMock() {
  const originalObserver = globalThis.IntersectionObserver;
  /** @type {((entries: Array<{ isIntersecting: boolean }>) => void) | undefined} */
  let callback;
  const observe = vi.fn();
  const disconnect = vi.fn();

  /**
   * 測試用 IntersectionObserver constructor。
   * @param {(entries: Array<{ isIntersecting: boolean }>) => void} nextCallback - observer callback。
   */
  function MockIntersectionObserver(nextCallback) {
    callback = nextCallback;
  }

  MockIntersectionObserver.prototype.observe = observe;
  MockIntersectionObserver.prototype.disconnect = disconnect;
  MockIntersectionObserver.prototype.unobserve = vi.fn();
  MockIntersectionObserver.prototype.takeRecords = () => [];

  globalThis.IntersectionObserver = /** @type {typeof globalThis.IntersectionObserver} */ (
    /** @type {unknown} */ (MockIntersectionObserver)
  );

  return {
    observe,
    disconnect,
    trigger(entries = [{ isIntersecting: true }]) {
      callback?.(entries);
    },
    restore() {
      globalThis.IntersectionObserver = originalObserver;
    },
  };
}
