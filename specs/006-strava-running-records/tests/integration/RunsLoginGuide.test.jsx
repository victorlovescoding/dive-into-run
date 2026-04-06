import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RunsLoginGuide from '@/components/RunsLoginGuide';

describe('RunsLoginGuide', () => {
  it('renders login prompt heading', () => {
    render(<RunsLoginGuide />);

    const heading = screen.getByRole('heading', {
      name: /請先登入以查看跑步紀錄/,
    });
    expect(heading).toBeInTheDocument();
  });

  it('renders a link that navigates to /login', () => {
    render(<RunsLoginGuide />);

    const link = screen.getByRole('link', { name: /登入/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });
});
