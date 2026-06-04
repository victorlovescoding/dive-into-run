import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MemberPageScreen from './MemberPageScreen';

const signedInUser = {
  uid: 'user-1',
  name: 'Runner One',
  email: 'runner@example.com',
  photoURL: null,
};

/**
 * Creates the member screen runtime test double.
 * @param {object} overrides - Runtime values to override.
 * @returns {object} Member page runtime props.
 */
function createRuntime(overrides) {
  return {
    user: null,
    loading: false,
    name: '',
    inputFileRef: { current: null },
    onNameChange: vi.fn(),
    triggerFilePicker: vi.fn(),
    onAvatarFileChange: vi.fn(),
    onSubmitNewName: vi.fn(),
    ...overrides,
  };
}

describe('MemberPageScreen auth-state rendering', () => {
  it('renders no member profile controls for unauthenticated settled auth', () => {
    const { container } = render(
      <MemberPageScreen
        runtime={createRuntime({ user: null, loading: false })}
        bioEditor={null}
        dashboardTabs={null}
        accountDeletionDangerZone={null}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/跑者/u)).not.toBeInTheDocument();
    expect(screen.queryByAltText('大頭貼')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('顯示名稱')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '變更名稱' })).not.toBeInTheDocument();
  });

  it('renders no member profile controls while auth is loading', () => {
    const { container } = render(
      <MemberPageScreen
        runtime={createRuntime({ user: null, loading: true })}
        bioEditor={null}
        dashboardTabs={null}
        accountDeletionDangerZone={null}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/跑者/u)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('顯示名稱')).not.toBeInTheDocument();
  });

  it('keeps signed-in member profile controls unchanged', () => {
    render(
      <MemberPageScreen
        runtime={createRuntime({
          user: signedInUser,
          loading: false,
          name: 'Runner One',
        })}
        bioEditor={<section aria-label="bio slot" />}
        dashboardTabs={<section aria-label="dashboard slot" />}
        accountDeletionDangerZone={<section aria-label="danger slot" />}
      />,
    );

    expect(screen.getByRole('heading', { name: '你好，Runner One' })).toBeInTheDocument();
    expect(screen.getByLabelText('顯示名稱')).toHaveValue('Runner One');
    expect(screen.getByRole('button', { name: '變更名稱' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看我的公開檔案' })).toHaveAttribute(
      'href',
      '/users/user-1',
    );
    expect(screen.getByRole('link', { name: '我的收藏' })).toHaveAttribute(
      'href',
      '/member/favorites',
    );
  });
});
