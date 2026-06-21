// @vitest-environment jsdom

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Toast from '../../../src/components/Toast';

const baseToast = {
  id: 'toast-1',
  message: '通知訊息',
  type: 'success',
  createdAt: 1700000000000,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Toast auto-dismiss behavior', () => {
  it('keeps error toast visible until the user closes it', async () => {
    const onClose = vi.fn();
    render(<Toast toast={{ ...baseToast, type: 'error' }} onClose={onClose} />);

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(onClose).not.toHaveBeenCalled();

    // eslint-disable-next-line testing-library/prefer-user-event -- fake timers make userEvent hang in this timer-focused test.
    fireEvent.click(screen.getByRole('button', { name: '關閉通知' }));
    expect(onClose).toHaveBeenCalledWith('toast-1');
  });

  it.each([
    ['success'],
    ['info'],
  ])('auto-dismisses %s toast after the existing delay', async (type) => {
    const onClose = vi.fn();

    render(<Toast toast={{ ...baseToast, type }} onClose={onClose} />);

    await act(async () => {
      vi.advanceTimersByTime(2999);
    });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledWith('toast-1');
  });
});

describe('Toast actions', () => {
  it('renders and invokes multiple toast actions', async () => {
    const viewFavorites = vi.fn();
    const undo = vi.fn();
    render(
      <Toast
        toast={{
          ...baseToast,
          actions: [
            { label: '查看收藏', callback: viewFavorites },
            { label: '復原', callback: undo },
          ],
        }}
        onClose={vi.fn()}
      />,
    );

    // eslint-disable-next-line testing-library/prefer-user-event -- fake timers make userEvent hang in this timer-focused test.
    fireEvent.click(screen.getByRole('button', { name: '查看收藏' }));
    // eslint-disable-next-line testing-library/prefer-user-event -- fake timers make userEvent hang in this timer-focused test.
    fireEvent.click(screen.getByRole('button', { name: '復原' }));

    expect(viewFavorites).toHaveBeenNthCalledWith(1);
    expect(undo).toHaveBeenNthCalledWith(1);
  });

  it('keeps the legacy single action contract working', () => {
    const callback = vi.fn();

    render(
      <Toast
        toast={{
          ...baseToast,
          action: { label: '復原', callback },
        }}
        onClose={vi.fn()}
      />,
    );

    // eslint-disable-next-line testing-library/prefer-user-event -- fake timers make userEvent hang in this timer-focused test.
    fireEvent.click(screen.getByRole('button', { name: '復原' }));

    expect(callback).toHaveBeenNthCalledWith(1);
  });
});
