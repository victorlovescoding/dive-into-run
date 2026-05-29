import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UserLink from './UserLink';

vi.mock('next/link', () => ({
  default: function MockLink({ href, children, ...props }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

vi.mock('next/image', () => ({
  default: function MockImage({ alt, src, width, height, className, style }) {
    return (
      <img
        alt={alt}
        className={className}
        data-height={height}
        data-src={src}
        data-width={width}
        src={src}
        style={style}
      />
    );
  },
}));

describe('UserLink', () => {
  it('applies fixed square visual dimensions from size for remote avatars', () => {
    render(
      <UserLink
        uid="user-1"
        name="Wide Photo User"
        photoURL="https://example.com/wide-avatar.jpg"
        size={48}
      />,
    );

    const avatar = screen.getByRole('img', { name: 'Wide Photo User' });

    expect(avatar).toHaveAttribute('data-width', '48');
    expect(avatar).toHaveAttribute('data-height', '48');
    expect(avatar).toHaveStyle({ width: '48px', height: '48px' });
  });
});
