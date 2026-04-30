import { vi } from 'vitest';

/**
 * @returns {Event} 模擬 submit event。
 */
export function createSubmitEvent() {
  return /** @type {Event} */ (/** @type {unknown} */ ({ preventDefault: vi.fn() }));
}

/**
 * @param {string} value - input value。
 * @returns {Event} 模擬 change event。
 */
export function createChangeEvent(value) {
  return /** @type {Event} */ (/** @type {unknown} */ ({ target: { value } }));
}
