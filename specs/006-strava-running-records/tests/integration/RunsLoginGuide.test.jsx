import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/firebase-client', () => ({ auth: {}, provider: {} }));
vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
}));

import RunsLoginGuide from '@/components/RunsLoginGuide';

describe('RunsLoginGuide', () => {
  it('renders login prompt heading', () => {
    render(<RunsLoginGuide />);

    const heading = screen.getByRole('heading', {
      name: /請先登入以查看跑步紀錄/,
    });
    expect(heading).toBeInTheDocument();
  });

  it('renders a login button', () => {
    render(<RunsLoginGuide />);

    const button = screen.getByRole('button', { name: /登入/ });
    expect(button).toBeInTheDocument();
  });
});
