import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import getWeatherForecast, {
  getWeatherForecastErrorStatus,
  getWeatherForecastPublicErrorMessage,
} from '@/service/weather-forecast-service';
import { GET } from '@/app/api/weather/route';

vi.mock('@/service/weather-forecast-service', () => ({
  __esModule: true,
  default: vi.fn(),
  getWeatherForecastErrorStatus: vi.fn(),
  getWeatherForecastPublicErrorMessage: vi.fn(),
}));

const mockedGetWeatherForecast = /** @type {import('vitest').Mock} */ (getWeatherForecast);
const mockedGetWeatherForecastErrorStatus = /** @type {import('vitest').Mock} */ (
  getWeatherForecastErrorStatus
);
const mockedGetWeatherForecastPublicErrorMessage = /** @type {import('vitest').Mock} */ (
  getWeatherForecastPublicErrorMessage
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
    mockedGetWeatherForecastPublicErrorMessage.mockReset();
    mockedGetWeatherForecastErrorStatus.mockReturnValue(502);
    mockedGetWeatherForecastPublicErrorMessage.mockReturnValue('Failed to fetch weather data');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('應轉發 county-only params，並回傳 route contract 與 cache header', async () => {
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
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { locationName: '臺北市', locationNameShort: '臺北' },
    });
  });

  it('應原樣轉發 township params 給 service', async () => {
    mockedGetWeatherForecast.mockResolvedValue({
      locationName: '台北市 · 板橋區',
      locationNameShort: '台北 · 板橋',
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
        eveningTemp: 20,
        rainProb: 30,
        humidity: 75,
        uv: null,
      },
    });

    const response = await GET(createRequest({ county: '台北市', township: '板橋區' }));

    expect(mockedGetWeatherForecast).toHaveBeenCalledWith({
      county: '台北市',
      township: '板橋區',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { locationNameShort: '台北 · 板橋' },
    });
  });

  it('應把 service validation error 映射成 400 contract', async () => {
    const validationError = new Error('Missing required parameter: county');
    mockedGetWeatherForecast.mockRejectedValue(validationError);
    mockedGetWeatherForecastErrorStatus.mockReturnValue(400);
    mockedGetWeatherForecastPublicErrorMessage.mockReturnValue('Missing required parameter: county');

    const response = await GET(createRequest({}));

    expect(mockedGetWeatherForecastErrorStatus).toHaveBeenCalledWith(validationError);
    expect(mockedGetWeatherForecastPublicErrorMessage).toHaveBeenCalledWith(validationError);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Missing required parameter: county',
    });
  });

  it('應把 service upstream error 映射成 502 contract', async () => {
    const upstreamError = new Error('Failed to fetch weather data');
    mockedGetWeatherForecast.mockRejectedValue(upstreamError);
    mockedGetWeatherForecastErrorStatus.mockReturnValue(502);

    const response = await GET(createRequest({ county: '臺北市' }));

    expect(mockedGetWeatherForecastErrorStatus).toHaveBeenCalledWith(upstreamError);
    expect(mockedGetWeatherForecastPublicErrorMessage).toHaveBeenCalledWith(upstreamError);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to fetch weather data',
    });
  });

  it('應遮罩 internal 500 message，不把 env 缺值細節回給 client', async () => {
    const internalError = new Error('Missing required server env: CWA_API_KEY');
    mockedGetWeatherForecast.mockRejectedValue(internalError);
    mockedGetWeatherForecastErrorStatus.mockReturnValue(500);
    mockedGetWeatherForecastPublicErrorMessage.mockReturnValue('Failed to fetch weather data');

    const response = await GET(createRequest({ county: '臺北市' }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to fetch weather data',
    });
  });

  it('非 Error throw 時仍應回傳 generic 502 body', async () => {
    mockedGetWeatherForecast.mockRejectedValue('upstream exploded');
    mockedGetWeatherForecastErrorStatus.mockReturnValue(502);

    const response = await GET(createRequest({ county: '臺北市' }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Failed to fetch weather data',
    });
  });
});
