/* eslint-disable jsdoc/require-jsdoc -- Focused UI regression test uses local mock data. */
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WeatherCard from './WeatherCard';

vi.mock('next/image', () => ({
  default: function MockImage({ alt }) {
    return <span aria-label={alt} data-testid="weather-icon" />;
  },
}));

vi.mock('@/runtime/client/use-cases/weather-location-use-cases', () => ({
  getWeatherIconUrl: (weatherCode) => `/weather/${weatherCode}.svg`,
}));

const WEATHER_STYLESHEET = readFileSync(
  `${process.cwd()}/src/components/weather/weather.module.css`,
  'utf8',
);

function getCssBlock(className) {
  const match = new RegExp(`\\.${className}\\s*{([\\s\\S]*?)\\n}`).exec(WEATHER_STYLESHEET);
  return match?.[1] ?? '';
}

const FULL_WEATHER = {
  locationName: '臺北市 · 信義區',
  today: {
    currentTemp: 28,
    weatherDesc: '多雲',
    weatherCode: '02',
    morningTemp: 24,
    eveningTemp: 27,
    rainProb: 30,
    humidity: 68,
    uv: {
      value: 8,
      level: '過量級',
    },
    aqi: {
      value: 67,
      status: '普通',
    },
  },
  tomorrow: {
    weatherDesc: '短暫雨',
    weatherCode: '08',
    morningTemp: 23,
    eveningTemp: 26,
    rainProb: 40,
    humidity: 70,
    uv: {
      value: 5,
      level: '中量級',
    },
  },
};

function renderWeatherCard(weather = FULL_WEATHER) {
  return render(<WeatherCard {...weather} />);
}

function getMetricCell(metric) {
  return screen.getByTestId(`weather-metric-${metric}`);
}

describe('WeatherCard', () => {
  it('renders enhanced today UV and AQI metrics when values exist', () => {
    renderWeatherCard();

    const currentTemperature = screen.getByTestId('current-temperature');
    const uvMetric = getMetricCell('uv');
    const aqiMetric = getMetricCell('aqi');

    expect(currentTemperature.compareDocumentPosition(uvMetric)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByText('多雲').compareDocumentPosition(uvMetric)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(uvMetric).not.toBeNull();
    expect(within(uvMetric).getByText('紫外線')).toBeInTheDocument();
    expect(within(uvMetric).getByText('8')).toBeInTheDocument();
    expect(within(uvMetric).getByText('過量級')).toBeInTheDocument();
    expect(within(uvMetric).getByText('改清晨/傍晚，縮短曝曬')).toBeInTheDocument();

    const uvInfoButton = within(uvMetric).getByRole('button', {
      name: '查看紫外線等級說明',
    });
    expect(uvInfoButton).toHaveAttribute('aria-expanded', 'false');
    expect(uvInfoButton).toHaveAttribute('aria-controls', 'weather-standard-popover-uv');

    expect(aqiMetric).not.toBeNull();
    expect(within(aqiMetric).getByText('AQI')).toBeInTheDocument();
    expect(within(aqiMetric).getByText('67')).toBeInTheDocument();
    expect(within(aqiMetric).getByText('普通')).toBeInTheDocument();
    expect(within(aqiMetric).getByText('可正常跑，敏感者留意體感')).toBeInTheDocument();

    const aqiInfoButton = within(aqiMetric).getByRole('button', {
      name: '查看 AQI 等級說明',
    });
    expect(aqiInfoButton).toHaveAttribute('aria-expanded', 'false');
    expect(aqiInfoButton).toHaveAttribute('aria-controls', 'weather-standard-popover-aqi');

    const infoButtonCss = getCssBlock('metricInfoButton');
    expect(infoButtonCss).toContain('min-width: 44px;');
    expect(infoButtonCss).toContain('min-height: 44px;');
  });

  it('hides today UV level advice and info button when UV is null', () => {
    renderWeatherCard({
      ...FULL_WEATHER,
      today: {
        ...FULL_WEATHER.today,
        uv: null,
      },
    });

    const uvMetric = getMetricCell('uv');

    expect(within(uvMetric).getByText('紫外線')).toBeInTheDocument();
    expect(within(uvMetric).getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('過量級')).not.toBeInTheDocument();
    expect(screen.queryByText('改清晨/傍晚，縮短曝曬')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: '查看紫外線等級說明',
      }),
    ).not.toBeInTheDocument();
  });

  it('hides today AQI status advice and info button when AQI is null', () => {
    renderWeatherCard({
      ...FULL_WEATHER,
      today: {
        ...FULL_WEATHER.today,
        aqi: null,
      },
    });

    const aqiMetric = getMetricCell('aqi');

    expect(within(aqiMetric).getByText('AQI')).toBeInTheDocument();
    expect(within(aqiMetric).getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('普通')).not.toBeInTheDocument();
    expect(screen.queryByText('可正常跑，敏感者留意體感')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: '查看 AQI 等級說明',
      }),
    ).not.toBeInTheDocument();
  });

  it('keeps tomorrow summary to UV only without standards entry points', () => {
    renderWeatherCard();

    const tomorrowSummary = screen.getByText('降雨 40% · 濕度 70% · UV 5 中量級');

    expect(tomorrowSummary).toHaveTextContent('UV 5 中量級');
    expect(tomorrowSummary).not.toHaveTextContent('AQI');
    expect(screen.getAllByRole('button', { name: /等級說明/ })).toHaveLength(2);
  });
});
