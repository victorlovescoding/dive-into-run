/* eslint-disable jsdoc/require-jsdoc -- Focused UI regression test uses local mock data. */
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FavoritesBar from './FavoritesBar';

vi.mock('next/image', () => ({
  default: function MockImage() {
    return <span data-testid="weather-icon" />;
  },
}));

vi.mock('@/runtime/client/use-cases/weather-location-use-cases', () => ({
  formatLocationNameShort: (countyName, townshipName) =>
    townshipName ? `${countyName}${townshipName}` : countyName,
  getWeatherIconUrl: (weatherCode) => `/weather/${weatherCode}.svg`,
}));

const FAVORITE = {
  id: 'taipei-xinyi',
  countyCode: 'TPE',
  countyName: '臺北市',
  townshipCode: 'TPE-Xinyi',
  townshipName: '信義區',
  displaySuffix: null,
};
const WEATHER_STYLESHEET = readFileSync(
  `${process.cwd()}/src/components/weather/weather.module.css`,
  'utf8',
);

function getCssBlock(className) {
  const match = new RegExp(`\\.${className}\\s*{([\\s\\S]*?)\\n}`).exec(WEATHER_STYLESHEET);
  return match?.[1] ?? '';
}

describe('FavoritesBar', () => {
  it('makes the non-remove favorite area select the region while X only removes it', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onRemove = vi.fn();

    render(
      <FavoritesBar
        favorites={[FAVORITE]}
        summaries={{
          [FAVORITE.id]: {
            weatherCode: '',
            currentTemp: 26,
          },
        }}
        activeId={null}
        onSelect={onSelect}
        onRemove={onRemove}
      />,
    );

    const favoriteItem = screen.getByRole('listitem');
    const selectButton = within(favoriteItem).getByRole('button', {
      name: '切換到臺北市信義區',
    });
    const removeButton = within(favoriteItem).getByRole('button', {
      name: '移除臺北市信義區收藏',
    });

    expect(within(favoriteItem).getAllByRole('button')).toEqual([selectButton, removeButton]);
    expect(favoriteItem).toContainElement(selectButton);
    expect(favoriteItem).toContainElement(removeButton);
    expect(selectButton).not.toContainElement(removeButton);
    expect(removeButton).not.toContainElement(selectButton);
    expect(getCssBlock('favoriteChip')).toContain('gap: 0;');
    expect(getCssBlock('favoriteChip')).toContain('padding: 0;');
    expect(getCssBlock('chipSelectButton')).toContain('flex: 1 1 auto;');

    await user.click(selectButton);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(FAVORITE);
    expect(onRemove).not.toHaveBeenCalled();

    await user.click(removeButton);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(FAVORITE);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
