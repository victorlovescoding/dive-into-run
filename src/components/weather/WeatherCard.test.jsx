/* eslint-disable jsdoc/require-jsdoc -- Focused UI regression test uses local mock data. */
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const WEATHER_STYLESHEET = readFileSync(`${process.cwd()}/src/components/weather/weather.module.css`, 'utf8');
const FULL_WEATHER = {
  locationName: '臺北市 · 信義區',
  today: {
    currentTemp: 28, weatherDesc: '多雲', weatherCode: '02',
    morningTemp: 24, eveningTemp: 27, rainProb: 30, humidity: 68,
    uv: { value: 8, level: '過量級' },
    aqi: { value: 67, status: '普通' },
  },
  tomorrow: {
    weatherDesc: '短暫雨', weatherCode: '08', morningTemp: 23,
    eveningTemp: 26, rainProb: 40, humidity: 70,
    uv: { value: 5, level: '中量級' },
  },
};
const TOMORROW_UV_NULL_WEATHER = {
  ...FULL_WEATHER,
  tomorrow: { ...FULL_WEATHER.tomorrow, uv: null },
};

function getCssBlock(className) {
  const match = new RegExp(`\\.${className}\\s*{([\\s\\S]*?)\\n}`).exec(WEATHER_STYLESHEET);
  return match?.[1] ?? '';
}

function renderWeatherCard(weather = FULL_WEATHER, props = {}) {
  return render(<WeatherCard {...weather} {...props} />);
}

function getMetricCell(metric) {
  return screen.getByTestId(`weather-metric-${metric}`);
}

function getRowByRange(overlay, rangeLabel) {
  return within(overlay).getByText(rangeLabel).closest('tr');
}

function expectInsideHorizontally(innerElement, outerElement) {
  const innerRect = innerElement.getBoundingClientRect();
  const outerRect = outerElement.getBoundingClientRect();
  expect(Math.floor(innerRect.left)).toBeGreaterThanOrEqual(Math.floor(outerRect.left));
  expect(Math.ceil(innerRect.right)).toBeLessThanOrEqual(Math.ceil(outerRect.right));
}

