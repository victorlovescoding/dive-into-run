/* eslint-disable jsdoc/require-jsdoc -- Focused UI integration test uses local runtime fixtures. */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WeatherPageScreen from './WeatherPageScreen';

vi.mock('next/image', () => ({
  default: function MockImage({ alt }) {
    return <span aria-label={alt} data-testid="weather-icon" />;
  },
}));

vi.mock('@/runtime/client/use-cases/weather-location-use-cases', () => ({
  getWeatherIconUrl: (weatherCode) => `/weather/${weatherCode}.svg`,
}));

vi.mock('@/components/weather/TaiwanMap', () => ({
  default: function MockTaiwanMap() {
    return <button type="button" data-testid="taiwan-map">地圖控制</button>;
  },
}));

const SUCCESS_WEATHER = {
  locationName: '臺北市 · 信義區',
  today: {
    currentTemp: 28,
    weatherDesc: '多雲',
    weatherCode: '02',
    morningTemp: 24,
    eveningTemp: 27,
    rainProb: 30,
    humidity: 68,
    uv: { value: 8, level: '過量級' },
    aqi: { value: 67, status: '普通' },
  },
  tomorrow: {
    weatherDesc: '短暫雨',
    weatherCode: '08',
    morningTemp: 23,
    eveningTemp: 26,
    rainProb: 40,
    humidity: 70,
    uv: { value: 5, level: '中量級' },
  },
};

function setViewportWidth(width) {
  act(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
    window.dispatchEvent(new Event('resize'));
  });
}

function createRuntime(overrides = {}) {
  return {
    cardPanelRef: { current: null },
    favorites: [],
    favSummaries: {},
    activeFavoriteId: null,
    selectedLocation: {
      countyCode: 'TPE',
      countyName: '臺北市',
      townshipCode: '001',
      townshipName: '信義區',
    },
    mapLayer: 'county',
    weatherState: 'success',
    weatherData: SUCCESS_WEATHER,
    isFavoriteMutating: false,
    isFavorited: false,
    selectedCountyCode: 'TPE',
    selectedTownshipCode: '001',
    handleCountyClick: vi.fn(),
    handleTownshipClick: vi.fn(),
    handleIslandClick: vi.fn(),
    handleRetry: vi.fn(),
    handleBackToOverview: vi.fn(),
    handleFavoriteToggle: vi.fn(),
    handleFavoriteSelect: vi.fn(),
    handleFavoriteRemove: vi.fn(),
    ...overrides,
  };
}

function renderWeatherPage(runtime = createRuntime()) {
  return render(<WeatherPageScreen runtime={runtime} />);
}

afterEach(() => {
  setViewportWidth(1024);
});

describe('WeatherPageScreen', () => {
  it('passes mobile mode into WeatherCard and suppresses the existing weather sheet while standards sheet is open', async () => {
    const user = userEvent.setup();
    setViewportWidth(390);
    renderWeatherPage();

    const weatherSheetContent = screen.getByTestId('weather-sheet-content');
    const weatherSection = screen.getByLabelText('天氣資訊');

    expect(weatherSheetContent).toBeVisible();
    expect(weatherSection).not.toHaveAttribute('aria-hidden');

    await user.click(screen.getByRole('button', { name: '查看 AQI 等級說明' }));

    expect(screen.getByRole('dialog', { name: 'AQI 等級' })).toBeVisible();
    expect(weatherSheetContent).toBeInTheDocument();
    expect(weatherSection).toHaveAttribute('aria-hidden', 'true');

    await user.click(screen.getByRole('button', { name: '關閉 AQI 等級說明' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'AQI 等級' })).not.toBeInTheDocument();
    });
    expect(weatherSection).not.toHaveAttribute('aria-hidden');
    expect(weatherSheetContent).toBeVisible();
    expect(screen.getByRole('button', { name: '收合天氣資訊' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps focus inside the mobile standards dialog and inerts page content', async () => {
    const user = userEvent.setup();
    setViewportWidth(390);
    renderWeatherPage();

    await user.click(screen.getByRole('button', { name: '查看 AQI 等級說明' }));
    const dialog = screen.getByRole('dialog', { name: 'AQI 等級' });
    const pageContent = screen.getByTestId('weather-page-content');

    expect(pageContent).toHaveAttribute('aria-hidden', 'true');
    expect(pageContent).toHaveAttribute('inert');
    expect(screen.getByTestId('standards-sheet-scrim')).toHaveAttribute('tabIndex', '-1');

    const closeButton = within(dialog).getByRole('button', { name: '關閉 AQI 等級說明' });
    const sourceLink = within(dialog).getByRole('link', { name: '官方來源' });
    await waitFor(() => expect(closeButton).toHaveFocus());
    await user.tab();
    expect(sourceLink).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(sourceLink).toHaveFocus();
    expect(screen.getByRole('button', { name: '全台總覽', hidden: true })).not.toHaveFocus();
    expect(screen.getByTestId('taiwan-map')).not.toHaveFocus();
    expect(screen.getByRole('button', { name: '收合天氣資訊', hidden: true })).not.toHaveFocus();
  });

  it('closes mobile standards sheet on desktop mode switch and restores focus', async () => {
    const user = userEvent.setup();
    setViewportWidth(390);
    renderWeatherPage();

    await user.click(screen.getByRole('button', { name: '查看紫外線等級說明' }));
    expect(screen.getByRole('dialog', { name: '紫外線等級' })).toBeInTheDocument();

    setViewportWidth(1024);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '紫外線等級' })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '查看紫外線等級說明' })).toHaveFocus();
    });
    expect(screen.getByTestId('weather-page-content')).not.toHaveAttribute('inert');
  });

  it('cleans modal portal and page inert state when unmounted while open', async () => {
    const user = userEvent.setup();
    setViewportWidth(390);
    const { unmount } = renderWeatherPage();

    await user.click(screen.getByRole('button', { name: '查看 AQI 等級說明' }));
    expect(screen.getByRole('dialog', { name: 'AQI 等級' })).toBeInTheDocument();
    const pageContent = screen.getByTestId('weather-page-content');

    unmount();

    expect(screen.queryByRole('dialog', { name: 'AQI 等級' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('standards-sheet-scrim')).not.toBeInTheDocument();
    expect(pageContent).not.toHaveAttribute('inert');
  });

  it('collapsed mobile weather sheet does not require opening standards from hidden content', async () => {
    const user = userEvent.setup();
    setViewportWidth(390);
    renderWeatherPage();

    await user.click(screen.getByRole('button', { name: '收合天氣資訊' }));

    const weatherSheetContent = screen.getByTestId('weather-sheet-content');
    expect(weatherSheetContent).not.toBeVisible();
    expect(screen.queryByRole('button', { name: '查看紫外線等級說明' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '查看 AQI 等級說明' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /等級/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展開天氣資訊' }));
    expect(weatherSheetContent).toBeVisible();

    await user.click(screen.getByRole('button', { name: '查看紫外線等級說明' }));
    const dialog = screen.getByRole('dialog', { name: '紫外線等級' });
    expect(within(dialog).getByText('8-10')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '關閉紫外線等級說明' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '紫外線等級' })).not.toBeInTheDocument();
    });
    expect(weatherSheetContent).toBeVisible();
    expect(screen.getByRole('button', { name: '收合天氣資訊' })).toHaveAttribute('aria-expanded', 'true');
  });
});
