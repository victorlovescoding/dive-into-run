import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateUserBio } from '@/lib/firebase-profile';
import BioEditor from './BioEditor';

vi.mock('@/lib/firebase-profile', () => ({
  updateUserBio: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Render BioEditor with common test defaults.
 * @param {object} [overrides] - Prop overrides.
 * @returns {{ user: ReturnType<typeof userEvent.setup> }} Test helpers.
 */
function renderBioEditor(overrides = {}) {
  render(<BioEditor uid="user-1" initialBio="原本的簡介" {...overrides} />);
  return { user: userEvent.setup() };
}

describe('BioEditor', () => {
  it('enables save only for trim-distinct bio changes within the length limit', async () => {
    const { user } = renderBioEditor({ initialBio: '  原本的簡介  ' });
    const textarea = screen.getByLabelText('簡介');
    const saveButton = screen.getByRole('button', { name: '儲存簡介' });

    expect(saveButton).toBeDisabled();

    await user.clear(textarea);
    await user.type(textarea, '原本的簡介');
    expect(saveButton).toBeDisabled();

    await user.clear(textarea);
    await user.type(textarea, '  原本的簡介  ');
    expect(saveButton).toBeDisabled();

    await user.clear(textarea);
    await user.type(textarea, '新的簡介');
    expect(saveButton).toBeEnabled();

    await user.clear(textarea);
    await user.type(textarea, 'a'.repeat(151));
    expect(saveButton).toBeDisabled();
  });

  it('resets the unchanged baseline after a successful save', async () => {
    vi.mocked(updateUserBio).mockResolvedValue(undefined);
    const { user } = renderBioEditor();
    const textarea = screen.getByLabelText('簡介');
    const saveButton = screen.getByRole('button', { name: '儲存簡介' });

    expect(saveButton).toBeDisabled();

    await user.clear(textarea);
    await user.type(textarea, '新的簡介');
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);

    await waitFor(() => expect(updateUserBio).toHaveBeenCalledWith('user-1', '新的簡介'));
    expect(screen.getByRole('status')).toHaveTextContent('已儲存');
    expect(screen.getByRole('button', { name: '儲存簡介' })).toBeDisabled();
  });

  it('does not call updateUserBio when save is triggered for trim-equivalent unchanged bio', async () => {
    const { user } = renderBioEditor({ initialBio: '原本的簡介' });
    const textarea = screen.getByLabelText('簡介');
    const saveButton = screen.getByRole('button', { name: '儲存簡介' });

    await user.clear(textarea);
    await user.type(textarea, '  原本的簡介  ');

    saveButton.removeAttribute('disabled');
    await user.click(saveButton);

    expect(updateUserBio).not.toHaveBeenCalled();
  });
});
