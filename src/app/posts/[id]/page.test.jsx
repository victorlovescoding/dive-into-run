import { afterEach, describe, expect, test, vi } from 'vitest';

import { getPostDetail } from '@/lib/firebase-posts';
import { buildPostOgDescription } from '@/lib/og-helpers';
import { generateMetadata } from './page';

vi.mock('@/lib/firebase-posts', () => ({
  getPostDetail: vi.fn(),
}));

vi.mock('@/lib/og-helpers', () => ({
  buildPostOgDescription: vi.fn(),
}));

vi.mock('./PostDetailClient', () => ({
  default: () => null,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('post detail metadata', () => {
  test('suffixes document title while keeping social title as the post title', async () => {
    vi.mocked(getPostDetail).mockResolvedValue({
      id: 'post-1',
      authorUid: 'user-1',
      title: '我的跑步心得',
      content: '今天第一次跑完半馬',
    });
    vi.mocked(buildPostOgDescription).mockReturnValue('我的跑步心得 — 今天第一次跑完半馬');

    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) });

    expect(metadata.title).toBe('我的跑步心得 | Dive Into Run');
    expect(metadata.openGraph.title).toBe('我的跑步心得');
    expect(metadata.twitter.title).toBe('我的跑步心得');
  });

  test('uses page title fallback for document title and site name for missing post social title', async () => {
    vi.mocked(getPostDetail).mockResolvedValue(null);
    vi.mocked(buildPostOgDescription).mockReturnValue('Dive Into Run 跑步社群平台');

    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'missing-post' }) });

    expect(metadata.title).toBe('文章 | Dive Into Run');
    expect(metadata.openGraph.title).toBe('Dive Into Run');
    expect(metadata.twitter.title).toBe('Dive Into Run');
  });
});
