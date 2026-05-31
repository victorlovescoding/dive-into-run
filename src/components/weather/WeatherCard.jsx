import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { getWeatherIconUrl } from '@/runtime/client/use-cases/weather-location-use-cases';
import styles from './weather.module.css';
import { AQI_STANDARD_ROWS, AQI_STANDARD_SOURCE_URL, UV_STANDARD_ROWS, UV_STANDARD_SOURCE_URL, getCurrentStandardRow, getWeatherMetricAdvice } from './weather-standards';

/** @typedef {import('@/types/weather-types').TodayWeather} TodayWeather */
/** @typedef {import('@/types/weather-types').TomorrowWeather} TomorrowWeather */

const STANDARD_POPOVER_CONFIG = {
  uv: { title: '紫外線等級', closeLabel: '關閉紫外線等級說明', sourceUrl: UV_STANDARD_SOURCE_URL, rows: UV_STANDARD_ROWS },
  aqi: { title: 'AQI 等級', closeLabel: '關閉 AQI 等級說明', sourceUrl: AQI_STANDARD_SOURCE_URL, rows: AQI_STANDARD_ROWS },
};
const FOCUSABLE_DIALOG_SELECTOR = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// #region Helpers

/**
 * 格式化指標數值，null 時顯示 "—"。
 * @param {number | null | undefined} value - 數值。
 * @param {string} [suffix] - 後綴，e.g. "%"。
 * @returns {string} 格式化後的字串。
 */
function formatMetric(value, suffix = '') {
  if (value == null) return '\u2014';
  return `${value}${suffix}`;
}

/**
 * 判斷當前是否為白天（06:00-18:00）。
 * @returns {'day' | 'night'} 日夜時段。
 */
function getCurrentPeriod() {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? 'day' : 'night';
}

/**
 * Returns focus only while the original trigger is still mounted.
 * @param {HTMLButtonElement | null} button - Trigger button to refocus.
 * @param {HTMLElement | null} fallback - Stable fallback when the trigger unmounts.
 * @returns {number} Timer id for cleanup.
 */
function scheduleFocusReturn(button, fallback) {
  return window.setTimeout(() => { const focusTarget = button?.isConnected ? button : fallback?.isConnected ? fallback : null; focusTarget?.focus(); }, 0);
}

/**
 * @param {HTMLElement} dialog - Active modal dialog.
 * @returns {HTMLElement[]} Tabbable controls inside the dialog.
 */
function getDialogFocusableElements(dialog) {
  return /** @type {HTMLElement[]} */ (Array.from(dialog.querySelectorAll(FOCUSABLE_DIALOG_SELECTOR)).filter((element) => element instanceof HTMLElement && element.tabIndex >= 0));
}

/**
 * @param {HTMLElement} dialog - Active modal dialog.
 * @param {HTMLElement | null} preferredTarget - Preferred initial focus target.
 * @returns {void}
 */
function focusDialogTarget(dialog, preferredTarget) {
  (preferredTarget?.isConnected ? preferredTarget : getDialogFocusableElements(dialog)[0] ?? dialog).focus();
}

/**
 * @param {KeyboardEvent} event - Keyboard event from the document.
 * @param {HTMLElement} dialog - Active modal dialog.
 * @returns {void}
 */
function trapDialogFocus(event, dialog) {
  if (event.key !== 'Tab') return;

  const focusableElements = getDialogFocusableElements(dialog);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const { activeElement } = document;

  if (focusableElements.length === 0 || !dialog.contains(activeElement)) {
    event.preventDefault();
    (event.shiftKey ? lastElement : firstElement)?.focus();
    if (focusableElements.length === 0) dialog.focus();
    return;
  }

  const nextElement = event.shiftKey && activeElement === firstElement ? lastElement : !event.shiftKey && activeElement === lastElement ? firstElement : null;
  if (!nextElement) return;
  event.preventDefault(); nextElement.focus();
}
// #endregion

// #region Sub-components

/**
 * Simple today metric cell.
 * @param {object} props - 元件屬性。
 * @param {string} props.id - Stable test id suffix.
 * @param {string} props.value - Display value.
 * @param {string} props.label - Display label.
 * @returns {import('react').JSX.Element} Metric cell.
 */
