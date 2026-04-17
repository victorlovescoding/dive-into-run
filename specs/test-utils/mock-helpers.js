/**
 * 把 mocked 函數 cast 成 Vitest Mock 型別。
 * 解除 tsc 對 .mockResolvedValueOnce / .mockRejectedValueOnce 等方法的 TS2339 抱怨。
 *
 * @example
 * import { asMock } from '../test-utils/mock-helpers';
 * asMock(firestore.addDoc).mockResolvedValueOnce(mockRef);
 *
 * @param {unknown} fn - vi.mock() factory 內的 vi.fn() 或 mocked module 匯出的函數。
 * @returns {import('vitest').Mock} 可安全呼叫 .mockResolvedValueOnce 等方法。
 */
export const asMock = (fn) => /** @type {import('vitest').Mock} */ (/** @type {unknown} */ (fn));
