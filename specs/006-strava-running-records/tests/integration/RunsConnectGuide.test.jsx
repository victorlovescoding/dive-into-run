import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RunsConnectGuide from '@/components/RunsConnectGuide';

const MOCK_CLIENT_ID = 'test-client-id-123';

describe('RunsConnectGuide', () => {
  /** @type {ReturnType<typeof userEvent.setup>} */
  let user;
  let originalLocation;

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_STRAVA_CLIENT_ID', MOCK_CLIENT_ID);
    user = userEvent.setup();

    originalLocation = window.location;
    delete window.location;
    // @ts-expect-error -- test-only: reassigning window.location with mock object
    window.location = { ...originalLocation, origin: 'http://localhost:3000' };
    Object.defineProperty(window.location, 'assign', {
      value: vi.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.unstubAllEnvs();
  });

  it('renders title "連結你的 Strava 帳號"', () => {
    render(<RunsConnectGuide />);

    expect(screen.getByRole('heading', { name: '連結你的 Strava 帳號' })).toBeInTheDocument();
  });

  it('renders subtitle "追蹤你的跑步紀錄"', () => {
    render(<RunsConnectGuide />);

    expect(screen.getByText('追蹤你的跑步紀錄')).toBeInTheDocument();
  });

  it('renders connect button with text "連結 Strava"', () => {
    render(<RunsConnectGuide />);

    expect(screen.getByRole('button', { name: '連結 Strava' })).toBeInTheDocument();
  });

  it('constructs correct OAuth URL and redirects on button click', async () => {
    render(<RunsConnectGuide />);

    const button = screen.getByRole('button', { name: '連結 Strava' });
    await user.click(button);

    const expectedUrl =
      `https://www.strava.com/oauth/authorize` +
      `?client_id=${MOCK_CLIENT_ID}` +
      `&redirect_uri=http://localhost:3000/runs/callback` +
      `&response_type=code` +
      `&scope=activity:read_all`;

    expect(window.location.assign).toHaveBeenCalledWith(expectedUrl);
  });
});
