// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ToastProvider, { useToast } from '../../../src/runtime/providers/ToastProvider';

vi.mock('next/navigation', () => ({
  usePathname: () => '/toast-provider-test',
}));

/**
 * Test host that exposes the toast provider contract through buttons.
 * @returns {import('react').ReactElement} Provider consumer host.
 */
function ToastProviderHost() {
  const { showToast, toasts } = useToast();

  return (
    <>
      <button
        type="button"
        onClick={() =>
          showToast('多 action', 'success', [
            { label: '查看收藏', callback: vi.fn() },
            { label: '復原', callback: vi.fn() },
          ])
        }
      >
        multi
      </button>
      <button
        type="button"
        onClick={() => showToast('單 action', 'success', { label: '復原', callback: vi.fn() })}
      >
        single
      </button>
      <output aria-label="toast-json">{JSON.stringify(toasts.at(-1) ?? null)}</output>
    </>
  );
}

beforeEach(() => {
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => 'toast-provider-id'),
  });
});

describe('ToastProvider showToast contract', () => {
  it('stores multiple actions on a toast', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastProviderHost />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'multi' }));

    expect(JSON.parse(screen.getByLabelText('toast-json').textContent || '')).toMatchObject({
      message: '多 action',
      actions: [
        { label: '查看收藏' },
        { label: '復原' },
      ],
    });
  });

  it('keeps storing a legacy single action on action', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ToastProviderHost />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'single' }));

    expect(JSON.parse(screen.getByLabelText('toast-json').textContent || '')).toMatchObject({
      message: '單 action',
      action: { label: '復原' },
    });
  });
});
