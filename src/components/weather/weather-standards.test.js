import { describe, expect, it } from 'vitest';
import {
  AQI_STANDARD_ROWS,
  AQI_STANDARD_SOURCE_URL,
  UV_STANDARD_ROWS,
  UV_STANDARD_SOURCE_URL,
  WEATHER_STANDARD_SOURCE_URLS,
  getCurrentStandardRow,
  getWeatherMetricAdvice,
} from './weather-standards';

describe('weather standards helper', () => {
  it('defines the approved official UV standard rows', () => {
    expect(UV_STANDARD_ROWS).toEqual([
      { id: 'uv-0-2', rangeLabel: '0-2', min: 0, max: 2, label: '低量級' },
      { id: 'uv-3-5', rangeLabel: '3-5', min: 3, max: 5, label: '中量級' },
      { id: 'uv-6-7', rangeLabel: '6-7', min: 6, max: 7, label: '高量級' },
      { id: 'uv-8-10', rangeLabel: '8-10', min: 8, max: 10, label: '過量級' },
      {
        id: 'uv-11-plus',
        rangeLabel: '11+',
        min: 11,
        max: Number.POSITIVE_INFINITY,
        label: '危險級',
      },
    ]);
  });

  it('defines the approved official AQI standard rows with split hazard ranges', () => {
    expect(AQI_STANDARD_ROWS).toEqual([
      { id: 'aqi-0-50', rangeLabel: '0-50', min: 0, max: 50, label: '良好' },
      { id: 'aqi-51-100', rangeLabel: '51-100', min: 51, max: 100, label: '普通' },
      {
        id: 'aqi-101-150',
        rangeLabel: '101-150',
        min: 101,
        max: 150,
        label: '對敏感族群不健康',
      },
      {
        id: 'aqi-151-200',
        rangeLabel: '151-200',
        min: 151,
        max: 200,
        label: '對所有族群不健康',
      },
      {
        id: 'aqi-201-300',
        rangeLabel: '201-300',
        min: 201,
        max: 300,
        label: '非常不健康',
      },
      { id: 'aqi-301-400', rangeLabel: '301-400', min: 301, max: 400, label: '危害' },
      { id: 'aqi-401-500', rangeLabel: '401-500', min: 401, max: 500, label: '危害' },
    ]);
  });

  it('matches current UV rows by inclusive boundaries', () => {
    expect(getCurrentStandardRow('uv', 0)?.id).toBe('uv-0-2');
    expect(getCurrentStandardRow('uv', 2)?.id).toBe('uv-0-2');
    expect(getCurrentStandardRow('uv', 3)?.id).toBe('uv-3-5');
    expect(getCurrentStandardRow('uv', 5)?.id).toBe('uv-3-5');
    expect(getCurrentStandardRow('uv', 6)?.id).toBe('uv-6-7');
    expect(getCurrentStandardRow('uv', 7)?.id).toBe('uv-6-7');
    expect(getCurrentStandardRow('uv', 8)?.id).toBe('uv-8-10');
    expect(getCurrentStandardRow('uv', 10)?.id).toBe('uv-8-10');
    expect(getCurrentStandardRow('uv', 11)?.id).toBe('uv-11-plus');
    expect(getCurrentStandardRow('uv', 12)?.id).toBe('uv-11-plus');
  });

  it('matches current AQI rows by inclusive boundaries', () => {
    expect(getCurrentStandardRow('aqi', 0)?.id).toBe('aqi-0-50');
    expect(getCurrentStandardRow('aqi', 50)?.id).toBe('aqi-0-50');
    expect(getCurrentStandardRow('aqi', 51)?.id).toBe('aqi-51-100');
    expect(getCurrentStandardRow('aqi', 100)?.id).toBe('aqi-51-100');
    expect(getCurrentStandardRow('aqi', 101)?.id).toBe('aqi-101-150');
    expect(getCurrentStandardRow('aqi', 150)?.id).toBe('aqi-101-150');
    expect(getCurrentStandardRow('aqi', 151)?.id).toBe('aqi-151-200');
    expect(getCurrentStandardRow('aqi', 200)?.id).toBe('aqi-151-200');
    expect(getCurrentStandardRow('aqi', 201)?.id).toBe('aqi-201-300');
    expect(getCurrentStandardRow('aqi', 300)?.id).toBe('aqi-201-300');
    expect(getCurrentStandardRow('aqi', 301)?.id).toBe('aqi-301-400');
    expect(getCurrentStandardRow('aqi', 400)?.id).toBe('aqi-301-400');
    expect(getCurrentStandardRow('aqi', 401)?.id).toBe('aqi-401-500');
    expect(getCurrentStandardRow('aqi', 450)?.id).toBe('aqi-401-500');
    expect(getCurrentStandardRow('aqi', 500)?.id).toBe('aqi-401-500');
  });

  it('returns no current row for null values', () => {
    expect(getCurrentStandardRow('uv', null)).toBeNull();
    expect(getCurrentStandardRow('aqi', null)).toBeNull();
    expect(getCurrentStandardRow('uv', undefined)).toBeNull();
    expect(getCurrentStandardRow('unknown', 50)).toBeNull();
  });

  it('returns no current row for invalid numeric values and non-number inputs', () => {
    expect(getCurrentStandardRow('uv', Number.NaN)).toBeNull();
    expect(getCurrentStandardRow('aqi', Number.NaN)).toBeNull();
    expect(getCurrentStandardRow('uv', -1)).toBeNull();
    expect(getCurrentStandardRow('aqi', -1)).toBeNull();
    expect(getCurrentStandardRow('aqi', 501)).toBeNull();
    expect(getCurrentStandardRow('uv', JSON.parse('"2"'))).toBeNull();
  });

  it('returns conservative one-line running advice without medical claims', () => {
    const advices = [
      getWeatherMetricAdvice('uv', '低量級'),
      getWeatherMetricAdvice('uv', '中量級'),
      getWeatherMetricAdvice('uv', '高量級'),
      getWeatherMetricAdvice('uv', '過量級'),
      getWeatherMetricAdvice('uv', '危險級'),
      getWeatherMetricAdvice('aqi', '良好'),
      getWeatherMetricAdvice('aqi', '普通'),
      getWeatherMetricAdvice('aqi', '對敏感族群不健康'),
      getWeatherMetricAdvice('aqi', '對所有族群不健康'),
      getWeatherMetricAdvice('aqi', '非常不健康'),
      getWeatherMetricAdvice('aqi', '危害'),
    ];

    expect(advices).toEqual([
      '可正常跑，留意補水',
      '補防曬，避開正午',
      '改清晨/傍晚，縮短曝曬',
      '改清晨/傍晚，縮短曝曬',
      '優先室內或避開曝曬',
      '可正常跑，留意體感',
      '可正常跑，敏感者留意體感',
      '降低強度，敏感者改室內',
      '縮短戶外時間，室內優先',
      '改室內，延後戶外跑',
      '改室內，延後戶外跑',
    ]);
    expect(advices.join(' ')).not.toMatch(/安全|醫療|心肺|Zone|課表|停止|不適合/);
    expect(getWeatherMetricAdvice('uv', '未知')).toBe('');
    expect(getWeatherMetricAdvice('aqi', '未知')).toBe('');
    expect(getWeatherMetricAdvice('unknown', '良好')).toBe('');
  });

  it('exposes only CWA and MOENV source URLs', () => {
    expect(UV_STANDARD_SOURCE_URL).toBe(
      'https://opendata.cwa.gov.tw/opendatadoc/insrtuction/CWA_Data_Standard.pdf',
    );
    expect(AQI_STANDARD_SOURCE_URL).toBe(
      'https://airtw.moenv.gov.tw/CHT/Information/Standard/AirQualityIndicatorNew.aspx',
    );
    expect(WEATHER_STANDARD_SOURCE_URLS).toEqual({
      uv: UV_STANDARD_SOURCE_URL,
      aqi: AQI_STANDARD_SOURCE_URL,
    });
  });
});
