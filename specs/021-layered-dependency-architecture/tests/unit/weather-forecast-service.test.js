import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatLocationName,
  formatLocationNameShort,
  getForecastIds,
} from '@/service/weather-location-service';
import { requestCwaJson, requestEpaJson } from '@/repo/server/weather-api-repo';
import getWeatherForecast, {
  WeatherForecastError,
  getWeatherForecastErrorStatus,
} from '@/service/weather-forecast-service';

vi.mock('@/service/weather-location-service', () => ({
  getForecastIds: vi.fn(),
  formatLocationName: vi.fn(),
  formatLocationNameShort: vi.fn(),
}));

vi.mock('@/repo/server/weather-api-repo', () => ({
  requestCwaJson: vi.fn(),
  requestEpaJson: vi.fn(),
}));

const mockedGetForecastIds = /** @type {import('vitest').Mock} */ (getForecastIds);
const mockedFormatLocationName = /** @type {import('vitest').Mock} */ (formatLocationName);
const mockedFormatLocationNameShort = /** @type {import('vitest').Mock} */ (
  formatLocationNameShort
);
const mockedRequestCwaJson = /** @type {import('vitest').Mock} */ (requestCwaJson);
const mockedRequestEpaJson = /** @type {import('vitest').Mock} */ (requestEpaJson);

const countyForecastIds = { threeHour: 'F-D0047-061', twelveHour: 'F-D0047-063' };
const townshipForecastIds = { threeHour: 'F-D0047-037', twelveHour: 'F-D0047-039' };

const countyForecastResponse = {
  records: {
    location: [
      {
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
                parameter: { parameterName: '10' },
              },
              {
                startTime: '2026-04-14 06:00:00',
                endTime: '2026-04-14 18:00:00',
                parameter: { parameterName: '30' },
              },
            ],
          },
          {
            elementName: 'MinT',
            time: [
              {
                startTime: '2026-04-13 06:00:00',
                endTime: '2026-04-13 18:00:00',
                parameter: { parameterName: '24' },
              },
              {
                startTime: '2026-04-14 06:00:00',
                endTime: '2026-04-14 18:00:00',
                parameter: { parameterName: '23' },
              },
            ],
          },
          {
            elementName: 'MaxT',
            time: [
              {
                startTime: '2026-04-13 06:00:00',
                endTime: '2026-04-13 18:00:00',
                parameter: { parameterName: '30' },
              },
              {
                startTime: '2026-04-14 06:00:00',
                endTime: '2026-04-14 18:00:00',
                parameter: { parameterName: '29' },
              },
            ],
          },
        ],
      },
    ],
  },
};

