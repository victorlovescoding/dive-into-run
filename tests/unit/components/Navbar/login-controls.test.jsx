// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileDrawer from '../../../../src/components/Navbar/MobileDrawer';
import UserMenu from '../../../../src/components/Navbar/UserMenu';

vi.mock('../../../../src/lib/firebase-auth-helpers', () => ({
  signOutUser: vi.fn(),
}));

describe('Navbar login controls', () => {
  it('disables the desktop login button while Google sign-in is pending', () => {
    render(
      <UserMenu
        isDropdownOpen={false}
        dropdownRef={{ current: null }}
        avatarButtonRef={{ current: null }}
        toggleDropdown={vi.fn()}
        handleSignOut={vi.fn()}
        handleSignIn={vi.fn()}
        user={null}
        loading={false}
        loginPending
      />,
    );

    const button = screen.getByRole('button', { name: '處理中…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('disables the mobile drawer login button while Google sign-in is pending', () => {
    render(
      <MobileDrawer
        isDrawerOpen
        closeButtonRef={{ current: null }}
        closeDrawer={vi.fn()}
        handleLinkClick={vi.fn()}
        handleSignIn={vi.fn()}
        pathname="/"
        user={null}
        loading={false}
        loginPending
      />,
    );

    const button = screen.getByRole('button', { name: '處理中…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
