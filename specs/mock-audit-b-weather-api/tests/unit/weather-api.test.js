/**
 * @file Unit Test for src/lib/weather-api.js
 * @description
 * Self-test for fetchWeather — 覆蓋 Session B mock-audit 黑洞。
 * 不 mock `@/lib/weather-api`，用 fetch stub 驅動每個分支。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWeather } from '@/lib/weather-api';

/**
 * 組一個 fake Response，只露 fetchWeather 會用到的 json()。
 * @param {object} payload - 要回傳的 JSON body。
 * @returns {{ json: () => Promise<object> }} fake Response 物件。
 */
function fakeResponse(payload) {
  return { json: () => Promise.resolve(payload) };
}

/**
 * Self-test for src/lib/weather-api.js › fetchWeather。
 * Stub globalThis.fetch 驅動每個分支（URL 組法、回應處理、錯誤 fallback、signal 傳遞）。
 * Pattern 對齊 specs/013-pre-run-weather/tests/unit/weather-api-route.test.js。
 */
describe('weather-api › fetchWeather', () => {
  /** @type {import('vitest').Mock} */
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('只帶 county 時 URL 不含 township 參數', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: true, data: { city: '臺北市' } }));

    await fetchWeather({ county: '臺北市' });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/weather?${new URLSearchParams({ county: '臺北市' }).toString()}`);
    expect(url).not.toContain('township');
  });

  it('同時帶 county + township 時兩者都進 query', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: true, data: { city: '新北市' } }));

    await fetchWeather({ county: '新北市', township: '板橋區' });

    const [url] = fetchMock.mock.calls[0];
    const params = new URL(url, 'http://localhost').searchParams;
    expect(params.get('county')).toBe('新北市');
    expect(params.get('township')).toBe('板橋區');
  });

  it('json.ok === true 時回傳 json.data', async () => {
    const data = { city: '臺中市', temperature: 26 };
    fetchMock.mockResolvedValue(fakeResponse({ ok: true, data }));

    const result = await fetchWeather({ county: '臺中市' });

    expect(result).toBe(data);
  });

  it('json.ok === false 且帶 error 時 throw 該 error message', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: false, error: 'Upstream 429' }));

    await expect(fetchWeather({ county: '高雄市' })).rejects.toThrow('Upstream 429');
  });

  it('json.ok === false 無 error 時 throw 預設 fallback', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: false }));

    await expect(fetchWeather({ county: '臺南市' })).rejects.toThrow(
      'Failed to fetch weather data',
    );
  });

  it('把 signal 原封不動傳給 fetch', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: true, data: {} }));
    const controller = new AbortController();

    await fetchWeather({ county: '宜蘭縣', signal: controller.signal });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBe(controller.signal);
  });
});
