// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FavoriteLoginContinuationDialog from '@/components/FavoriteLoginContinuationDialog';
import {
  createFavoriteLoginDialogState,
  FAVORITE_LOGIN_TEST_COPY,
} from '../../_helpers/favorite-login-continuation-helpers';

/**
 * Renders the favorite login continuation dialog.
 * @param {object} [props] - Prop overrides.
 * @returns {{
 *   user: ReturnType<typeof userEvent.setup>,
 *   onConfirm: import('vitest').Mock,
 *   onCancel: import('vitest').Mock,
 *   onClose: import('vitest').Mock
 * }} Rendered dialog controls.
 */
function renderFavoriteLoginContinuationDialog(props = {}) {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const onClose = vi.fn();

  render(
    <FavoriteLoginContinuationDialog
      dialogState={createFavoriteLoginDialogState()}
      onConfirm={onConfirm}
      onCancel={onCancel}
      onClose={onClose}
      targetTitle="河濱晨跑"
      targetName="河濱晨跑"
      targetId="event-secret-id"
      authorName="Host Runner"
      {...props}
    />,
  );

  return { user, onConfirm, onCancel, onClose };
}

describe('FavoriteLoginContinuationDialog copy and accessibility', () => {
  it('renders exact event copy with an accessible dialog name', () => {
    renderFavoriteLoginContinuationDialog();

    expect(screen.getByRole('dialog', { name: FAVORITE_LOGIN_TEST_COPY.title }))
      .toBeInTheDocument();
    expect(screen.getByText(FAVORITE_LOGIN_TEST_COPY.eventBody)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: FAVORITE_LOGIN_TEST_COPY.primaryLabel }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: FAVORITE_LOGIN_TEST_COPY.secondaryLabel }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: '關閉收藏登入提示' })).toBeInTheDocument();
  });

  it('renders exact post copy', () => {
    renderFavoriteLoginContinuationDialog({
      dialogState: createFavoriteLoginDialogState({
        contentType: 'post',
        body: FAVORITE_LOGIN_TEST_COPY.postBody,
      }),
    });

    expect(screen.getByRole('dialog', { name: FAVORITE_LOGIN_TEST_COPY.title }))
      .toBeInTheDocument();
    expect(screen.getByText(FAVORITE_LOGIN_TEST_COPY.postBody)).toBeInTheDocument();
  });

  it('does not render target title, name, id, author, host, or favorite state', () => {
    renderFavoriteLoginContinuationDialog();

    [
      '河濱晨跑',
      'event-secret-id',
      'Host Runner',
      'host',
      'author',
      'favorited',
      '已收藏',
    ].forEach((forbiddenText) => {
      expect(screen.queryByText(forbiddenText, { exact: false })).not.toBeInTheDocument();
    });
  });

  it('renders nothing when closed', () => {
    renderFavoriteLoginContinuationDialog({
      dialogState: createFavoriteLoginDialogState({ isOpen: false }),
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('FavoriteLoginContinuationDialog actions', () => {
  it('calls confirm from the primary Google button', async () => {
    const { user, onConfirm, onCancel, onClose } = renderFavoriteLoginContinuationDialog();

    await user.click(screen.getByRole('button', { name: FAVORITE_LOGIN_TEST_COPY.primaryLabel }));

    expect(onConfirm).toHaveBeenCalledWith();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls cancel from the secondary button', async () => {
    const { user, onConfirm, onCancel, onClose } = renderFavoriteLoginContinuationDialog();

    await user.click(screen.getByRole('button', { name: FAVORITE_LOGIN_TEST_COPY.secondaryLabel }));

    expect(onCancel).toHaveBeenCalledWith();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls close from the close button', async () => {
    const { user, onConfirm, onCancel, onClose } = renderFavoriteLoginContinuationDialog();

    await user.click(screen.getByRole('button', { name: '關閉收藏登入提示' }));

    expect(onClose).toHaveBeenCalledWith();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('disables the primary action and marks the dialog busy while pending', () => {
    renderFavoriteLoginContinuationDialog({
      dialogState: createFavoriteLoginDialogState({ isSubmitting: true }),
    });

    expect(screen.getByRole('dialog', { name: FAVORITE_LOGIN_TEST_COPY.title }))
      .toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: FAVORITE_LOGIN_TEST_COPY.primaryLabel }))
      .toBeDisabled();
    expect(screen.getByRole('button', { name: FAVORITE_LOGIN_TEST_COPY.secondaryLabel }))
      .toBeDisabled();
    expect(screen.getByRole('button', { name: '關閉收藏登入提示' }))
      .toBeDisabled();
  });

  it('does not call confirm when the pending primary action is clicked', async () => {
    const { user, onConfirm, onCancel, onClose } = renderFavoriteLoginContinuationDialog({
      dialogState: createFavoriteLoginDialogState({ isSubmitting: true }),
    });

    await user.click(screen.getByRole('button', { name: FAVORITE_LOGIN_TEST_COPY.primaryLabel }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call cancel or close when pending dismissal actions are clicked', async () => {
    const { user, onConfirm, onCancel, onClose } = renderFavoriteLoginContinuationDialog({
      dialogState: createFavoriteLoginDialogState({ isSubmitting: true }),
    });

    await user.click(screen.getByRole('button', { name: FAVORITE_LOGIN_TEST_COPY.secondaryLabel }));
    await user.click(screen.getByRole('button', { name: '關閉收藏登入提示' }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
