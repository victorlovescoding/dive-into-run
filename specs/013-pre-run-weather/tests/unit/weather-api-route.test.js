import { describe, it, expect, vi, beforeEach } from 'vitest';
import getWeatherForecast, {
  getWeatherForecastErrorStatus,
} from '@/service/weather-forecast-service';
import { GET } from '@/app/api/weather/route';

vi.mock('@/service/weather-forecast-service', () => ({
  __esModule: true,
  default: vi.fn(),
  getWeatherForecastErrorStatus: vi.fn(),
}));

const mockedGetWeatherForecast = /** @type {import('vitest').Mock} */ (getWeatherForecast);
const mockedGetWeatherForecastErrorStatus = /** @type {import('vitest').Mock} */ (
  getWeatherForecastErrorStatus
);

/**
 * @param {Record<string, string>} params Query params to attach to the weather route URL.
 * @returns {Request} Request instance for the weather API route.
 */
function createRequest(params) {
  const url = new URL('http://localhost:3000/api/weather');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return new Request(url);
}

describe('GET /api/weather', () => {
  beforeEach(() => {
    mockedGetWeatherForecast.mockReset();
    mockedGetWeatherForecastErrorStatus.mockReset();
    mockedGetWeatherForecastErrorStatus.mockReturnValue(502);
  });

  it('should forward county-only params to the forecast service and return cacheable JSON', async () => {
    mockedGetWeatherForecast.mockResolvedValue({
      locationName: '臺北市',
      locationNameShort: '臺北',
      today: {
        currentTemp: 30,
        weatherDesc: '晴時多雲',
        weatherCode: '2',
        morningTemp: 30,
        eveningTemp: 24,
        rainProb: 10,
        humidity: 70,
        uv: { value: 7, level: '高量級' },
        aqi: { value: 45, status: '良好' },
      },
      tomorrow: {
        weatherDesc: '多雲時陰',
        weatherCode: '5',
        morningTemp: 29,
        eveningTemp: 23,
        rainProb: 30,
        humidity: 70,
        uv: { value: 6, level: '高量級' },
      },
    });

    const response = await GET(createRequest({ county: '臺北市' }));

    expect(mockedGetWeatherForecast).toHaveBeenCalledWith({
      county: '臺北市',
      township: null,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('s-maxage=600, stale-while-revalidate=300');
    await expect(response.json()).resolves.toMatchObject({ ok: true, data: { locationName: '臺北市' } });
  });

  it('should forward township params to the forecast service', async () => {
    mockedGetWeatherForecast.mockResolvedValue({
      locationName: '新北市 · 板橋區',
      locationNameShort: '新北 · 板橋',
      today: {
        currentTemp: 28,
        weatherDesc: '晴時多雲',
        weatherCode: '2',
        morningTemp: 28,
        eveningTemp: 22,
        rainProb: 10,
        humidity: 72,
        uv: null,
        aqi: null,
      },
      tomorrow: {
        weatherDesc: '多雲時陰',
        weatherCode: '5',
        morningTemp: 27,
        eveningTemp: 19,
        rainProb: 30,
        humidity: 75,
        uv: null,
      },
    });

    const response = await GET(createRequest({ county: '新北市', township: '板橋區' }));

    expect(mockedGetWeatherForecast).toHaveBeenCalledWith({
      county: '新北市',
      township: '板橋區',
    });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { locationNameShort: '新北 · 板橋' },
    });
  });

  it('should map service validation errors to the route contract', async () => {
    mockedGetWeatherForecast.mockRejectedValue(new Error('Missing required parameter: county'));
    mockedGetWeatherForecastErrorStatus.mockReturnValue(400);

    const response = await GET(createRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Missing required parameter: county',
    });
  });

  it('should map upstream failures to a 502 response', async () => {
    mockedGetWeatherForecast.mockRejectedValue(new Error('Failed to fetch weather data'));
    mockedGetWeatherForecastErrorStatus.mockReturnValue(502);

    const response = await GET(createRequest({ county: '臺北市' }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to fetch weather data',
    });
  });
});
