// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import MobileDrawer from '../../../../src/components/Navbar/MobileDrawer';
import UserMenu from '../../../../src/components/Navbar/UserMenu';

vi.mock('../../../../src/lib/firebase-auth-helpers', () => ({
  signOutUser: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ href, className, children, onClick, role, ...props }) => (
    <a
      href={href}
      className={className}
      role={role}
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

const signedInUser = {
  uid: 'runner-123',
  name: '測試跑者',
  photoURL: null,
};

/**
 * 建立可觀察 dropdown 關閉狀態的 UserMenu 測試包裝元件。
 * @returns {import('react').JSX.Element} UserMenu 測試包裝元件。
 */
function StatefulUserMenu() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(true);

  return (
    <UserMenu
      isDropdownOpen={isDropdownOpen}
      dropdownRef={{ current: null }}
      avatarButtonRef={{ current: null }}
      toggleDropdown={() => setIsDropdownOpen((open) => !open)}
      closeDropdown={() => setIsDropdownOpen(false)}
      handleSignOut={vi.fn()}
      handleSignIn={vi.fn()}
      user={signedInUser}
      loading={false}
      loginPending={false}
    />
  );
}

describe('Navbar login controls', () => {
  it('disables the desktop login button while Google sign-in is pending', () => {
    render(
      <UserMenu
        isDropdownOpen={false}
        dropdownRef={{ current: null }}
        avatarButtonRef={{ current: null }}
        toggleDropdown={vi.fn()}
        closeDropdown={vi.fn()}
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

  it('shows signed-in desktop menu links with the correct hrefs', () => {
    render(
      <UserMenu
        isDropdownOpen
        dropdownRef={{ current: null }}
        avatarButtonRef={{ current: null }}
        toggleDropdown={vi.fn()}
        closeDropdown={vi.fn()}
        handleSignOut={vi.fn()}
        handleSignIn={vi.fn()}
        user={signedInUser}
        loading={false}
        loginPending={false}
      />,
    );

    expect(screen.getByRole('menuitem', { name: '會員中心' })).toHaveAttribute('href', '/member');
    expect(screen.getByRole('menuitem', { name: '我的收藏' })).toHaveAttribute(
      'href',
      '/member/favorites',
    );
    expect(screen.getByRole('menuitem', { name: '我的公開檔案' })).toHaveAttribute(
      'href',
      '/users/runner-123',
    );
    expect(screen.getByRole('menuitem', { name: '登出' })).toBeInTheDocument();
  });

  it('closes the desktop dropdown after a menu link is clicked', async () => {
    const user = userEvent.setup();

    render(<StatefulUserMenu />);

    await user.click(screen.getByRole('menuitem', { name: '我的收藏' }));

    expect(screen.getByRole('button', { name: '使用者選單' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
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

  it('shows signed-in mobile member links with hrefs and drawer link handling', async () => {
    const user = userEvent.setup();
    const handleLinkClick = vi.fn((event) => event.preventDefault());

    render(
      <MobileDrawer
        isDrawerOpen
        closeButtonRef={{ current: null }}
        closeDrawer={vi.fn()}
        handleLinkClick={handleLinkClick}
        handleSignIn={vi.fn()}
        pathname="/"
        user={signedInUser}
        loading={false}
        loginPending={false}
      />,
    );

    const memberNav = screen.getByRole('navigation', { name: '會員導覽' });
    const memberCenterLink = within(memberNav).getByRole('link', { name: '會員中心' });
    const favoritesLink = within(memberNav).getByRole('link', { name: '我的收藏' });
    const publicProfileLink = within(memberNav).getByRole('link', { name: '我的公開檔案' });

    expect(memberNav).toContainElement(memberCenterLink);
    expect(memberCenterLink).toHaveAttribute('href', '/member');
    expect(favoritesLink).toHaveAttribute('href', '/member/favorites');
    expect(publicProfileLink).toHaveAttribute('href', '/users/runner-123');

    await user.click(favoritesLink);

    expect(handleLinkClick).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ defaultPrevented: true }),
    );
  });

  it('does not show member links while loading or signed out', () => {
    const { rerender } = render(
      <UserMenu
        isDropdownOpen={false}
        dropdownRef={{ current: null }}
        avatarButtonRef={{ current: null }}
        toggleDropdown={vi.fn()}
        closeDropdown={vi.fn()}
        handleSignOut={vi.fn()}
        handleSignIn={vi.fn()}
        user={null}
        loading
        loginPending={false}
      />,
    );

    expect(screen.queryByText('會員中心')).not.toBeInTheDocument();
    expect(screen.queryByText('我的收藏')).not.toBeInTheDocument();
    expect(screen.queryByText('我的公開檔案')).not.toBeInTheDocument();

    rerender(
      <MobileDrawer
        isDrawerOpen
        closeButtonRef={{ current: null }}
        closeDrawer={vi.fn()}
        handleLinkClick={vi.fn()}
        handleSignIn={vi.fn()}
        pathname="/"
        user={null}
        loading={false}
        loginPending={false}
      />,
    );

    expect(screen.queryByText('會員中心')).not.toBeInTheDocument();
    expect(screen.queryByText('我的收藏')).not.toBeInTheDocument();
    expect(screen.queryByText('我的公開檔案')).not.toBeInTheDocument();
  });
});