function MetricCell({ id, value, label }) {
  return (
    <div className={styles.metricItem} data-testid={`weather-metric-${id}`}>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricLabel}>{label}</div>
    </div>
  );
}

/**
 * Standards content shared by desktop popover and mobile sheet.
 * @param {object} props - 元件屬性。
 * @param {'uv' | 'aqi'} props.metric - Standards metric key.
 * @param {number} props.value - Current metric value for row highlighting.
 * @param {string} props.titleId - Standards title id.
 * @param {import('react').RefObject<HTMLButtonElement | null>} [props.closeButtonRef] - Close button ref.
 * @param {() => void} props.onClose - Close handler.
 * @returns {import('react').JSX.Element} Standards content.
 */
function WeatherStandardsContent({ metric, value, titleId, closeButtonRef, onClose }) {
  const config = STANDARD_POPOVER_CONFIG[metric];
  const currentRow = getCurrentStandardRow(metric, value);

  return (
    <>
      <div className={styles.standardsPopoverHeader}>
        <h3 id={titleId} className={styles.standardsPopoverTitle}>{config.title}</h3>
        <button ref={closeButtonRef} type="button" className={styles.standardsCloseButton} aria-label={config.closeLabel} onClick={onClose}>
          關閉
        </button>
      </div>
      <p className={styles.standardsSourceNote}>
        官方級距：
        <a href={config.sourceUrl} target="_blank" rel="noreferrer">官方來源</a>
      </p>
      <table className={styles.standardsTable}>
        <thead>
          <tr><th scope="col">數值</th><th scope="col">等級</th><th scope="col">狀態</th></tr>
        </thead>
        <tbody>
          {config.rows.map((row) => (
            <tr key={row.id} className={row.id === currentRow?.id ? styles.standardsCurrentRow : undefined}>
              <td>{row.rangeLabel}</td>
              <td>{row.label}</td>
              <td>{row.id === currentRow?.id ? <span className={styles.currentRowMarker}>目前</span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

/**
 * Desktop standards popover containing the official rows for one metric.
 * @param {object} props - 元件屬性。
 * @param {'uv' | 'aqi'} props.metric - Standards metric key.
 * @param {number} props.value - Current metric value for row highlighting.
 * @param {string} props.controlId - Overlay id controlled by the info button.
 * @param {import('react').RefObject<HTMLDivElement | null>} props.overlayRef - Active overlay ref.
 * @param {() => void} props.onClose - Close handler.
 * @returns {import('react').JSX.Element} Standards popover.
 */
function WeatherStandardsPopover({ metric, value, controlId, overlayRef, onClose }) {
  const titleId = `${controlId}-title`;
  const alignClassName = metric === 'uv' ? styles.standardsPopoverAlignStart : styles.standardsPopoverAlignEnd;
  const popoverClassName = `${styles.standardsPopover} ${alignClassName}`;

  return (
    <div id={controlId} ref={overlayRef} role="region" aria-labelledby={titleId} className={popoverClassName}>
      <WeatherStandardsContent metric={metric} value={value} titleId={titleId} onClose={onClose} />
    </div>
  );
}

/**
 * Mobile modal standards bottom sheet rendered outside the weather sheet layer.
 * @param {object} props - 元件屬性。
 * @param {'uv' | 'aqi'} props.metric - Standards metric key.
 * @param {number} props.value - Current metric value for row highlighting.
 * @param {string} props.controlId - Overlay id controlled by the info button.
 * @param {import('react').RefObject<HTMLDivElement | null>} props.overlayRef - Active overlay ref.
 * @param {import('react').RefObject<HTMLButtonElement | null>} props.closeButtonRef - Close button ref.
 * @param {() => void} props.onClose - Close handler.
 * @returns {import('react').ReactPortal | null} Standards sheet portal.
 */
function WeatherStandardsSheet({ metric, value, controlId, overlayRef, closeButtonRef, onClose }) {
  if (typeof document === 'undefined') return null;

  const titleId = `${controlId}-title`;

  return createPortal(
    <div className={styles.standardsSheetLayer}>
      <button type="button" tabIndex={-1} className={styles.standardsSheetScrim} data-testid="standards-sheet-scrim" aria-label="關閉等級說明遮罩" onClick={onClose} />
      <div id={controlId} ref={overlayRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={styles.standardsSheet}>
        <WeatherStandardsContent metric={metric} value={value} titleId={titleId} closeButtonRef={closeButtonRef} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}

/**
 * Enhanced UV/AQI metric cell with closed standards entry point.
 * @param {object} props - 元件屬性。
 * @param {'uv' | 'aqi'} props.metric - Standards metric key.
 * @param {string} props.label - Display label.
 * @param {number} props.value - Display value.
 * @param {string} props.levelOrStatus - Official level/status from weather data.
 * @param {string} props.infoButtonLabel - Accessible info button label.
 * @param {string} props.controlId - Stable per-card controlled overlay id.
 * @param {boolean} props.isOpen - Whether this metric's popover is open.
 * @param {import('react').RefObject<HTMLButtonElement | null>} props.buttonRef - Trigger ref.
 * @param {import('react').RefObject<HTMLDivElement | null>} props.overlayRef - Active overlay ref.
 * @param {() => void} props.onToggle - Toggle handler.
 * @param {() => void} props.onClose - Close handler.
 * @param {boolean} props.shouldRenderDesktopPopover - Whether the open state should render a desktop popover.
 * @returns {import('react').JSX.Element} Enhanced metric cell.
 */
function WeatherStandardMetric({ metric, label, value, levelOrStatus, infoButtonLabel, controlId, isOpen, buttonRef, overlayRef, onToggle, onClose, shouldRenderDesktopPopover }) {
  const advice = getWeatherMetricAdvice(metric, levelOrStatus);

  return (
    <div className={styles.enhancedMetricItem} data-testid={`weather-metric-${metric}`}>
      <div className={styles.enhancedMetricHeader}>
        <div>
          <div className={styles.metricValue}>{formatMetric(value)}</div>
          <div className={styles.metricLabel}>{label}</div>
        </div>
        <button ref={buttonRef} type="button" className={styles.metricInfoButton} aria-label={infoButtonLabel} aria-controls={controlId} aria-expanded={isOpen} onClick={onToggle}>
          <span aria-hidden="true" className={styles.metricInfoGlyph}>i</span>
        </button>
      </div>
      <div className={styles.metricStandardText}>{levelOrStatus}</div>
      {advice ? <div className={styles.metricAdvice}>{advice}</div> : null}
      {isOpen && shouldRenderDesktopPopover ? (
        <WeatherStandardsPopover metric={metric} value={value} controlId={controlId} overlayRef={overlayRef} onClose={onClose} />
      ) : null}
    </div>
  );
}

/**
 * 今日四項天氣指標（降雨/濕度/UV/AQI）。
 * @param {object} props - 元件屬性。
 * @param {TodayWeather} props.today - 今日天氣資料。
 * @param {{ uv: string, aqi: string }} props.standardControlIds - Per-card overlay ids.
 * @param {'uv' | 'aqi' | null} props.activeStandardMetric - Open metric key.
 * @param {import('react').RefObject<HTMLButtonElement | null>} props.uvButtonRef - UV trigger ref.
 * @param {import('react').RefObject<HTMLButtonElement | null>} props.aqiButtonRef - AQI trigger ref.
 * @param {import('react').RefObject<HTMLDivElement | null>} props.standardOverlayRef - Active overlay ref.
 * @param {(metric: 'uv' | 'aqi') => void} props.onStandardToggle - Toggle handler.
 * @param {() => void} props.onStandardClose - Close handler.
 * @param {boolean} props.shouldRenderDesktopPopover - Whether open metrics should render desktop popovers.
 * @returns {import('react').JSX.Element} 指標列。
 */
function TodayMetrics({ today, standardControlIds, activeStandardMetric, uvButtonRef, aqiButtonRef, standardOverlayRef, onStandardToggle, onStandardClose, shouldRenderDesktopPopover }) {
  const { rainProb, humidity, uv, aqi } = today;
  return (
    <div className={styles.metricsRow}>
      <MetricCell id="rain" value={formatMetric(rainProb, '%')} label="降雨" />
      <MetricCell id="humidity" value={formatMetric(humidity, '%')} label="濕度" />
      {uv ? (
        <WeatherStandardMetric metric="uv" label="紫外線" value={uv.value} levelOrStatus={uv.level} infoButtonLabel="查看紫外線等級說明" controlId={standardControlIds.uv} isOpen={activeStandardMetric === 'uv'} buttonRef={uvButtonRef} overlayRef={standardOverlayRef} onToggle={() => onStandardToggle('uv')} onClose={onStandardClose} shouldRenderDesktopPopover={shouldRenderDesktopPopover} />
      ) : (
        <MetricCell id="uv" value={'\u2014'} label="紫外線" />
      )}
      {aqi ? (
        <WeatherStandardMetric metric="aqi" label="AQI" value={aqi.value} levelOrStatus={aqi.status} infoButtonLabel="查看 AQI 等級說明" controlId={standardControlIds.aqi} isOpen={activeStandardMetric === 'aqi'} buttonRef={aqiButtonRef} overlayRef={standardOverlayRef} onToggle={() => onStandardToggle('aqi')} onClose={onStandardClose} shouldRenderDesktopPopover={shouldRenderDesktopPopover} />
      ) : (
        <MetricCell id="aqi" value={'\u2014'} label="AQI" />
      )}
    </div>
  );
}

/**
 * 明日天氣摘要區塊。
 * @param {object} props - 元件屬性。
 * @param {TomorrowWeather} props.tomorrow - 明日天氣資料。
 * @returns {import('react').JSX.Element} 明日區塊。
 */
function TomorrowSection({ tomorrow }) {
  const period = getCurrentPeriod();
  const iconUrl = getWeatherIconUrl(tomorrow.weatherCode, period);
  const { morningTemp, eveningTemp, rainProb, humidity, uv } = tomorrow;
  const uvText = uv ? `${uv.value} ${uv.level}` : '\u2014';

  return (
    <div className={styles.tomorrowSection}>
      <div className={styles.tomorrowTitle}>明日</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Image className={styles.weatherIcon} src={iconUrl} alt={tomorrow.weatherDesc} width={32} height={32} style={{ width: 32, height: 32 }} unoptimized />
        <span>{tomorrow.weatherDesc}</span>
        <span className={styles.tempItem}><span aria-hidden="true">{'\u2600\uFE0F'}</span><span className="sr-only">早上</span> {morningTemp}°</span>
        <span className={styles.tempItem}><span aria-hidden="true">{'\uD83C\uDF19'}</span><span className="sr-only">晚上</span> {eveningTemp}°</span>
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', opacity: 0.8 }}>降雨 {formatMetric(rainProb, '%')} · 濕度 {formatMetric(humidity, '%')} · UV {uvText}</div>
    </div>
  );
}
// #endregion

/**
 * Weather card implementation.
 * @param {object} props - 元件屬性。
 * @param {string} props.locationName - 地點全名。
 * @param {TodayWeather} props.today - 今日天氣。
 * @param {TomorrowWeather} props.tomorrow - 明日天氣。
 * @param {boolean} [props.isMobileStandardsSheetMode] - Whether desktop popovers should stay closed for the mobile sheet lane.
 * @param {(isOpen: boolean) => void} [props.onStandardsSheetOpenChange] - Mobile standards sheet open-state callback.
 * @returns {import('react').JSX.Element} 天氣卡元件。
 */
function WeatherCardContent({ locationName, today, tomorrow, isMobileStandardsSheetMode = false, onStandardsSheetOpenChange }) {
  const standardControlIdBase = useId();
  const [activeStandardOverlay, setActiveStandardOverlay] = useState(
    /** @type {{ metric: 'uv' | 'aqi' | null, mode: 'desktop' | 'mobile' | null, modeToken: object | null }} */ ({ metric: null, mode: null, modeToken: null }),
  );
  const weatherCardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const uvButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const aqiButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const standardOverlayRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const mobileCloseButtonRef = useRef(/** @type {HTMLButtonElement | null} */ (null));
  const focusReturnTimeoutRef = useRef(/** @type {number | null} */ (null));
  const previousStandardsModeRef = useRef(isMobileStandardsSheetMode ? 'mobile' : 'desktop');
  const period = getCurrentPeriod();
  const iconUrl = getWeatherIconUrl(today.weatherCode, period);
  const standardControlIds = { uv: `${standardControlIdBase}-weather-standard-popover-uv`, aqi: `${standardControlIdBase}-weather-standard-popover-aqi` };
  const standardsMode = isMobileStandardsSheetMode ? 'mobile' : 'desktop';
  const standardsModeToken = useMemo(() => ({ mode: standardsMode }), [standardsMode]);
  const activeStandardMetric = activeStandardOverlay.modeToken === standardsModeToken ? activeStandardOverlay.metric : null;
  const activeDesktopStandardMetric = standardsMode === 'desktop' ? activeStandardMetric : null;
  const activeMobileStandardMetric = standardsMode === 'mobile' ? activeStandardMetric : null;
  const activeMobileStandardSheet = /** @type {{ metric: 'uv' | 'aqi', value: number, controlId: string } | null} */ (activeMobileStandardMetric === 'uv' && today.uv
    ? { metric: 'uv', value: today.uv.value, controlId: standardControlIds.uv }
    : activeMobileStandardMetric === 'aqi' && today.aqi
      ? { metric: 'aqi', value: today.aqi.value, controlId: standardControlIds.aqi }
      : null);
  const clearFocusReturnTimeout = useCallback(() => {
    if (focusReturnTimeoutRef.current == null) return;
    window.clearTimeout(focusReturnTimeoutRef.current); focusReturnTimeoutRef.current = null;
  }, []);
  /** @param {HTMLButtonElement | null} button - Trigger button to refocus. */
  const queueFocusReturn = useCallback((button) => {
    clearFocusReturnTimeout();
    focusReturnTimeoutRef.current = scheduleFocusReturn(button, weatherCardRef.current);
  }, [clearFocusReturnTimeout]);
  const closeStandardsOverlay = useCallback(() => {
    const triggerButton = activeStandardMetric === 'uv'
      ? uvButtonRef.current
        : activeStandardMetric === 'aqi'
          ? aqiButtonRef.current
          : null;
    setActiveStandardOverlay({ metric: null, mode: null, modeToken: null });
    if (activeMobileStandardMetric) onStandardsSheetOpenChange?.(false);
    queueFocusReturn(triggerButton);
  }, [activeMobileStandardMetric, activeStandardMetric, onStandardsSheetOpenChange, queueFocusReturn]);
  /** @param {'uv' | 'aqi'} metric - Standards metric to open or close. */
  const toggleStandardsOverlay = (metric) => {
    if (activeStandardMetric === metric) { closeStandardsOverlay(); return; }

    setActiveStandardOverlay({ metric, mode: standardsMode, modeToken: standardsModeToken });
  };

  useEffect(() => () => clearFocusReturnTimeout(), [clearFocusReturnTimeout]);

  useEffect(() => {
    const previousStandardsMode = previousStandardsModeRef.current;
    if (previousStandardsMode === standardsMode) return undefined;

    previousStandardsModeRef.current = standardsMode;
    const staleMetric = activeStandardOverlay.mode === previousStandardsMode ? activeStandardOverlay.metric : null;
    if (!staleMetric) return undefined;

    const triggerButton = staleMetric === 'uv' ? uvButtonRef.current : aqiButtonRef.current;
    const closeTimerId = window.setTimeout(() => {
      setActiveStandardOverlay((currentOverlay) => (
        currentOverlay.mode === previousStandardsMode ? { metric: null, mode: null, modeToken: null } : currentOverlay
      ));
      queueFocusReturn(triggerButton);
    }, 0);

    return () => window.clearTimeout(closeTimerId);
  }, [activeStandardOverlay.metric, activeStandardOverlay.mode, queueFocusReturn, standardsMode]);

  useEffect(() => {
    const isOpen = Boolean(activeMobileStandardMetric);
    onStandardsSheetOpenChange?.(isOpen);

    return () => {
      if (isOpen) onStandardsSheetOpenChange?.(false);
    };
  }, [activeMobileStandardMetric, onStandardsSheetOpenChange]);

  useEffect(() => {
    if (!activeDesktopStandardMetric) return undefined;

    const triggerButton = activeDesktopStandardMetric === 'uv' ? uvButtonRef.current : aqiButtonRef.current;
    const closeFromDocument = () => {
      setActiveStandardOverlay({ metric: null, mode: null, modeToken: null });
      queueFocusReturn(triggerButton);
    };
    /** @param {PointerEvent} event - Pointer event from the document. */
    const handlePointerDown = (event) => {
      const { target } = event;
      if (!(target instanceof Node)) return;
      if (standardOverlayRef.current?.contains(target)) return;
      if (uvButtonRef.current?.contains(target) || aqiButtonRef.current?.contains(target)) return;
      closeFromDocument();
    };
    /** @param {KeyboardEvent} event - Keyboard event from the document. */
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeFromDocument();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown); document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDesktopStandardMetric, queueFocusReturn]);

  useEffect(() => {
    if (!activeMobileStandardMetric) return undefined;

    const focusTimerId = window.setTimeout(() => {
      if (standardOverlayRef.current?.isConnected) focusDialogTarget(standardOverlayRef.current, mobileCloseButtonRef.current);
    }, 0);
    /** @param {KeyboardEvent} event - Keyboard event from the document. */
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') { closeStandardsOverlay(); return; }
      if (standardOverlayRef.current) trapDialogFocus(event, standardOverlayRef.current);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimerId);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMobileStandardMetric, closeStandardsOverlay]);

  return (
    <div ref={weatherCardRef} className={styles.weatherCard} style={{ position: 'relative' }} tabIndex={-1}>
      <div className={styles.locationName}>{locationName}</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
        <Image className={styles.weatherIcon} src={iconUrl} alt={today.weatherDesc} width={64} height={64} unoptimized />
        <div className={styles.temperature} data-testid="current-temperature">{today.currentTemp}°</div>
      </div>

      <div className={styles.weatherDesc}>{today.weatherDesc}</div>

      <div className={styles.tempRange}>
        <span className={styles.tempItem}><span aria-hidden="true">{'\u2600\uFE0F'}</span><span className="sr-only">早上</span> {today.morningTemp}°</span>
        <span className={styles.tempItem}><span aria-hidden="true">{'\uD83C\uDF19'}</span><span className="sr-only">晚上</span> {today.eveningTemp}°</span>
      </div>

      <TodayMetrics today={today} standardControlIds={standardControlIds} activeStandardMetric={activeStandardMetric} uvButtonRef={uvButtonRef} aqiButtonRef={aqiButtonRef} standardOverlayRef={standardOverlayRef} onStandardToggle={toggleStandardsOverlay} onStandardClose={closeStandardsOverlay} shouldRenderDesktopPopover={Boolean(activeDesktopStandardMetric)} />
      <TomorrowSection tomorrow={tomorrow} />
      {activeMobileStandardSheet ? (
        <WeatherStandardsSheet metric={activeMobileStandardSheet.metric} value={activeMobileStandardSheet.value} controlId={activeMobileStandardSheet.controlId} overlayRef={standardOverlayRef} closeButtonRef={mobileCloseButtonRef} onClose={closeStandardsOverlay} />
      ) : null}
    </div>
  );
}

/**
 * 天氣資訊卡 — 顯示今日完整天氣 + 明日摘要。
 * @param {object} props - 元件屬性。
 * @param {string} props.locationName - 地點全名。
 * @param {TodayWeather} props.today - 今日天氣。
 * @param {TomorrowWeather} props.tomorrow - 明日天氣。
 * @param {boolean} [props.isMobileStandardsSheetMode] - Whether standards open as a mobile sheet.
 * @param {(isOpen: boolean) => void} [props.onStandardsSheetOpenChange] - Mobile standards sheet open-state callback.
 * @returns {import('react').JSX.Element} 天氣卡元件。
 */
export default function WeatherCard(props) {
  const { isMobileStandardsSheetMode = false } = props;
  return <WeatherCardContent {...props} isMobileStandardsSheetMode={isMobileStandardsSheetMode} />;
}
