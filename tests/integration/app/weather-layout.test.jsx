import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeatherLayout, { metadata } from '@/app/weather/layout';
import { Fraunces } from 'next/font/google';

vi.mock('next/font/google', () => ({
  Fraunces: vi.fn(() => ({ variable: 'weather-fraunces-variable' })),
}));

const mockedFraunces = /** @type {import('vitest').Mock} */ (Fraunces);

describe('weather layout app entry', () => {
  it('exports the weather route metadata', () => {
    expect(metadata).toEqual({
      title: '天氣 | Dive Into Run',
      description: '跑步前查看天氣預報，選擇最佳跑步時段。',
    });
  });

  it('wraps child content with the configured Fraunces variable class', async () => {
    const user = userEvent.setup();

    render(
      <WeatherLayout>
        <button type="button">查看天氣</button>
      </WeatherLayout>,
    );

    const button = screen.getByRole('button', { name: '查看天氣' });
    await user.click(button);

    expect(document.body).toContainHTML(
      '<div class="weather-fraunces-variable"><button type="button">查看天氣</button></div>',
    );
    expect(mockedFraunces).toHaveBeenCalledWith({
      subsets: ['latin'],
      display: 'swap',
      variable: '--font-fraunces',
      axes: ['SOFT', 'WONK', 'opsz'],
    });
  });
});