const countyUvResponse = {
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
                    StartTime: '2026-04-13 06:00:00',
                    EndTime: '2026-04-13 18:00:00',
                    ElementValue: [{ UVIndex: '7', UVExposureLevel: '高量級' }],
                  },
                  {
                    StartTime: '2026-04-14 06:00:00',
                    EndTime: '2026-04-14 18:00:00',
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

const townshipForecastResponse = {
  records: {
    Locations: [
      {
        Location: [
          {
            LocationName: '臺東市',
            WeatherElement: [
              {
                ElementName: '溫度',
                Time: [
                  { DataTime: '2026-04-13 06:00:00', ElementValue: [{ Temperature: '25' }] },
                  { DataTime: '2026-04-13 09:00:00', ElementValue: [{ Temperature: '28' }] },
                  { DataTime: '2026-04-13 18:00:00', ElementValue: [{ Temperature: '22' }] },
                  { DataTime: '2026-04-14 09:00:00', ElementValue: [{ Temperature: '27' }] },
                  { DataTime: '2026-04-14 21:00:00', ElementValue: [{ Temperature: '21' }] },
                ],
              },
              {
                ElementName: '相對濕度',
                Time: [
                  {
                    DataTime: '2026-04-13 06:00:00',
                    ElementValue: [{ RelativeHumidity: '68' }],
                  },
                  {
                    DataTime: '2026-04-13 09:00:00',
                    ElementValue: [{ RelativeHumidity: '72' }],
                  },
                  {
                    DataTime: '2026-04-13 18:00:00',
                    ElementValue: [{ RelativeHumidity: '80' }],
                  },
                  {
                    DataTime: '2026-04-14 09:00:00',
                    ElementValue: [{ RelativeHumidity: '75' }],
                  },
                  {
                    DataTime: '2026-04-14 21:00:00',
                    ElementValue: [{ RelativeHumidity: '82' }],
                  },
                ],
              },
              {
                ElementName: '3小時降雨機率',
                Time: [
                  {
                    DataTime: '2026-04-13 06:00:00',
                    ElementValue: [{ ProbabilityOfPrecipitation: '5' }],
                  },
                  {
                    DataTime: '2026-04-13 09:00:00',
                    ElementValue: [{ ProbabilityOfPrecipitation: '10' }],
                  },
                  {
                    DataTime: '2026-04-13 18:00:00',
                    ElementValue: [{ ProbabilityOfPrecipitation: '20' }],
                  },
                  {
                    DataTime: '2026-04-14 09:00:00',
                    ElementValue: [{ ProbabilityOfPrecipitation: '30' }],
                  },
                  {
                    DataTime: '2026-04-14 21:00:00',
                    ElementValue: [{ ProbabilityOfPrecipitation: '40' }],
                  },
                ],
              },
              {
                ElementName: '天氣現象',
                Time: [
                  {
                    DataTime: '2026-04-13 06:00:00',
                    ElementValue: [{ Weather: '陰', WeatherCode: '7' }],
                  },
                  {
                    DataTime: '2026-04-13 09:00:00',
                    ElementValue: [{ Weather: '晴時多雲', WeatherCode: '2' }],
                  },
                  {
                    DataTime: '2026-04-13 18:00:00',
                    ElementValue: [{ Weather: '多雲', WeatherCode: '4' }],
                  },
                  {
                    DataTime: '2026-04-14 09:00:00',
                    ElementValue: [{ Weather: '多雲時陰', WeatherCode: '5' }],
                  },
                  {
                    DataTime: '2026-04-14 21:00:00',
                    ElementValue: [{ Weather: '陰短暫雨', WeatherCode: '12' }],
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

const townshipUvResponse = {
  records: {
    Locations: [
      {
        Location: [
          {
            LocationName: '臺東市',
            WeatherElement: [
              {
                ElementName: '紫外線指數',
                Time: [
                  {
                    StartTime: '2026-04-13 06:00:00',
                    EndTime: '2026-04-13 18:00:00',
                    ElementValue: [{ UVIndex: '6', UVExposureLevel: '高量級' }],
                  },
                  {
                    StartTime: '2026-04-14 06:00:00',
                    EndTime: '2026-04-14 18:00:00',
                    ElementValue: [{ UVIndex: '4', UVExposureLevel: '中量級' }],
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

describe('getWeatherForecast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-13T10:00:00+08:00'));
    vi.stubEnv('CWA_API_KEY', 'test-cwa-key');
    vi.stubEnv('EPA_API_KEY', 'test-epa-key');
    mockedGetForecastIds.mockReset();
    mockedFormatLocationName.mockReset();
    mockedFormatLocationNameShort.mockReset();
    mockedRequestCwaJson.mockReset();
    mockedRequestEpaJson.mockReset();

    mockedFormatLocationName.mockImplementation((county, township) =>
      township ? `${county} · ${township}` : county,
    );
    mockedFormatLocationNameShort.mockImplementation((county, township) =>
      township
        ? `${county.replace(/[縣市]$/, '')} · ${township.replace(/[區鄉鎮市]$/, '')}`
        : county.replace(/[縣市]$/, ''),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('normalizes county input and returns normalized county weather shape', async () => {
    mockedGetForecastIds.mockReturnValue(countyForecastIds);
    mockedRequestCwaJson.mockImplementation((url) => {
      if (url.includes('F-C0032-001')) return Promise.resolve(countyForecastResponse);
      if (url.includes(countyForecastIds.twelveHour)) return Promise.resolve(countyUvResponse);
      return Promise.reject(new Error(`Unexpected CWA URL: ${url}`));
    });
    mockedRequestEpaJson.mockResolvedValue([
      { county: '臺北市', aqi: '45', status: '良好' },
    ]);

    const result = await getWeatherForecast({ county: ' 台北市 ' });

    expect(mockedGetForecastIds).toHaveBeenCalledWith('臺北市');
    expect(mockedRequestCwaJson).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('locationName=%E8%87%BA%E5%8C%97%E5%B8%82'),
    );
    expect(result).toEqual({
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
        uv: { value: 5, level: '中量級' },
      },
    });
  });

  it('normalizes township input and picks current night and tomorrow township periods', async () => {
    mockedGetForecastIds.mockReturnValue(townshipForecastIds);
    mockedRequestCwaJson.mockImplementation((url) => {
      if (url.includes(townshipForecastIds.threeHour)) {
        expect(url).toContain('LocationName=%E8%87%BA%E6%9D%B1%E5%B8%82');
        return Promise.resolve(townshipForecastResponse);
      }
      if (url.includes(townshipForecastIds.twelveHour)) {
        expect(url).toContain('LocationName=%E8%87%BA%E6%9D%B1%E5%B8%82');
        return Promise.resolve(townshipUvResponse);
      }
      return Promise.reject(new Error(`Unexpected CWA URL: ${url}`));
    });
    mockedRequestEpaJson.mockResolvedValue([
      { county: '臺東縣', aqi: '21', status: '良好' },
    ]);

    const result = await getWeatherForecast({
      county: ' 台東縣 ',
      township: ' 台東市 ',
    });

    expect(mockedGetForecastIds).toHaveBeenCalledWith('臺東縣');
    expect(result).toEqual({
      locationName: '臺東縣 · 臺東市',
      locationNameShort: '臺東 · 臺東',
      today: {
        currentTemp: 28,
        weatherDesc: '晴時多雲',
        weatherCode: '2',
        morningTemp: 28,
        eveningTemp: 22,
        rainProb: 10,
        humidity: 72,
        uv: { value: 6, level: '高量級' },
        aqi: { value: 21, status: '良好' },
      },
      tomorrow: {
        weatherDesc: '多雲時陰',
        weatherCode: '5',
        morningTemp: 27,
        eveningTemp: 21,
        rainProb: 30,
        humidity: 75,
        uv: { value: 4, level: '中量級' },
      },
    });
  });

  it('falls back to null uv and aqi when optional upstream calls fail', async () => {
    mockedGetForecastIds.mockReturnValue(countyForecastIds);
    mockedRequestCwaJson.mockImplementation((url) => {
      if (url.includes('F-C0032-001')) return Promise.resolve(countyForecastResponse);
      if (url.includes(countyForecastIds.twelveHour)) return Promise.reject(new Error('UV down'));
      return Promise.reject(new Error(`Unexpected CWA URL: ${url}`));
    });
    mockedRequestEpaJson.mockRejectedValue(new Error('EPA down'));

    const result = await getWeatherForecast({ county: '臺北市' });

    expect(result.today.uv).toBeNull();
    expect(result.today.aqi).toBeNull();
    expect(result.tomorrow.uv).toBeNull();
  });

  it('wraps primary upstream failures as WeatherForecastError 502', async () => {
    mockedGetForecastIds.mockReturnValue(countyForecastIds);
    mockedRequestCwaJson.mockRejectedValue(new Error('CWA down'));
    mockedRequestEpaJson.mockResolvedValue([]);

    await expect(getWeatherForecast({ county: '臺北市' })).rejects.toMatchObject({
      name: 'WeatherForecastError',
      statusCode: 502,
      message: 'Failed to fetch weather data',
    });
  });

  it('fails fast when a required upstream API key is missing', async () => {
    vi.stubEnv('CWA_API_KEY', '   ');
    mockedGetForecastIds.mockReturnValue(countyForecastIds);

    const error = await getWeatherForecast({ county: '臺北市' }).catch((caught) => caught);

    expect(error).toBeInstanceOf(WeatherForecastError);
    expect(error.message).toBe('Missing required server env: CWA_API_KEY');
    expect(getWeatherForecastErrorStatus(error)).toBe(500);
    expect(mockedRequestCwaJson).not.toHaveBeenCalled();
    expect(mockedRequestEpaJson).not.toHaveBeenCalled();
  });

  it('also fails fast when EPA_API_KEY is missing before any repo call starts', async () => {
    vi.stubEnv('EPA_API_KEY', '   ');
    mockedGetForecastIds.mockReturnValue(countyForecastIds);

    const error = await getWeatherForecast({ county: '臺北市' }).catch((caught) => caught);

    expect(error).toBeInstanceOf(WeatherForecastError);
    expect(error.message).toBe('Missing required server env: EPA_API_KEY');
    expect(getWeatherForecastErrorStatus(error)).toBe(500);
    expect(mockedRequestCwaJson).not.toHaveBeenCalled();
    expect(mockedRequestEpaJson).not.toHaveBeenCalled();
  });

  it('wraps normalization throws as WeatherForecastError 502', async () => {
    mockedGetForecastIds.mockReturnValue(countyForecastIds);
    mockedRequestCwaJson.mockImplementation((url) => {
      if (url.includes('F-C0032-001')) return Promise.resolve({});
      if (url.includes(countyForecastIds.twelveHour)) return Promise.resolve(countyUvResponse);
      return Promise.reject(new Error(`Unexpected CWA URL: ${url}`));
    });
    mockedRequestEpaJson.mockResolvedValue([
      { county: '臺北市', aqi: '45', status: '良好' },
    ]);

    const error = await getWeatherForecast({ county: '臺北市' }).catch((caught) => caught);

    expect(error).toBeInstanceOf(WeatherForecastError);
    expect(error.message).toBe('Failed to fetch weather data');
    expect(getWeatherForecastErrorStatus(error)).toBe(502);
  });

  it('throws WeatherForecastError 400 when county is missing after normalization', async () => {
    await expect(getWeatherForecast({ county: '   ', township: '台東市' })).rejects.toMatchObject({
      name: 'WeatherForecastError',
      statusCode: 400,
      message: 'Missing required parameter: county',
    });
    expect(WeatherForecastError).toBeDefined();
  });
});
