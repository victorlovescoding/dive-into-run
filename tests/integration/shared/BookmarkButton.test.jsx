import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BookmarkButton from '@/components/BookmarkButton';

describe('BookmarkButton', () => {
  it('renders an inactive outline bookmark with pressed state false', () => {
    render(<BookmarkButton isActive={false} label="收藏文章" activeLabel="取消收藏文章" />);

    const button = screen.getByRole('button', { name: '收藏文章', pressed: false });
    const icon = screen.getByTestId('bookmark-icon');

    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(icon).toHaveAttribute('fill', 'none');
    expect(icon).toHaveAttribute('stroke', 'currentColor');
  });

  it('renders an active filled bookmark with pressed state true', () => {
    render(<BookmarkButton isActive label="收藏活動" activeLabel="取消收藏活動" />);

    const button = screen.getByRole('button', { name: '取消收藏活動', pressed: true });
    const icon = screen.getByTestId('bookmark-icon');

    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(icon).toHaveAttribute('fill', 'currentColor');
    expect(icon).toHaveAttribute('stroke', 'currentColor');
  });

  it('uses a custom inactive aria-label', () => {
    render(<BookmarkButton isActive={false} label="加入我的收藏" activeLabel="已加入我的收藏" />);

    expect(screen.getByRole('button', { name: '加入我的收藏' })).toBeInTheDocument();
  });

  it('disables the native button and prevents clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <BookmarkButton
        isActive={false}
        label="收藏文章"
        activeLabel="取消收藏文章"
        disabled
        onClick={onClick}
      />,
    );

    const button = screen.getByRole('button', { name: '收藏文章' });

    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('invokes the click callback when enabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <BookmarkButton
        isActive={false}
        label="收藏文章"
        activeLabel="取消收藏文章"
        onClick={onClick}
      />,
    );

    await user.click(screen.getByRole('button', { name: '收藏文章' }));

    expect(onClick).toHaveBeenCalledOnce();
  });
});
