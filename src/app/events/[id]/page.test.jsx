import { afterEach, describe, expect, test, vi } from 'vitest';

import { fetchEventById } from '@/lib/firebase-events';
import { buildEventOgDescription } from '@/lib/og-helpers';
import { generateMetadata } from './page';

vi.mock('@/lib/firebase-events', () => ({
  fetchEventById: vi.fn(),
}));

vi.mock('@/lib/og-helpers', () => ({
  buildEventOgDescription: vi.fn(),
}));

vi.mock('./eventDetailClient', () => ({
  default: () => null,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('event detail metadata', () => {
  test('suffixes document title while keeping social title as the event title', async () => {
    vi.mocked(fetchEventById).mockResolvedValue({
      title: '週末晨跑',
      city: '台北市',
      district: '大安區',
      time: '2026-04-15T00:00:00.000Z',
      registrationDeadline: '2026-04-14T00:00:00.000Z',
      distanceKm: 5,
      maxParticipants: 10,
      paceSec: 360,
    });
    vi.mocked(buildEventOgDescription).mockReturnValue('2026/04/15 · 台北市大安區');

    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'event-1' }) });

    expect(metadata.title).toBe('週末晨跑 | Dive Into Run');
    expect(metadata.openGraph.title).toBe('週末晨跑');
    expect(metadata.twitter.title).toBe('週末晨跑');
  });

  test('uses page title fallback for document title and site name for missing event social title', async () => {
    vi.mocked(fetchEventById).mockResolvedValue(null);
    vi.mocked(buildEventOgDescription).mockReturnValue('Dive Into Run 跑步社群平台');

    const metadata = await generateMetadata({ params: Promise.resolve({ id: 'missing-event' }) });

    expect(metadata.title).toBe('活動 | Dive Into Run');
    expect(metadata.openGraph.title).toBe('Dive Into Run');
    expect(metadata.twitter.title).toBe('Dive Into Run');
  });
});
