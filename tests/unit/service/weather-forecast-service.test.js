import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import getWeatherForecast, {
  WeatherForecastError,
  getWeatherForecastErrorStatus,
  getWeatherForecastPublicErrorMessage,
} from '@/service/weather-forecast-service';

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
 * @param {object} payload 要回傳的 JSON payload。
 * @returns {Promise<{ ok: true, json: () => Promise<object> }>} 模擬的成功 fetch response。
 */
function okJson(payload) {
  return Promise.resolve({
    ok: true,
    json: async () => payload,
  });
}

/**
 * @param {number} status 要回傳的 HTTP status。
 * @returns {Promise<{ ok: false, status: number, json: () => Promise<object> }>} 模擬的失敗 fetch response。
 */
function failedJson(status) {
  return Promise.resolve({
    ok: false,
    status,
    json: async () => ({}),
  });
}

/** @type {import('vitest').Mock} */
let fetchMock;

describe('getWeatherForecast', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('CWA_API_KEY', 'test-cwa-key');
    vi.stubEnv('EPA_API_KEY', 'test-epa-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('缺少 county 時應拋出 400 WeatherForecastError', async () => {
    await expect(getWeatherForecast({ county: null, now: NOW })).rejects.toMatchObject({
      message: 'Missing required parameter: county',
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('會先將 台 正規化成 臺，再走 county flow 的 fetch URL 與 WeatherInfo shape', async () => {
    fetchMock
      .mockImplementationOnce(() => okJson(mockCountyForecastResponse))
      .mockImplementationOnce(() => okJson(mockCountyUvResponse))
      .mockImplementationOnce(() =>
        okJson({
          records: [{ county: '臺北市', aqi: '45', status: '良好' }],
        }),
      );

    const result = await getWeatherForecast({ county: '台北市', now: NOW });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?Authorization=test-cwa-key&locationName=%E8%87%BA%E5%8C%97%E5%B8%82',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-063?Authorization=test-cwa-key',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://data.moenv.gov.tw/api/v2/aqx_p_432?api_key=test-epa-key&format=json&limit=1000',
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
        uv: { value: 6, level: '高量級' },
      },
    });
  });

  it('county flow 的 UV/EPA fallback 應回傳 null 而非整體失敗', async () => {
    fetchMock
      .mockImplementationOnce(() => okJson(mockCountyForecastResponse))
      .mockImplementationOnce(() => failedJson(503))
      .mockImplementationOnce(() => failedJson(503));

    const result = await getWeatherForecast({ county: '臺北市', now: NOW });

    expect(result.today.uv).toBeNull();
    expect(result.today.aqi).toBeNull();
    expect(result.tomorrow.uv).toBeNull();
  });

  it('應正規化 township flow，覆蓋 DataTime/day-night/明日夜間時段選擇', async () => {
    fetchMock
      .mockImplementationOnce(() => okJson(mockTownshipForecastResponse))
      .mockImplementationOnce(() => okJson(mockTownshipUvResponse))
      .mockImplementationOnce(() =>
        okJson({
          records: [{ county: '新北市', aqi: '52', status: '普通' }],
        }),
      );

    const result = await getWeatherForecast({
      county: '新北市',
      township: '板橋區',
      now: NOW,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-069?Authorization=test-cwa-key&LocationName=%E6%9D%BF%E6%A9%8B%E5%8D%80',
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-D0047-071?Authorization=test-cwa-key&LocationName=%E6%9D%BF%E6%A9%8B%E5%8D%80',
    );
    expect(result).toEqual({
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
        uv: { value: 6, level: '高量級' },
        aqi: { value: 52, status: '普通' },
      },
      tomorrow: {
        weatherDesc: '多雲時陰',
        weatherCode: '5',
        morningTemp: 27,
        eveningTemp: 20,
        rainProb: 30,
        humidity: 75,
        uv: { value: 5, level: '中量級' },
      },
    });
  });

  it('主要 CWA request 失敗時應轉成 502 WeatherForecastError', async () => {
    fetchMock
      .mockImplementationOnce(() => failedJson(503))
      .mockImplementationOnce(() => okJson(mockCountyUvResponse))
      .mockImplementationOnce(() => okJson({ records: [] }));

    await expect(getWeatherForecast({ county: '臺北市', now: NOW })).rejects.toMatchObject({
      message: 'Failed to fetch weather data',
      statusCode: 502,
    });
  });

  it('未知 county 時應拋出 400，且不呼叫 upstream repo', async () => {
    await expect(getWeatherForecast({ county: '火星市', now: NOW })).rejects.toMatchObject({
      message: 'Unknown county: 火星市',
      statusCode: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('缺少 server env 時應保留 500 WeatherForecastError', async () => {
    vi.unstubAllEnvs();

    const error = await getWeatherForecast({ county: '臺北市', now: NOW }).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(WeatherForecastError);
    expect(error).toMatchObject({
      message: 'Missing required server env: CWA_API_KEY',
      statusCode: 500,
    });
    expect(getWeatherForecastErrorStatus(error)).toBe(500);
    expect(getWeatherForecastPublicErrorMessage(error)).toBe('Failed to fetch weather data');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('township 找不到目標地點時應 fail closed，不可 fallback 到第一筆', async () => {
    fetchMock
      .mockImplementationOnce(() =>
        okJson({
          records: {
            Locations: [
              {
                Location: [
                  {
                    ...mockTownshipForecastResponse.records.Locations[0].Location[0],
                    LocationName: '三重區',
                  },
                ],
              },
            ],
          },
        }),
      )
      .mockImplementationOnce(() => okJson(mockTownshipUvResponse))
      .mockImplementationOnce(() =>
        okJson({
          records: [{ county: '新北市', aqi: '52', status: '普通' }],
        }),
      );

    const error = await getWeatherForecast({
      county: '新北市',
      township: '板橋區',
      now: NOW,
    }).catch((caught) => caught);

    expect(error).toMatchObject({
      message: 'Failed to fetch weather data',
      statusCode: 502,
    });
    expect(getWeatherForecastPublicErrorMessage(error)).toBe('Failed to fetch weather data');
  });

  it('UV lookup 找不到目標地點時應 fail closed，不可回第一筆 UV', async () => {
    fetchMock
      .mockImplementationOnce(() => okJson(mockCountyForecastResponse))
      .mockImplementationOnce(() =>
        okJson({
          records: {
            Locations: [
              {
                Location: [
                  {
                    ...mockCountyUvResponse.records.Locations[0].Location[0],
                    LocationName: '高雄市',
                  },
                ],
              },
            ],
          },
        }),
      )
      .mockImplementationOnce(() =>
        okJson({
          records: [{ county: '臺北市', aqi: '45', status: '良好' }],
        }),
      );

    const error = await getWeatherForecast({ county: '臺北市', now: NOW }).catch(
      (caught) => caught,
    );

    expect(error).toMatchObject({
      message: 'Failed to fetch weather data',
      statusCode: 502,
    });
    expect(getWeatherForecastPublicErrorMessage(error)).toBe('Failed to fetch weather data');
  });
});
