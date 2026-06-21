// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MemberFavoritesScreen from '@/ui/member/MemberFavoritesScreen';

/**
 * Creates a member favorites runtime contract for screen tests.
 * @param {Record<string, unknown>} overrides - Runtime values to override.
 * @returns {Record<string, unknown>} Runtime test double.
 */
function createRuntime(overrides = {}) {
  return {
    canRender: true,
    tabs: [
      {
        id: 'member-favorites-tab-posts',
        panelId: 'member-favorites-panel-posts',
        label: '收藏文章',
        tabIndex: 0,
        isActive: true,
        emptyText: '尚未收藏任何文章',
        bucket: { items: [], isLoading: false, error: '' },
      },
      {
        id: 'member-favorites-tab-events',
        panelId: 'member-favorites-panel-events',
        label: '收藏活動',
        tabIndex: 1,
        isActive: false,
        emptyText: '尚未收藏任何活動',
        bucket: { items: [], isLoading: false, error: '' },
      },
    ],
    selectTab: vi.fn(),
    handleTabKeyDown: vi.fn(),
    removeFavorite: vi.fn(),
    ...overrides,
  };
}

describe('MemberFavoritesScreen auth gate rendering', () => {
  it('does not show a fake empty state while the runtime cannot render member data', () => {
    render(<MemberFavoritesScreen runtime={createRuntime({ canRender: false })} />);

    expect(screen.queryByText('尚未收藏任何文章')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '我的收藏' })).not.toBeInTheDocument();
  });

  it('shows the empty state only when authenticated favorites are really empty', () => {
    render(<MemberFavoritesScreen runtime={createRuntime()} />);

    expect(screen.getByRole('heading', { name: '我的收藏' })).toBeInTheDocument();
    expect(screen.getByText('尚未收藏任何文章')).toBeInTheDocument();
  });
});
