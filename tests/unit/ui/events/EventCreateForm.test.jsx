// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import EventCreateForm from '@/ui/events/EventCreateForm';

const DEADLINE_ERROR = '報名截止時間必須在活動開始時間之前';
const EVENTS_PAGE_CSS_PATH = path.join(process.cwd(), 'src/ui/events/EventsPageScreen.module.css');

vi.mock('next/dynamic', () => ({
  default: () => function MockDynamicComponent() {
    return <div data-testid="event-map" />;
  },
}));

/**
 * Creates the minimum props needed to render the create event form.
 * @param {Record<string, unknown>} overrides - Props to override.
 * @returns {Record<string, unknown> & {
 *   onSubmit: import('vitest').Mock,
 *   onTimeChange: import('vitest').Mock,
 *   onRegistrationDeadlineChange: import('vitest').Mock
 * }} Complete form props.
 */
function createProps(overrides = {}) {
  return {
    hostName: 'Runner One',
    draftFormData: null,
    minDateTime: '2026-06-01T00:00',
    selectedCity: '台北市',
    selectedDistrict: '大安區',
    cityOptions: ['台北市'],
    selectedDistrictOptions: ['大安區'],
    showMap: false,
    routeCoordinates: null,
    routePointCount: 0,
    isCreating: false,
    eventTimeValue: '2026-07-01T10:00',
    registrationDeadlineValue: '2026-07-01T10:00',
    registrationDeadlineError: DEADLINE_ERROR,
    onSubmit: vi.fn((event) => event.preventDefault()),
    onClose: vi.fn(),
    onCityChange: vi.fn(),
    onDistrictChange: vi.fn(),
    onEnableRoute: vi.fn(),
    onDisableRoute: vi.fn(),
    onRouteDrawn: vi.fn(),
    onTimeChange: vi.fn(),
    onRegistrationDeadlineChange: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders EventCreateForm with default props.
 * @param {Record<string, unknown>} overrides - Props to override.
 * @returns {ReturnType<typeof createProps>} Rendered props.
 */
function renderCreateForm(overrides = {}) {
  const props = createProps(overrides);

  render(<EventCreateForm {...props} />);

  return props;
}

/**
 * Extracts the raw body for a matching media query block.
 * @param {string} source - CSS source text to inspect.
 * @param {string} mediaQuery - Media query condition including parentheses.
 * @returns {string} Inner text of the matched media block.
 */
function getMediaBlock(source, mediaQuery) {
  const atRule = `@media ${mediaQuery}`;
  const start = source.indexOf(atRule);

  if (start === -1) return '';

  const openBrace = source.indexOf('{', start);

  if (openBrace === -1) return '';

  let depth = 1;

  for (let index = openBrace + 1; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
    }

    if (depth === 0) {
      return source.slice(openBrace + 1, index);
    }
  }

  return '';
}

/**
 * Reads declarations for a selector from a flat block of CSS text.
 * @param {string} source - CSS text that contains the selector rule.
 * @param {string} selector - Class selector to inspect.
 * @returns {Record<string, string>} Declaration map keyed by property name.
 */
function getDeclarations(source, selector) {
  const selectorPattern = selector.replace('.', String.raw`\.`);
  const match = new RegExp(`${selectorPattern}\\s*\\{(?<body>[^}]*)\\}`).exec(source);
  const body = match?.groups?.body ?? '';

  return Object.fromEntries(
    body
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const [property, ...valueParts] = declaration.split(':');
        return [property.trim(), valueParts.join(':').trim()];
      }),
  );
}

describe('EventCreateForm deadline validation', () => {
  it('renders the deadline inline error with accessible invalid state', () => {
    renderCreateForm();

    const deadlineInput = screen.getByLabelText('報名截止時間');
    const error = screen.getByRole('alert');

    expect(error).toHaveTextContent(DEADLINE_ERROR);
    expect(deadlineInput).toHaveAttribute('aria-invalid', 'true');
    expect(deadlineInput).toHaveAccessibleDescription(DEADLINE_ERROR);
    expect(screen.getByRole('button', { name: '建立活動' })).toBeDisabled();
  });

  it('guards form submission while the deadline error is present', () => {
    const view = renderCreateForm();

    fireEvent.submit(screen.getByRole('form', { name: '揪團表單' }));

    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it('clears the inline error through controlled value updates and allows valid submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event) => event.preventDefault());

    /**
     * Controlled harness mirrors EventsPageScreen wiring for deadline state.
     * @returns {import('react').ReactElement} Test harness.
     */
    function Harness() {
      const [eventTimeValue, setEventTimeValue] = useState('2026-07-01T10:00');
      const [registrationDeadlineValue, setRegistrationDeadlineValue] =
        useState('2026-07-01T10:00');
      const registrationDeadlineError =
        new Date(registrationDeadlineValue) >= new Date(eventTimeValue) ? DEADLINE_ERROR : '';

      return (
        <EventCreateForm
          {...createProps({
            eventTimeValue,
            registrationDeadlineValue,
            registrationDeadlineError,
            onSubmit,
            onTimeChange: setEventTimeValue,
            onRegistrationDeadlineChange: setRegistrationDeadlineValue,
          })}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByRole('alert')).toHaveTextContent(DEADLINE_ERROR);

    await user.type(screen.getByLabelText('報名截止時間'), '2026-07-01T09:59');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.submit(screen.getByRole('form', { name: '揪團表單' }));

    expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'submit' }));
  });

  it('does not mark blank or invalid deadline values with custom inline validation', () => {
    renderCreateForm({
      eventTimeValue: '',
      registrationDeadlineValue: '',
      registrationDeadlineError: '',
    });

    const deadlineInput = screen.getByLabelText('報名截止時間');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(deadlineInput).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('button', { name: '建立活動' })).not.toBeDisabled();
  });
});

describe('EventCreateForm mobile actions CSS', () => {
  it('keeps create modal actions sticky only on mobile with solid backing and safe-area padding', () => {
    const source = readFileSync(EVENTS_PAGE_CSS_PATH, 'utf8');
    const desktopRules = getDeclarations(source, '.formActions');
    const mobileBlock = getMediaBlock(source, '(max-width: 720px)');
    const mobileRules = getDeclarations(mobileBlock, '.formActions');

    expect(desktopRules.position).not.toBe('sticky');
    expect(mobileRules).toMatchObject({
      position: 'sticky',
      bottom: '0',
      'z-index': '2',
    });
    expect(mobileRules.background).toMatch(/^(#fff|white)$/);
    expect(mobileRules['border-top']).toContain('1px solid');
    expect(mobileRules['padding-bottom']).toContain('env(safe-area-inset-bottom)');
  });
});
