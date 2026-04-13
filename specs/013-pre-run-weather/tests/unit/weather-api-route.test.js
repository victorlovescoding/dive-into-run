import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getForecastIds, formatLocationName, formatLocationNameShort } from '@/lib/weather-helpers';
import { GET } from '@/app/api/weather/route';

// Mock weather-helpers (vitest hoists vi.mock to top automatically)
vi.mock('@/lib/weather-helpers', () => ({
  getForecastIds: vi.fn(),
  formatLocationName: vi.fn(),
  formatLocationNameShort: vi.fn(),
}));

const mockedGetForecastIds = /** @type {import('vitest').Mock} */ (getForecastIds);
const mockedFormatLocationName = /** @type {import('vitest').Mock} */ (formatLocationName);
const mockedFormatLocationNameShort = /** @type {import('vitest').Mock} */ (
  formatLocationNameShort
);

// #region Helpers & Mock Data

/**
 * Creates a mock GET request for the weather API.
 * @param {Record<string, string>} params - Query parameters.
 * @returns {Request} Mock request object.
 */
function createRequest(params) {
  const url = new URL('http://localhost:3000/api/weather');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url);
}

/** Mock CWA F-C0032-001 county response. */
const mockCwaCountyResponse = {
  success: 'true',
  records: {
    location: [
      {
        locationName: '臺北市',
        weatherElement: [
          {
            elementName: 'Wx',
            time: [
              {
                startTime: '2026-04-13 06:00:00',
                endTime: '2026-04-13 18:00:00',
                parameter: { parameterName: '晴時多雲', parameterValue: '2' },
              },
              {
                startTime: '2026-04-14 06:00:00',
                endTime: '2026-04-14 18:00:00',
                parameter: { parameterName: '多雲時陰', parameterValue: '5' },
              },
            ],
          },
          {
            elementName: 'PoP',
            time: [
              {
                startTime: '2026-04-13 06:00:00',
                endTime: '2026-04-13 18:00:00',
                parameter: { parameterName: '10', parameterUnit: '百分比' },
              },
              {
                startTime: '2026-04-14 06:00:00',
                endTime: '2026-04-14 18:00:00',
                parameter: { parameterName: '30', parameterUnit: '百分比' },
              },
            ],
          },
          {
            elementName: 'MinT',
            time: [
              {
                startTime: '2026-04-13 06:00:00',
                endTime: '2026-04-13 18:00:00',
                parameter: { parameterName: '24', parameterUnit: 'C' },
              },
              {
                startTime: '2026-04-14 06:00:00',
                endTime: '2026-04-14 18:00:00',
                parameter: { parameterName: '23', parameterUnit: 'C' },
              },
            ],
          },
          {
            elementName: 'MaxT',
            time: [
              {
                startTime: '2026-04-13 06:00:00',
                endTime: '2026-04-13 18:00:00',
                parameter: { parameterName: '30', parameterUnit: 'C' },
              },
              {
                startTime: '2026-04-14 06:00:00',
                endTime: '2026-04-14 18:00:00',
                parameter: { parameterName: '29', parameterUnit: 'C' },
              },
            ],
          },
          {
            elementName: 'CI',
            time: [
              {
                startTime: '2026-04-13 06:00:00',
                endTime: '2026-04-13 18:00:00',
                parameter: { parameterName: '舒適至悶熱' },
              },
              {
                startTime: '2026-04-14 06:00:00',
                endTime: '2026-04-14 18:00:00',
                parameter: { parameterName: '舒適' },
              },
            ],
          },
        ],
      },
    ],
  },
};

/** Mock EPA AQI response. */
const mockEpaResponse = {
  records: [{ County: '臺北市', AQI: '45', Status: '良好', SiteName: '中山' }],
};

