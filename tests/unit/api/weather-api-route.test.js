import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/weather/route';

const NOW = new Date('2026-04-13T10:00:00+08:00');

const mockCountyForecastResponse = {
  records: {
    location: [
      {
        weatherElement: [
          {
            elementName: 'Wx',
            time: [
              {
                startTime: '2026-04-13T00:00:00+08:00',
                endTime: '2026-04-13T06:00:00+08:00',
                parameter: { parameterName: '陰短暫雨', parameterValue: '12' },
              },
              {
                startTime: '2026-04-13T06:00:00+08:00',
                endTime: '2026-04-13T18:00:00+08:00',
                parameter: { parameterName: '晴時多雲', parameterValue: '2' },
              },
              {
                startTime: '2026-04-13T18:00:00+08:00',
                endTime: '2026-04-14T06:00:00+08:00',
                parameter: { parameterName: '多雲', parameterValue: '4' },
              },
              {
                startTime: '2026-04-14T06:00:00+08:00',
                endTime: '2026-04-14T18:00:00+08:00',
                parameter: { parameterName: '多雲時陰', parameterValue: '5' },
              },
            ],
          },
          {
            elementName: 'PoP',
            time: [
              {
                startTime: '2026-04-13T00:00:00+08:00',
                endTime: '2026-04-13T06:00:00+08:00',
                parameter: { parameterName: '60' },
              },
              {
                startTime: '2026-04-13T06:00:00+08:00',
                endTime: '2026-04-13T18:00:00+08:00',
                parameter: { parameterName: '10' },
              },
              {
                startTime: '2026-04-13T18:00:00+08:00',
                endTime: '2026-04-14T06:00:00+08:00',
                parameter: { parameterName: '20' },
              },
              {
                startTime: '2026-04-14T06:00:00+08:00',
                endTime: '2026-04-14T18:00:00+08:00',
                parameter: { parameterName: '30' },
              },
            ],
          },
          {
            elementName: 'MinT',
            time: [
              {
                startTime: '2026-04-13T00:00:00+08:00',
                endTime: '2026-04-13T06:00:00+08:00',
                parameter: { parameterName: '19' },
              },
              {
                startTime: '2026-04-13T06:00:00+08:00',
                endTime: '2026-04-13T18:00:00+08:00',
                parameter: { parameterName: '24' },
              },
              {
                startTime: '2026-04-13T18:00:00+08:00',
                endTime: '2026-04-14T06:00:00+08:00',
                parameter: { parameterName: '21' },
              },
              {
                startTime: '2026-04-14T06:00:00+08:00',
                endTime: '2026-04-14T18:00:00+08:00',
                parameter: { parameterName: '23' },
              },
            ],
          },
          {
            elementName: 'MaxT',
            time: [
              {
                startTime: '2026-04-13T00:00:00+08:00',
                endTime: '2026-04-13T06:00:00+08:00',
                parameter: { parameterName: '24' },
              },
              {
                startTime: '2026-04-13T06:00:00+08:00',
                endTime: '2026-04-13T18:00:00+08:00',
                parameter: { parameterName: '30' },
              },
              {
                startTime: '2026-04-13T18:00:00+08:00',
                endTime: '2026-04-14T06:00:00+08:00',
                parameter: { parameterName: '26' },
              },
              {
                startTime: '2026-04-14T06:00:00+08:00',
                endTime: '2026-04-14T18:00:00+08:00',
                parameter: { parameterName: '29' },
              },
            ],
          },
        ],
      },
    ],
  },
};

