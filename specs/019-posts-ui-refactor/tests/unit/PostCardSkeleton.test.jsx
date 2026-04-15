import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PostCardSkeleton from '@/components/PostCardSkeleton';

describe('PostCardSkeleton', () => {
  it('渲染指定數量的骨架卡片（預設 3）', () => {
    render(<PostCardSkeleton />);
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(3);
  });

  it('count=1 時渲染 1 個骨架卡片', () => {
    render(<PostCardSkeleton count={1} />);
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(1);
  });

  it('count=5 時渲染 5 個骨架卡片', () => {
    render(<PostCardSkeleton count={5} />);
    const skeletons = screen.getAllByRole('status');
    expect(skeletons).toHaveLength(5);
  });

  it('具備 aria-busy 屬性', () => {
    render(<PostCardSkeleton count={1} />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveAttribute('aria-busy', 'true');
  });

  it('具備 aria-label 標示載入中', () => {
    render(<PostCardSkeleton count={1} />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveAttribute('aria-label', '載入中');
  });
});
