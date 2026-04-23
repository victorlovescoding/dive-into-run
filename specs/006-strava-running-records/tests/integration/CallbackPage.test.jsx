import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/runtime/hooks/useStravaCallbackRuntime', () => ({
  default: vi.fn(),
}));

import useStravaCallbackRuntime from '@/runtime/hooks/useStravaCallbackRuntime';
import CallbackPage from '@/app/runs/callback/page';

const mockedUseStravaCallbackRuntime = /** @type {import('vitest').Mock} */ (
  useStravaCallbackRuntime
);

/**
 * @typedef {object} CallbackRuntimeMock
 * @property {'loading' | 'error'} status - 畫面狀態。
 * @property {string} errorMessage - 錯誤訊息。
 * @property {string} message - 載入訊息。
 */

/**
 * 建立 callback runtime mock。
 * @param {Partial<CallbackRuntimeMock>} [overrides] - 覆蓋欄位。
 * @returns {CallbackRuntimeMock} runtime mock。
 */
function createRuntime(overrides = {}) {
  return {
    status: 'loading',
    errorMessage: '',
    message: '正在連結 Strava 帳號...',
    ...overrides,
  };
}

describe('CallbackPage', () => {
  beforeEach(() => {
    mockedUseStravaCallbackRuntime.mockReturnValue(createRuntime());
  });

  it('renders loading state from callback runtime', () => {
    render(<CallbackPage />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('正在連結 Strava 帳號...')).toBeInTheDocument();
    expect(mockedUseStravaCallbackRuntime).toHaveBeenCalledTimes(1);
  });

  it('renders auth error state from callback runtime', () => {
    mockedUseStravaCallbackRuntime.mockReturnValue(
      createRuntime({
        status: 'error',
        errorMessage: '連結失敗：請先登入。',
      }),
    );

    render(<CallbackPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('連結失敗：請先登入。');
    expect(screen.getByRole('link', { name: /返回/ })).toHaveAttribute('href', '/runs');
  });

  it('renders missing-code error state from callback runtime', () => {
    mockedUseStravaCallbackRuntime.mockReturnValue(
      createRuntime({
        status: 'error',
        errorMessage: '授權失敗：未取得授權碼。',
      }),
    );

    render(<CallbackPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('授權失敗：未取得授權碼。');
  });

  it('renders server error state from callback runtime', () => {
    mockedUseStravaCallbackRuntime.mockReturnValue(
      createRuntime({
        status: 'error',
        errorMessage: '連結失敗：伺服器回應錯誤，請稍後再試。',
      }),
    );

    render(<CallbackPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('連結失敗：伺服器回應錯誤，請稍後再試。');
  });
});