const mockTownshipForecastResponse = {
  records: {
    Locations: [
      {
        Location: [
          {
            LocationName: '板橋區',
            WeatherElement: [
              {
                ElementName: '溫度',
                Time: [
                  {
                    DataTime: '2026-04-13T06:00:00+08:00',
                    ElementValue: [{ Temperature: '25' }],
                  },
                  {
                    DataTime: '2026-04-13T09:00:00+08:00',
                    ElementValue: [{ Temperature: '28' }],
                  },
                  {
                    DataTime: '2026-04-13T18:00:00+08:00',
                    ElementValue: [{ Temperature: '22' }],
                  },
                  {
                    DataTime: '2026-04-14T09:00:00+08:00',
                    ElementValue: [{ Temperature: '27' }],
                  },
                  {
                    DataTime: '2026-04-14T18:00:00+08:00',
                    ElementValue: [{ Temperature: '20' }],
                  },
                ],
              },
              {
                ElementName: '相對濕度',
                Time: [
                  {
                    DataTime: '2026-04-13T06:00:00+08:00',
                    ElementValue: [{ RelativeHumidity: '66' }],
                  },
                  {
                    DataTime: '2026-04-13T09:00:00+08:00',
                    ElementValue: [{ RelativeHumidity: '72' }],
                  },
                  {
                    DataTime: '2026-04-13T18:00:00+08:00',
                    ElementValue: [{ RelativeHumidity: '80' }],
                  },
                  {
                    DataTime: '2026-04-14T09:00:00+08:00',
                    ElementValue: [{ RelativeHumidity: '75' }],
                  },
                  {
                    DataTime: '2026-04-14T18:00:00+08:00',
                    ElementValue: [{ RelativeHumidity: '82' }],
                  },
                ],
              },
              {
                ElementName: '3小時降雨機率',
                Time: [
                  {
                    StartTime: '2026-04-13T06:00:00+08:00',
                    EndTime: '2026-04-13T09:00:00+08:00',
                    ElementValue: [{ ProbabilityOfPrecipitation: '60' }],
                  },
                  {
                    StartTime: '2026-04-13T09:00:00+08:00',
                    EndTime: '2026-04-13T12:00:00+08:00',
                    ElementValue: [{ ProbabilityOfPrecipitation: '10' }],
                  },
                  {
                    StartTime: '2026-04-13T18:00:00+08:00',
                    EndTime: '2026-04-13T21:00:00+08:00',
                    ElementValue: [{ ProbabilityOfPrecipitation: '20' }],
                  },
                  {
                    StartTime: '2026-04-14T09:00:00+08:00',
                    EndTime: '2026-04-14T12:00:00+08:00',
                    ElementValue: [{ ProbabilityOfPrecipitation: '30' }],
                  },
                  {
                    StartTime: '2026-04-14T18:00:00+08:00',
                    EndTime: '2026-04-14T21:00:00+08:00',
                    ElementValue: [{ ProbabilityOfPrecipitation: '40' }],
                  },
                ],
              },
              {
                ElementName: '天氣現象',
                Time: [
                  {
                    StartTime: '2026-04-13T06:00:00+08:00',
                    EndTime: '2026-04-13T09:00:00+08:00',
                    ElementValue: [{ Weather: '陰短暫雨', WeatherCode: '12' }],
                  },
                  {
                    StartTime: '2026-04-13T09:00:00+08:00',
                    EndTime: '2026-04-13T12:00:00+08:00',
                    ElementValue: [{ Weather: '晴時多雲', WeatherCode: '2' }],
                  },
                  {
                    StartTime: '2026-04-13T18:00:00+08:00',
                    EndTime: '2026-04-13T21:00:00+08:00',
                    ElementValue: [{ Weather: '多雲', WeatherCode: '4' }],
                  },
                  {
                    StartTime: '2026-04-14T09:00:00+08:00',
                    EndTime: '2026-04-14T12:00:00+08:00',
                    ElementValue: [{ Weather: '多雲時陰', WeatherCode: '5' }],
                  },
                  {
                    StartTime: '2026-04-14T18:00:00+08:00',
                    EndTime: '2026-04-14T21:00:00+08:00',
                    ElementValue: [{ Weather: '短暫雨', WeatherCode: '8' }],
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

const mockCountyUvResponse = {
  records: {
    Locations: [
      {
        Location: [
          {
            LocationName: '臺北市',
            WeatherElement: [
              {
                ElementName: '紫外線指數',
                Time: [
                  {
                    StartTime: '2026-04-13T06:00:00+08:00',
                    EndTime: '2026-04-13T18:00:00+08:00',
                    ElementValue: [{ UVIndex: '7', UVExposureLevel: '高量級' }],
                  },
                  {
                    StartTime: '2026-04-14T06:00:00+08:00',
                    EndTime: '2026-04-14T18:00:00+08:00',
                    ElementValue: [{ UVIndex: '6', UVExposureLevel: '高量級' }],
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

const mockTownshipUvResponse = {
  records: {
    Locations: [
      {
        Location: [
          {
            LocationName: '板橋區',
            WeatherElement: [
              {
                ElementName: '紫外線指數',
                Time: [
                  {
                    StartTime: '2026-04-13T06:00:00+08:00',
                    EndTime: '2026-04-13T18:00:00+08:00',
                    ElementValue: [{ UVIndex: '6', UVExposureLevel: '高量級' }],
                  },
                  {
                    StartTime: '2026-04-14T06:00:00+08:00',
                    EndTime: '2026-04-14T18:00:00+08:00',
                    ElementValue: [{ UVIndex: '5', UVExposureLevel: '中量級' }],
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
 * @param {Record<string, string>} params Query params to attach to the weather route URL.
 * @returns {Request} Request instance for the weather API route.
 */
function createRequest(params) {
  const url = new URL('http://localhost:3000/api/weather');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return new Request(url);
}

/**
 * @param {unknown} payload JSON payload.
 * @param {number} [status] HTTP status code.
 * @returns {Response} Mocked fetch response.
 */
function createJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * @param {string | URL | Request} input Fetch input.
 * @returns {string} Request URL string.
 */
function getRequestUrl(input) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * @returns {import('vitest').Mock} Stubbed global fetch as a Vitest mock.
 */
function getFetchMock() {
  return /** @type {import('vitest').Mock} */ (globalThis.fetch);
}

/**
 * @param {string} county County AQI record.
 * @param {string} value AQI value.
 * @param {string} status AQI status.
 * @returns {{ records: Array<{ county: string, aqi: string, status: string }> }} EPA payload.
 */
function createAqiPayload(county, value, status) {
  return {
    records: [{ county, aqi: value, status }],
  };
}

describe('GET /api/weather', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv('CWA_API_KEY', 'test-cwa-key');
    vi.stubEnv('EPA_API_KEY', 'test-epa-key');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('應轉發 county-only params，並回傳 route contract 與 cache header', async () => {
    getFetchMock().mockImplementation(async (input) => {
      const url = getRequestUrl(input);
      if (url.includes('F-C0032-001')) return createJsonResponse(mockCountyForecastResponse);
      if (url.includes('F-D0047-063')) return createJsonResponse(mockCountyUvResponse);
      if (url.includes('aqx_p_432')) return createJsonResponse(createAqiPayload('臺北市', '45', '良好'));
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const response = await GET(createRequest({ county: '臺北市' }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('locationName=%E8%87%BA%E5%8C%97%E5%B8%82'),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('s-maxage=600, stale-while-revalidate=300');
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { locationName: '臺北市', locationNameShort: '臺北' },
    });
  });

  it('應依真實 township dataset 回傳正規化後的 route contract', async () => {
    getFetchMock().mockImplementation(async (input) => {
      const url = getRequestUrl(input);
      if (url.includes('F-D0047-069')) return createJsonResponse(mockTownshipForecastResponse);
      if (url.includes('F-D0047-071')) return createJsonResponse(mockTownshipUvResponse);
      if (url.includes('aqx_p_432')) return createJsonResponse(createAqiPayload('新北市', '52', '普通'));
      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const response = await GET(createRequest({ county: '新北市', township: '板橋區' }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('LocationName=%E6%9D%BF%E6%A9%8B%E5%8D%80'),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        locationName: '新北市 · 板橋區',
        locationNameShort: '新北 · 板橋',
        today: {
          currentTemp: 28,
          eveningTemp: 22,
          weatherDesc: '晴時多雲',
          weatherCode: '2',
          rainProb: 10,
          humidity: 72,
          uv: { value: 6, level: '高量級' },
          aqi: { value: 52, status: '普通' },
        },
        tomorrow: {
          morningTemp: 27,
          eveningTemp: 20,
          weatherDesc: '多雲時陰',
          weatherCode: '5',
          rainProb: 30,
          humidity: 75,
          uv: { value: 5, level: '中量級' },
        },
      },
    });
  });

  it('應把 service validation error 映射成 400 contract', async () => {
    const response = await GET(createRequest({}));

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Missing required parameter: county',
    });
  });

  it('應把 service upstream error 映射成 502 contract', async () => {
    getFetchMock().mockResolvedValueOnce(createJsonResponse({ error: 'down' }, 503));

    const response = await GET(createRequest({ county: '臺北市' }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to fetch weather data',
    });
  });

  it('應遮罩 internal 500 message，不把 env 缺值細節回給 client', async () => {
    vi.unstubAllEnvs();

    const response = await GET(createRequest({ county: '臺北市' }));

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to fetch weather data',
    });
  });

  it('非 Error throw 時仍應回傳 generic 502 body', async () => {
    getFetchMock().mockRejectedValueOnce('upstream exploded');

    const response = await GET(createRequest({ county: '臺北市' }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to fetch weather data',
    });
  });
});