describe('WeatherCard', () => {
  it('renders enhanced today UV and AQI metrics when values exist', () => {
    renderWeatherCard();
    const currentTemperature = screen.getByTestId('current-temperature');
    const uvMetric = getMetricCell('uv');
    const aqiMetric = getMetricCell('aqi');

    expect(currentTemperature.compareDocumentPosition(uvMetric)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('多雲').compareDocumentPosition(uvMetric)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(uvMetric).getByText('紫外線')).toBeInTheDocument();
    expect(within(uvMetric).getByText('8')).toBeInTheDocument();
    expect(within(uvMetric).getByText('過量級')).toBeInTheDocument();
    expect(within(uvMetric).getByText('改清晨/傍晚，縮短曝曬')).toBeInTheDocument();

    const uvInfoButton = within(uvMetric).getByRole('button', { name: '查看紫外線等級說明' });
    expect(uvInfoButton).toHaveAttribute('aria-expanded', 'false');
    expect(uvInfoButton).toHaveAttribute('aria-controls', expect.stringMatching(/uv$/));

    expect(within(aqiMetric).getByText('AQI')).toBeInTheDocument();
    expect(within(aqiMetric).getByText('67')).toBeInTheDocument();
    expect(within(aqiMetric).getByText('普通')).toBeInTheDocument();
    expect(within(aqiMetric).getByText('可正常跑，敏感者留意體感')).toBeInTheDocument();

    const aqiInfoButton = within(aqiMetric).getByRole('button', { name: '查看 AQI 等級說明' });
    expect(aqiInfoButton).toHaveAttribute('aria-expanded', 'false');
    expect(aqiInfoButton).toHaveAttribute('aria-controls', expect.stringMatching(/aqi$/));
    expect(getCssBlock('metricInfoButton')).toContain('min-width: 44px;');
    expect(getCssBlock('metricInfoButton')).toContain('min-height: 44px;');
    expect(getCssBlock('metricInfoGlyph')).toContain('inline-size: 32px;');
    expect(getCssBlock('metricInfoGlyph')).toContain('block-size: 32px;');
  });

  it('uses per-card standards control ids for multiple weather card instances', () => {
    render(<><WeatherCard {...FULL_WEATHER} /><WeatherCard {...{ ...FULL_WEATHER, locationName: '臺北市 · 大安區' }} /></>);
    const uvInfoButtons = screen.getAllByRole('button', { name: '查看紫外線等級說明' });
    const aqiInfoButtons = screen.getAllByRole('button', { name: '查看 AQI 等級說明' });

    expect(uvInfoButtons[0]).toHaveAttribute('aria-controls');
    expect(uvInfoButtons[1]).toHaveAttribute('aria-controls');
    expect(aqiInfoButtons[0]).toHaveAttribute('aria-controls');
    expect(aqiInfoButtons[1]).toHaveAttribute('aria-controls');
    expect(uvInfoButtons[0].getAttribute('aria-controls')).not.toBe(uvInfoButtons[1].getAttribute('aria-controls'));
    expect(aqiInfoButtons[0].getAttribute('aria-controls')).not.toBe(aqiInfoButtons[1].getAttribute('aria-controls'));
  });

  it('keeps the metrics grid container-aware for narrow weather cards', () => {
    const weatherCardCss = getCssBlock('weatherCard');
    const metricsRowCss = getCssBlock('metricsRow');
    const standardsPopoverCss = getCssBlock('standardsPopover');
    const alignStartCss = getCssBlock('standardsPopoverAlignStart');
    const alignEndCss = getCssBlock('standardsPopoverAlignEnd');

    expect(weatherCardCss).toContain('container-type: inline-size;');
    expect(metricsRowCss).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(standardsPopoverCss).toContain('width: min(320px, calc(100cqw - 3rem));');
    expect(alignStartCss).toContain('left: 0;');
    expect(alignStartCss).toContain('right: auto;');
    expect(alignEndCss).toContain('right: 0;');
    expect(alignEndCss).toContain('left: auto;');
    expect(WEATHER_STYLESHEET).toContain('@container (min-width: 520px)');
  });

  it('hides today UV level advice and info button when UV is null', () => {
    renderWeatherCard({ ...FULL_WEATHER, today: { ...FULL_WEATHER.today, uv: null } });
    const uvMetric = getMetricCell('uv');

    expect(within(uvMetric).getByText('紫外線')).toBeInTheDocument();
    expect(within(uvMetric).getByText('—')).toBeInTheDocument();
    expect(within(uvMetric).queryByText('過量級')).not.toBeInTheDocument();
    expect(within(uvMetric).queryByText('改清晨/傍晚，縮短曝曬')).not.toBeInTheDocument();
    expect(within(uvMetric).queryByRole('button', { name: '查看紫外線等級說明' })).not.toBeInTheDocument();
  });

  it('hides today AQI status advice and info button when AQI is null', () => {
    renderWeatherCard({ ...FULL_WEATHER, today: { ...FULL_WEATHER.today, aqi: null } });
    const aqiMetric = getMetricCell('aqi');

    expect(within(aqiMetric).getByText('AQI')).toBeInTheDocument();
    expect(within(aqiMetric).getByText('—')).toBeInTheDocument();
    expect(within(aqiMetric).queryByText('普通')).not.toBeInTheDocument();
    expect(within(aqiMetric).queryByText('可正常跑，敏感者留意體感')).not.toBeInTheDocument();
    expect(within(aqiMetric).queryByRole('button', { name: '查看 AQI 等級說明' })).not.toBeInTheDocument();
  });

  it('keeps tomorrow summary to UV only without standards entry points', () => {
    const { rerender } = renderWeatherCard();
    const tomorrowSummary = screen.getByText('降雨 40% · 濕度 70% · UV 5 中量級');

    expect(tomorrowSummary).toHaveTextContent('UV 5 中量級');
    expect(tomorrowSummary).not.toHaveTextContent('AQI');
    expect(screen.getAllByRole('button', { name: /等級說明/ })).toHaveLength(2);

    rerender(<WeatherCard {...TOMORROW_UV_NULL_WEATHER} />);
    const nullUvTomorrowSummary = screen.getByText('降雨 40% · 濕度 70% · UV —');
    expect(nullUvTomorrowSummary).toHaveTextContent('UV —');
    expect(nullUvTomorrowSummary).not.toHaveTextContent('AQI');
    expect(screen.getAllByRole('button', { name: /等級說明/ })).toHaveLength(2);
  });

  it('opens a UV desktop popover with official rows source link and current marker', async () => {
    const user = userEvent.setup();
    renderWeatherCard(FULL_WEATHER, { isMobileStandardsSheetMode: false });

    const uvInfoButton = screen.getByRole('button', { name: '查看紫外線等級說明' });
    await user.click(uvInfoButton);

    const overlay = screen.getByRole('region', { name: '紫外線等級' });
    const sourceLink = within(overlay).getByRole('link', { name: '官方來源' });

    expect(uvInfoButton).toHaveAttribute('aria-expanded', 'true');
    expect(uvInfoButton).toHaveAttribute('aria-controls', overlay.id);
    expect(sourceLink).toHaveAttribute('href', 'https://opendata.cwa.gov.tw/opendatadoc/insrtuction/CWA_Data_Standard.pdf');
    expect(within(overlay).getByText('0-2')).toBeInTheDocument();
    expect(within(overlay).getByText('3-5')).toBeInTheDocument();
    expect(within(overlay).getByText('6-7')).toBeInTheDocument();
    expect(within(overlay).getByText('8-10')).toBeInTheDocument();
    expect(within(overlay).getByText('11+')).toBeInTheDocument();
    expect(within(overlay).getAllByText('目前')).toHaveLength(1);
    expect(getRowByRange(overlay, '8-10')).toHaveTextContent('目前');
    expect(overlay).not.toHaveTextContent('改清晨/傍晚');
    expect(overlay).not.toHaveTextContent('跑步適合度');
    expect(overlay).not.toHaveTextContent('訓練強度');
    expect(overlay).not.toHaveTextContent('PM2.5');
  });

  it('keeps desktop popovers inside a narrow side card wrapper', async () => {
    const user = userEvent.setup();
    render(<div data-testid="side-card-wrapper" style={{ width: '380px' }}><WeatherCard {...FULL_WEATHER} isMobileStandardsSheetMode={false} /></div>);
    const wrapper = screen.getByTestId('side-card-wrapper');

    expect(wrapper).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '查看紫外線等級說明' }));
    expectInsideHorizontally(screen.getByRole('region', { name: '紫外線等級' }), wrapper);
    await user.click(screen.getByRole('button', { name: '查看 AQI 等級說明' }));
    expectInsideHorizontally(screen.getByRole('region', { name: 'AQI 等級' }), wrapper);
  });

  it('does not open a desktop popover in mobile standards sheet mode', async () => {
    const user = userEvent.setup();
    renderWeatherCard(FULL_WEATHER, { isMobileStandardsSheetMode: true });

    const uvInfoButton = screen.getByRole('button', { name: '查看紫外線等級說明' });
    await user.click(uvInfoButton);

    expect(screen.queryByRole('region', { name: '紫外線等級' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: '紫外線等級' })).toBeInTheDocument();
    expect(uvInfoButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('renders standards content as a modal bottom sheet in mobile mode', async () => {
    const user = userEvent.setup();
    renderWeatherCard(FULL_WEATHER, { isMobileStandardsSheetMode: true });

    const uvInfoButton = screen.getByRole('button', { name: '查看紫外線等級說明' });
    await user.click(uvInfoButton);

    const dialog = screen.getByRole('dialog', { name: '紫外線等級' });
    const sourceLink = within(dialog).getByRole('link', { name: '官方來源' });

    expect(screen.queryByRole('region', { name: '紫外線等級' })).not.toBeInTheDocument();
    expect(uvInfoButton).toHaveAttribute('aria-expanded', 'true');
    expect(uvInfoButton).toHaveAttribute('aria-controls', dialog.id);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(sourceLink).toHaveAttribute('href', 'https://opendata.cwa.gov.tw/opendatadoc/insrtuction/CWA_Data_Standard.pdf');
    expect(within(dialog).getByText('8-10')).toBeInTheDocument();
    expect(getRowByRange(dialog, '8-10')).toHaveTextContent('目前');
  });

  it('closes mobile standards sheet with scrim Escape and close button', async () => {
    async function expectMobileClose(action) {
      const user = userEvent.setup();
      const onStandardsSheetOpenChange = vi.fn();
      const { unmount } = renderWeatherCard(FULL_WEATHER, { isMobileStandardsSheetMode: true, onStandardsSheetOpenChange });
      const aqiInfoButton = screen.getByRole('button', { name: '查看 AQI 等級說明' });

      await user.click(aqiInfoButton);
      const dialog = screen.getByRole('dialog', { name: 'AQI 等級' });
      expect(dialog).toBeInTheDocument();
      expect(onStandardsSheetOpenChange).toHaveBeenLastCalledWith(true);

      await user.click(dialog);
      expect(screen.getByRole('dialog', { name: 'AQI 等級' })).toBeInTheDocument();

      await action({ user });

      expect(screen.queryByRole('dialog', { name: 'AQI 等級' })).not.toBeInTheDocument();
      expect(aqiInfoButton).toHaveAttribute('aria-expanded', 'false');
      await waitFor(() => expect(aqiInfoButton).toHaveFocus());
      expect(onStandardsSheetOpenChange).toHaveBeenLastCalledWith(false);
      unmount();
    }

    await expectMobileClose(({ user }) => user.click(screen.getByTestId('standards-sheet-scrim')));
    await expectMobileClose(({ user }) => user.keyboard('{Escape}'));
    await expectMobileClose(({ user }) => user.click(screen.getByRole('button', { name: '關閉 AQI 等級說明' })));
  });

  it('clears desktop popover state when switching standards sheet modes', async () => {
    const user = userEvent.setup();
    const { rerender } = renderWeatherCard(FULL_WEATHER, { isMobileStandardsSheetMode: false });

    await user.click(screen.getByRole('button', { name: '查看紫外線等級說明' }));
    expect(screen.getByRole('region', { name: '紫外線等級' })).toBeInTheDocument();

    rerender(<WeatherCard {...FULL_WEATHER} isMobileStandardsSheetMode />);
    expect(screen.queryByRole('region', { name: '紫外線等級' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: '紫外線等級' })).not.toBeInTheDocument();

    rerender(<WeatherCard {...FULL_WEATHER} isMobileStandardsSheetMode={false} />);
    expect(screen.queryByRole('region', { name: '紫外線等級' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '查看紫外線等級說明' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('switches from UV to AQI desktop popover and keeps only one overlay open', async () => {
    const user = userEvent.setup();
    renderWeatherCard(FULL_WEATHER, { isMobileStandardsSheetMode: false });

    await user.click(screen.getByRole('button', { name: '查看紫外線等級說明' }));
    await user.click(screen.getByRole('button', { name: '查看 AQI 等級說明' }));
    const overlay = screen.getByRole('region', { name: 'AQI 等級' });

    expect(screen.queryByRole('region', { name: '紫外線等級' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: /等級/ })).toHaveLength(1);
    ['0-50', '51-100', '101-150', '151-200', '201-300', '301-400', '401-500'].forEach((range) => {
      expect(within(overlay).getByText(range)).toBeInTheDocument();
    });
  });

  it('highlights only the matching split AQI hazard row', async () => {
    const user = userEvent.setup();
    renderWeatherCard({
      ...FULL_WEATHER,
      today: { ...FULL_WEATHER.today, aqi: { value: 450, status: '危害' } },
    }, { isMobileStandardsSheetMode: false });

    await user.click(screen.getByRole('button', { name: '查看 AQI 等級說明' }));
    const overlay = screen.getByRole('region', { name: 'AQI 等級' });
    const lowerHazardRow = getRowByRange(overlay, '301-400');
    const upperHazardRow = getRowByRange(overlay, '401-500');

    expect(lowerHazardRow).toHaveTextContent('危害');
    expect(upperHazardRow).toHaveTextContent('危害');
    expect(within(overlay).getAllByText('目前')).toHaveLength(1);
    expect(lowerHazardRow).not.toHaveTextContent('目前');
    expect(upperHazardRow).toHaveTextContent('目前');
  });

  it('closes the desktop popover with same button outside click Escape and close button', async () => {
    async function expectUvClose(action) {
      const user = userEvent.setup();
      const { unmount } = renderWeatherCard(FULL_WEATHER, { isMobileStandardsSheetMode: false });
      const uvInfoButton = screen.getByRole('button', { name: '查看紫外線等級說明' });

      await user.click(uvInfoButton);
      expect(screen.getByRole('region', { name: '紫外線等級' })).toBeInTheDocument();
      await action({ user, uvInfoButton });
      expect(screen.queryByRole('region', { name: '紫外線等級' })).not.toBeInTheDocument();
      expect(uvInfoButton).toHaveAttribute('aria-expanded', 'false');
      unmount();
    }

    await expectUvClose(({ user, uvInfoButton }) => user.click(uvInfoButton));
    await expectUvClose(({ user }) => user.click(document.body));
    await expectUvClose(({ user }) => user.keyboard('{Escape}'));
    await expectUvClose(({ user }) => user.click(screen.getByRole('button', { name: '關閉紫外線等級說明' })));
  });

  it('returns focus to the triggering info button after desktop popover close', async () => {
    const user = userEvent.setup();
    renderWeatherCard(FULL_WEATHER, { isMobileStandardsSheetMode: false });

    const aqiInfoButton = screen.getByRole('button', { name: '查看 AQI 等級說明' });
    await user.click(aqiInfoButton);
    await user.click(screen.getByRole('button', { name: '關閉 AQI 等級說明' }));

    await waitFor(() => {
      expect(aqiInfoButton).toHaveFocus();
    });
  });

  it('does not focus a disconnected trigger after close cleanup', async () => {
    const user = userEvent.setup();
    const focusConnectionStates = [];
    const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function focus() {
      focusConnectionStates.push(this.isConnected);
    });

    try {
      const { unmount } = renderWeatherCard(FULL_WEATHER, { isMobileStandardsSheetMode: false });

      await user.click(screen.getByRole('button', { name: '查看 AQI 等級說明' }));
      // eslint-disable-next-line testing-library/prefer-user-event -- Close must be synchronous before unmount to cover detached focus cleanup.
      fireEvent.click(screen.getByRole('button', { name: '關閉 AQI 等級說明' }));
      unmount();
      await new Promise((resolve) => { window.setTimeout(resolve, 10); });

      expect(focusConnectionStates).not.toContain(false);
    } finally {
      focusSpy.mockRestore();
    }
  });
});
