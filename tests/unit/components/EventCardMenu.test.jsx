// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EventCardMenu from '@/components/EventCardMenu';

const hostUid = 'host-1';
const nonHostUid = 'runner-1';
const startedLockReason = '活動已開始，無法編輯或刪除。';

/**
 * 建立 host 視角的活動 fixture。
 * @param {Record<string, unknown>} overrides - 覆寫欄位。
 * @returns {Record<string, unknown>} 活動 fixture。
 */
function createHostEvent(overrides = {}) {
  return {
    id: 'event-1',
    title: '晨跑團',
    hostUid,
    time: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

/**
 * 建立非 host 視角的活動 fixture。
 * @param {Record<string, unknown>} overrides - 覆寫欄位。
 * @returns {Record<string, unknown>} 活動 fixture。
 */
function createNonHostEvent(overrides = {}) {
  return createHostEvent({
    hostUid: 'another-host',
    ...overrides,
  });
}

/**
 * Render owner menu with default callbacks.
 * @param {Record<string, unknown>} props - Prop overrides.
 * @returns {{ onEdit: import('vitest').Mock, onDelete: import('vitest').Mock }} callbacks.
 */
function renderMenu(props = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const currentUserUid = Object.hasOwn(props, 'currentUserUid')
    ? props.currentUserUid
    : hostUid;
  render(
    <EventCardMenu
      event={props.event ?? createHostEvent()}
      currentUserUid={currentUserUid}
      onEdit={onEdit}
      onDelete={onDelete}
      editDisabledReason={props.editDisabledReason}
      deleteDisabledReason={props.deleteDisabledReason}
    />,
  );
  return { onEdit, onDelete };
}

/**
 * Opens the owner menu.
 * @returns {Promise<void>} Open completion.
 */
async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '更多操作' }));
}

describe('EventCardMenu owner controls', () => {
  it('keeps owner edit and delete controls enabled when no disabled reason is provided', async () => {
    const { onEdit, onDelete } = renderMenu();
    const user = userEvent.setup();

    await openMenu();

    const editButton = screen.getByRole('menuitem', { name: '編輯活動' });
    const deleteButton = screen.getByRole('menuitem', { name: '刪除活動' });
    expect(editButton).toBeEnabled();
    expect(deleteButton).toBeEnabled();

    await user.click(editButton);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-1' }));

    await openMenu();
    await user.click(screen.getByRole('menuitem', { name: '刪除活動' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'event-1' }));
  });

  it('does not render owner controls for non-host users', () => {
    renderMenu({
      event: createNonHostEvent(),
      currentUserUid: nonHostUid,
      editDisabledReason: startedLockReason,
      deleteDisabledReason: startedLockReason,
    });

    expect(screen.queryByRole('button', { name: '更多操作' })).not.toBeInTheDocument();
    expect(screen.queryByText(startedLockReason)).not.toBeInTheDocument();
  });

  it('does not render started-lock controls for unauthenticated users', () => {
    renderMenu({
      currentUserUid: null,
      editDisabledReason: startedLockReason,
      deleteDisabledReason: startedLockReason,
    });

    expect(screen.queryByRole('button', { name: '更多操作' })).not.toBeInTheDocument();
    expect(screen.queryByText(startedLockReason)).not.toBeInTheDocument();
  });

  it('disables owner edit control with the started-lock reason', async () => {
    const { onEdit } = renderMenu({
      editDisabledReason: startedLockReason,
    });
    const user = userEvent.setup();

    await openMenu();

    const editButton = screen.getByRole('menuitem', {
      name: `編輯活動 ${startedLockReason}`,
    });
    expect(editButton).toBeDisabled();
    expect(editButton).toHaveAttribute('title', startedLockReason);
    expect(screen.getByText(startedLockReason)).toBeVisible();

    await user.click(editButton);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('disables owner delete control with the started-lock reason', async () => {
    const { onDelete } = renderMenu({
      deleteDisabledReason: startedLockReason,
    });
    const user = userEvent.setup();

    await openMenu();

    const deleteButton = screen.getByRole('menuitem', {
      name: `刪除活動 ${startedLockReason}`,
    });
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute('title', startedLockReason);
    expect(screen.getByText(startedLockReason)).toBeVisible();

    await user.click(deleteButton);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
