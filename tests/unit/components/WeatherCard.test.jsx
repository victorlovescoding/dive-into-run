// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WeatherCard from '@/components/weather/WeatherCard';

vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className, style }) => (
    <img src={src} alt={alt} width={width} height={height} className={className} style={style} />
  ),
}));

const today = {
  currentTemp: 28,
  weatherDesc: '晴時多雲',
  weatherCode: '01',
  morningTemp: 25,
  eveningTemp: 22,
  rainProb: 20,
  humidity: 67,
  uv: { value: 5, level: '中量級' },
  aqi: { value: 42, status: '良好' },
};

const tomorrow = {
  weatherDesc: '多雲',
  weatherCode: '02',
  morningTemp: 24,
  eveningTemp: 21,
  rainProb: 30,
  humidity: 70,
  uv: { value: 4, level: '中量級' },
};

describe('WeatherCard standards info buttons', () => {
  it('renders SVG info icons without falling back to a text i badge', () => {
    render(<WeatherCard locationName="臺北市 · 大安區" today={today} tomorrow={tomorrow} />);

    const uvButton = screen.getByRole('button', { name: '查看紫外線等級說明' });
    const aqiButton = screen.getByRole('button', { name: '查看 AQI 等級說明' });

    for (const button of [uvButton, aqiButton]) {
      expect(button).toHaveAttribute('aria-controls', expect.stringContaining('weather-standard-popover'));
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).not.toHaveTextContent(/^i$/);
      expect(within(button).getByTestId('weather-standard-info-icon')).toHaveAttribute('aria-hidden', 'true');
    }
  });
});
