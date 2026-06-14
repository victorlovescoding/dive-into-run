// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EventDeleteConfirm from '@/components/EventDeleteConfirm';

const startedLockReason = '活動已開始，無法編輯或刪除。';

/**
 * Render delete confirmation with default callbacks.
 * @param {Record<string, unknown>} props - Prop overrides.
 * @returns {{ onConfirm: import('vitest').Mock, onCancel: import('vitest').Mock }} callbacks.
 */
function renderConfirm(props = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <EventDeleteConfirm
      eventId="event-1"
      onConfirm={onConfirm}
      onCancel={onCancel}
      isDeleting={Boolean(props.isDeleting)}
      disabledReason={props.disabledReason}
    />,
  );
  return { onConfirm, onCancel };
}

describe('EventDeleteConfirm', () => {
  it('keeps confirm enabled and calls onConfirm when no disabled reason is provided', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderConfirm();

    const confirmButton = screen.getByRole('button', { name: '是，確認刪除' });
    expect(confirmButton).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith('event-1');
  });

  it('disables confirm and exposes the disabled reason when provided', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderConfirm({ disabledReason: startedLockReason });

    const confirmButton = screen.getByRole('button', { name: '是，確認刪除' });
    const reasonAlert = screen.getByRole('alert');
    expect(confirmButton).toBeDisabled();
    expect(reasonAlert).toHaveTextContent(startedLockReason);

    await user.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