/** Mock CWA F-D0047 even (UV 12hr) response. */
const mockUvResponse = {
  success: 'true',
  records: {
    Locations: [
      {
        Location: [
          {
            LocationName: '臺北市',
            WeatherElement: [
              {
                ElementName: 'UVIndex',
                Time: [
                  {
                    StartTime: '2026-04-13 06:00:00',
                    EndTime: '2026-04-13 18:00:00',
                    ElementValue: [{ Value: '7' }],
                  },
                ],
              },
              {
                ElementName: 'UVExposureLevel',
                Time: [
                  {
                    StartTime: '2026-04-13 06:00:00',
                    EndTime: '2026-04-13 18:00:00',
                    ElementValue: [{ Value: '高量級' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** Mock CWA F-D0047 odd (3hr township) response. */
const mockCwaTownshipResponse = {
  success: 'true',
  records: {
    Locations: [
      {
        Location: [
          {
            LocationName: '板橋區',
            WeatherElement: [
              {
                ElementName: 'Temperature',
                Time: [
                  {
                    StartTime: '2026-04-13 09:00:00',
                    EndTime: '2026-04-13 12:00:00',
                    ElementValue: [{ Value: '28' }],
                  },
                  {
                    StartTime: '2026-04-13 18:00:00',
                    EndTime: '2026-04-13 21:00:00',
                    ElementValue: [{ Value: '22' }],
                  },
                  {
                    StartTime: '2026-04-14 09:00:00',
                    EndTime: '2026-04-14 12:00:00',
                    ElementValue: [{ Value: '27' }],
                  },
                ],
              },
              {
                ElementName: 'RelativeHumidity',
                Time: [
                  {
                    StartTime: '2026-04-13 09:00:00',
                    EndTime: '2026-04-13 12:00:00',
                    ElementValue: [{ Value: '72' }],
                  },
                  {
                    StartTime: '2026-04-13 18:00:00',
                    EndTime: '2026-04-13 21:00:00',
                    ElementValue: [{ Value: '80' }],
                  },
                  {
                    StartTime: '2026-04-14 09:00:00',
                    EndTime: '2026-04-14 12:00:00',
                    ElementValue: [{ Value: '75' }],
                  },
                ],
              },
              {
                ElementName: 'ProbabilityOfPrecipitation',
                Time: [
                  {
                    StartTime: '2026-04-13 09:00:00',
                    EndTime: '2026-04-13 12:00:00',
                    ElementValue: [{ Value: '10' }],
                  },
                  {
                    StartTime: '2026-04-13 18:00:00',
                    EndTime: '2026-04-13 21:00:00',
                    ElementValue: [{ Value: '20' }],
                  },
                  {
                    StartTime: '2026-04-14 09:00:00',
                    EndTime: '2026-04-14 12:00:00',
                    ElementValue: [{ Value: '30' }],
                  },
                ],
              },
              {
                ElementName: 'Weather',
                Time: [
                  {
                    StartTime: '2026-04-13 09:00:00',
                    EndTime: '2026-04-13 12:00:00',
                    ElementValue: [{ Value: '晴時多雲' }],
                  },
                  {
                    StartTime: '2026-04-13 18:00:00',
                    EndTime: '2026-04-13 21:00:00',
                    ElementValue: [{ Value: '多雲' }],
                  },
                  {
                    StartTime: '2026-04-14 09:00:00',
                    EndTime: '2026-04-14 12:00:00',
                    ElementValue: [{ Value: '多雲時陰' }],
                  },
                ],
              },
              {
                ElementName: 'WeatherCode',
                Time: [
                  {
                    StartTime: '2026-04-13 09:00:00',
                    EndTime: '2026-04-13 12:00:00',
                    ElementValue: [{ Value: '2' }],
                  },
                  {
                    StartTime: '2026-04-13 18:00:00',
                    EndTime: '2026-04-13 21:00:00',
                    ElementValue: [{ Value: '4' }],
                  },
                  {
                    StartTime: '2026-04-14 09:00:00',
                    EndTime: '2026-04-14 12:00:00',
                    ElementValue: [{ Value: '5' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** Mock UV response for township (板橋區). */
const mockUvTownshipResponse = {
  success: 'true',
  records: {
    Locations: [
      {
        Location: [
          {
            LocationName: '板橋區',
            WeatherElement: [
              {
                ElementName: 'UVIndex',
                Time: [
                  {
                    StartTime: '2026-04-13 06:00:00',
                    EndTime: '2026-04-13 18:00:00',
                    ElementValue: [{ Value: '6' }],
                  },
                ],
              },
              {
                ElementName: 'UVExposureLevel',
                Time: [
                  {
                    StartTime: '2026-04-13 06:00:00',
                    EndTime: '2026-04-13 18:00:00',
                    ElementValue: [{ Value: '高量級' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

/**
 * Creates a mock fetch response.
 * @param {object} body - Response JSON body.
 * @param {boolean} [ok] - Whether response is ok.
 * @param {number} [status] - HTTP status.
 * @returns {{ ok: boolean, status: number, json: () => Promise<object> }} Mock response.
 */
function mockFetchResponse(body, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) };
}

// #endregion

describe('GET /api/weather', () => {
  beforeEach(() => {
    vi.stubEnv('CWA_API_KEY', 'test-cwa-key');
    vi.stubEnv('EPA_API_KEY', 'test-epa-key');
    vi.stubGlobal('fetch', vi.fn());

    // Default mocks for formatLocation helpers
    mockedFormatLocationName.mockImplementation((county, township) =>
      township ? `${county} · ${township}` : county,
    );
    mockedFormatLocationNameShort.mockImplementation((county, township) =>
      township
        ? `${county.replace(/[縣市]$/, '')} · ${township.replace(/[區鄉鎮市]$/, '')}`
        : county.replace(/[縣市]$/, ''),
    );

    // Freeze time to 2026-04-13 10:00:00 (within the mock time periods)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // #region Validation Tests

  describe('parameter validation', () => {
    it('should return 400 when county is missing', async () => {
      const req = createRequest({});
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toMatch(/county/i);
    });

    it('should return 400 when county is unknown', async () => {
      mockedGetForecastIds.mockReturnValue(null);
      const req = createRequest({ county: '火星市' });
      const res = await GET(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toContain('火星市');
    });
  });

  // #endregion

  // #region County-only Tests

  describe('county-only query', () => {
    /** @type {import('vitest').Mock} */
    let mockedFetch;

    beforeEach(() => {
      mockedGetForecastIds.mockReturnValue({
        threeHour: 'F-D0047-061',
        twelveHour: 'F-D0047-063',
      });

      mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
      mockedFetch.mockImplementation((/** @type {string} */ url) => {
        if (url.includes('F-C0032-001')) {
          return Promise.resolve(mockFetchResponse(mockCwaCountyResponse));
        }
        if (url.includes('F-D0047-063')) {
          return Promise.resolve(mockFetchResponse(mockUvResponse));
        }
        if (url.includes('aqx_p_432')) {
          return Promise.resolve(mockFetchResponse(mockEpaResponse));
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });
    });

    it('should return 200 with WeatherInfo for valid county', async () => {
      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data).toBeDefined();
    });

    it('should include correct location names', async () => {
      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);
      const { data } = await res.json();

      expect(data.locationName).toBe('臺北市');
      expect(data.locationNameShort).toBe('臺北');
    });

    it('should normalize today weather from F-C0032-001', async () => {
      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);
      const { data } = await res.json();

      expect(data.today).toMatchObject({
        weatherDesc: '晴時多雲',
        weatherCode: '2',
        morningTemp: 30,
        eveningTemp: 24,
        rainProb: 10,
      });
    });

    it('should include UV info from F-D0047 even ID', async () => {
      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);
      const { data } = await res.json();

      expect(data.today.uv).toEqual({ value: 7, level: '高量級' });
    });

    it('should include AQI from EPA', async () => {
      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);
      const { data } = await res.json();

      expect(data.today.aqi).toEqual({ value: 45, status: '良好' });
    });

    it('should normalize tomorrow weather', async () => {
      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);
      const { data } = await res.json();

      expect(data.tomorrow).toMatchObject({
        weatherDesc: '多雲時陰',
        weatherCode: '5',
        morningTemp: 29,
        eveningTemp: 23,
        rainProb: 30,
      });
    });

    it('should use F-C0032-001 with locationName param for county query', async () => {
      const req = createRequest({ county: '臺北市' });
      await GET(req);

      const cwaCalls = mockedFetch.mock.calls.filter((/** @type {string[]} */ c) =>
        c[0].includes('F-C0032-001'),
      );
      expect(cwaCalls.length).toBe(1);
      expect(cwaCalls[0][0]).toContain('locationName=');
      expect(cwaCalls[0][0]).toContain(encodeURIComponent('臺北市'));
    });

    it('should set cache headers on success', async () => {
      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);

      expect(res.headers.get('Cache-Control')).toBe('s-maxage=600, stale-while-revalidate=300');
    });

    it('should handle UV fetch failure gracefully', async () => {
      mockedFetch.mockImplementation((/** @type {string} */ url) => {
        if (url.includes('F-C0032-001')) {
          return Promise.resolve(mockFetchResponse(mockCwaCountyResponse));
        }
        if (url.includes('F-D0047-063')) {
          return Promise.reject(new Error('UV service down'));
        }
        if (url.includes('aqx_p_432')) {
          return Promise.resolve(mockFetchResponse(mockEpaResponse));
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });

      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.today.uv).toBeNull();
    });

    it('should handle EPA fetch failure gracefully', async () => {
      mockedFetch.mockImplementation((/** @type {string} */ url) => {
        if (url.includes('F-C0032-001')) {
          return Promise.resolve(mockFetchResponse(mockCwaCountyResponse));
        }
        if (url.includes('F-D0047-063')) {
          return Promise.resolve(mockFetchResponse(mockUvResponse));
        }
        if (url.includes('aqx_p_432')) {
          return Promise.reject(new Error('EPA service down'));
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });

      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const { data } = await res.json();
      expect(data.today.aqi).toBeNull();
    });
  });

  // #endregion

  // #region Township Tests

  describe('county + township query', () => {
    /** @type {import('vitest').Mock} */
    let mockedFetch;

    beforeEach(() => {
      mockedGetForecastIds.mockReturnValue({
        threeHour: 'F-D0047-069',
        twelveHour: 'F-D0047-071',
      });

      mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
      mockedFetch.mockImplementation((/** @type {string} */ url) => {
        if (url.includes('F-D0047-069')) {
          return Promise.resolve(mockFetchResponse(mockCwaTownshipResponse));
        }
        if (url.includes('F-D0047-071')) {
          return Promise.resolve(mockFetchResponse(mockUvTownshipResponse));
        }
        if (url.includes('aqx_p_432')) {
          return Promise.resolve(mockFetchResponse(mockEpaResponse));
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });
    });

    it('should return 200 with WeatherInfo for valid township', async () => {
      const req = createRequest({ county: '新北市', township: '板橋區' });
      const res = await GET(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data).toBeDefined();
    });

    it('should include formatted location names for township', async () => {
      const req = createRequest({ county: '新北市', township: '板橋區' });
      const res = await GET(req);
      const { data } = await res.json();

      expect(data.locationName).toBe('新北市 · 板橋區');
      expect(data.locationNameShort).toBe('新北 · 板橋');
    });

    it('should normalize township today weather from F-D0047 3hr', async () => {
      const req = createRequest({ county: '新北市', township: '板橋區' });
      const res = await GET(req);
      const { data } = await res.json();

      expect(data.today).toMatchObject({
        currentTemp: 28,
        weatherDesc: '晴時多雲',
        weatherCode: '2',
        rainProb: 10,
        humidity: 72,
      });
    });

    it('should use LocationName (uppercase L) for township CWA query', async () => {
      const req = createRequest({ county: '新北市', township: '板橋區' });
      await GET(req);

      const townshipCalls = mockedFetch.mock.calls.filter((/** @type {string[]} */ c) =>
        c[0].includes('F-D0047-069'),
      );
      expect(townshipCalls.length).toBe(1);
      expect(townshipCalls[0][0]).toContain('LocationName=');
    });

    it('should set cache headers on township response', async () => {
      const req = createRequest({ county: '新北市', township: '板橋區' });
      const res = await GET(req);

      expect(res.headers.get('Cache-Control')).toBe('s-maxage=600, stale-while-revalidate=300');
    });
  });

  // #endregion

  // #region Error Handling Tests

  describe('upstream failures', () => {
    beforeEach(() => {
      mockedGetForecastIds.mockReturnValue({
        threeHour: 'F-D0047-061',
        twelveHour: 'F-D0047-063',
      });
    });

    it('should return 502 when CWA county fetch fails', async () => {
      const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
      mockedFetch.mockImplementation((/** @type {string} */ url) => {
        if (url.includes('F-C0032-001')) {
          return Promise.resolve(mockFetchResponse(null, false, 500));
        }
        if (url.includes('F-D0047-063')) {
          return Promise.resolve(mockFetchResponse(mockUvResponse));
        }
        if (url.includes('aqx_p_432')) {
          return Promise.resolve(mockFetchResponse(mockEpaResponse));
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });

      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 502 when CWA township fetch fails', async () => {
      const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
      mockedFetch.mockImplementation((/** @type {string} */ url) => {
        if (url.includes('F-D0047-061')) {
          return Promise.resolve(mockFetchResponse(null, false, 500));
        }
        if (url.includes('F-D0047-063')) {
          return Promise.resolve(mockFetchResponse(mockUvResponse));
        }
        if (url.includes('aqx_p_432')) {
          return Promise.resolve(mockFetchResponse(mockEpaResponse));
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });

      const req = createRequest({ county: '臺北市', township: '大安區' });
      const res = await GET(req);

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.ok).toBe(false);
    });

    it('should return 502 when CWA fetch throws network error', async () => {
      const mockedFetch = /** @type {import('vitest').Mock} */ (globalThis.fetch);
      mockedFetch.mockImplementation((/** @type {string} */ url) => {
        if (url.includes('F-C0032-001')) {
          return Promise.reject(new Error('Network error'));
        }
        if (url.includes('F-D0047-063')) {
          return Promise.reject(new Error('Network error'));
        }
        if (url.includes('aqx_p_432')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.reject(new Error(`Unexpected fetch: ${url}`));
      });

      const req = createRequest({ county: '臺北市' });
      const res = await GET(req);

      expect(res.status).toBe(502);
      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe('Failed to fetch weather data');
    });
  });

  // #endregion
});
