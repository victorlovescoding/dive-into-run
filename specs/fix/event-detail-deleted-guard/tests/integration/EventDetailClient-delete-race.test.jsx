/**
 * @file Integration test for EventDetailClient delete race condition.
 * @description
 * 同一活動詳情頁在多個 tab 打開，其中一個 tab 刪除成功後，另一個 tab 按刪除
 * 應顯示紅色 errorCard（與 load-time not-found 一致），不顯示誤導的 toast。
 *
 * 三個 scenario：
 * - race path：deleteEvent 拋 EVENT_NOT_FOUND_MESSAGE → errorCard + console.warn
 * - genuine error：其他 error → toast「刪除活動失敗」 + console.error
 * - happy path：deleteEvent 成功 → navigate 到 /events?toast=活動已刪除
 *
 * 沿用 `PostDetailClient-delete-race.test.jsx`（commit 8427e15）pattern。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// NOTE: Vitest 會自動把 `vi.mock(...)` 提升到所有 imports 之上，因此以下 imports
// 在執行時拿到的是 mock 後的模組。不要搬到 vi.mock 之後（會觸發 import/first）。
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import {
  fetchEventById,
  fetchParticipants,
  fetchMyJoinedEventsForIds,
  deleteEvent,
  EVENT_NOT_FOUND_MESSAGE,
} from '@/lib/firebase-events';

// ---------------------------------------------------------------------------
// Hoisted shared state
// ---------------------------------------------------------------------------
const { mockShowToast, mockPush, mockReplace, mockAuthContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return {
    mockShowToast: vi.fn(),
    mockPush: vi.fn(),
    mockReplace: vi.fn(),
    mockAuthContext: createContext({
      user: { uid: 'host-1', name: 'Victor', photoURL: '/avatar.jpg' },
    }),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: mockAuthContext,
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  Timestamp: {
    fromDate: (/** @type {Date} */ d) => ({
      seconds: Math.floor(d.getTime() / 1000),
      nanoseconds: 0,
      toDate: () => d,
    }),
  },
}));

vi.mock('@/lib/firebase-events', () => ({
  fetchEventById: vi.fn(),
  fetchParticipants: vi.fn(),
  fetchMyJoinedEventsForIds: vi.fn(),
  joinEvent: vi.fn(),
  leaveEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  EVENT_NOT_FOUND_MESSAGE: '活動不存在',
}));

vi.mock('@/lib/firebase-notifications', () => ({
  notifyEventModified: vi.fn().mockResolvedValue(undefined),
  notifyEventCancelled: vi.fn().mockResolvedValue(undefined),
  notifyEventNewComment: vi.fn().mockResolvedValue(undefined),
}));

// Heavy / irrelevant sub-components
vi.mock('@/components/EventMap', () => ({
  default: () => <div data-testid="event-map-stub" />,
}));

vi.mock('@/components/CommentSection', () => ({
  default: () => <div data-testid="comment-section-stub" />,
}));

vi.mock('@/components/ShareButton', () => ({
  default: () => <button type="button">Share</button>,
}));

vi.mock('@/components/UserLink', () => ({
  default: (/** @type {{ name?: string }} */ { name }) => <span>{name || ''}</span>,
}));

vi.mock('@/components/EventEditForm', () => ({
  default: () => <div data-testid="event-edit-form-stub" />,
}));

vi.mock('next/link', () => ({
  default: (
    /** @type {{ children: import('react').ReactNode, href: string }} */ {
      children,
      href,
      ...props
    },
  ) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    /**
     * Stub replacement for `dynamic()`-loaded components (e.g. EventMap)。
     * @returns {null} 不渲染任何 DOM，避免把 Leaflet 拉進 jsdom。
     */
    function Stub() {
      return null;
    }
    return Stub;
  },
}));

/** @type {import('vitest').Mock} */
const mockedFetchEventById = /** @type {import('vitest').Mock} */ (fetchEventById);
/** @type {import('vitest').Mock} */
const mockedFetchParticipants = /** @type {import('vitest').Mock} */ (fetchParticipants);
/** @type {import('vitest').Mock} */
const mockedFetchMyJoined = /** @type {import('vitest').Mock} */ (fetchMyJoinedEventsForIds);
/** @type {import('vitest').Mock} */
const mockedDeleteEvent = /** @type {import('vitest').Mock} */ (deleteEvent);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockEvent = {
  id: 'event-1',
  title: '週末晨跑',
  time: { toDate: () => new Date('2030-04-20T06:00:00Z') },
  registrationDeadline: { toDate: () => new Date('2030-04-19T23:59:00Z') },
  city: '臺北市',
  district: '中山區',
  meetPlace: '圓山站一號出口',
  distanceKm: 10,
  paceSec: 360,
  maxParticipants: 20,
  participantsCount: 0,
  remainingSeats: 20,
  hostUid: 'host-1',
  hostName: 'Victor',
  hostPhotoURL: '/avatar.jpg',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('EventDetailClient delete race condition', () => {
  /** @type {ReturnType<typeof vi.spyOn>} */
  let consoleErrorSpy;
  /** @type {ReturnType<typeof vi.spyOn>} */
  let consoleWarnSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchEventById.mockResolvedValue(mockEvent);
    mockedFetchParticipants.mockResolvedValue([]);
    mockedFetchMyJoined.mockResolvedValue(new Set());
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  /**
   * 開啟 host menu → 點「刪除活動」→ 按「是，確認刪除」。
   * @param {ReturnType<typeof userEvent.setup>} user - userEvent 實例。
   */
  async function openAndConfirmDelete(user) {
    await screen.findByText('週末晨跑');
    const menuTrigger = screen.getByRole('button', { name: '更多操作' });
    await user.click(menuTrigger);
    const deleteMenuItem = await screen.findByRole('menuitem', { name: '刪除活動' });
    await user.click(deleteMenuItem);
    const confirmButton = await screen.findByRole('button', { name: '是，確認刪除' });
    await user.click(confirmButton);
  }

  it('race path：deleteEvent 拋「活動不存在」時顯示紅卡片、不 toast、不 navigate', async () => {
    mockedDeleteEvent.mockRejectedValue(new Error(EVENT_NOT_FOUND_MESSAGE));

    const user = userEvent.setup();
    render(<EventDetailClient id="event-1" />);
    await openAndConfirmDelete(user);

    await waitFor(() => {
      expect(screen.getByText('找不到這個活動（可能已被刪除）')).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    // race 是預期內情境，不該觸發 console.error（否則 Next.js dev overlay 會誤報）
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    // 應以 warn 級別留 trace 便於 telemetry / debug
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('already deleted by another session'),
    );
  });

  it('genuine error：deleteEvent 拋其他錯誤時 toast「刪除活動失敗」、不顯示紅卡片', async () => {
    mockedDeleteEvent.mockRejectedValue(new Error('Firestore batch failed'));

    const user = userEvent.setup();
    render(<EventDetailClient id="event-1" />);
    await openAndConfirmDelete(user);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('刪除活動失敗，請稍後再試', 'error');
    });
    expect(screen.queryByText('找不到這個活動（可能已被刪除）')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    // 真正的錯誤仍該觸發 console.error，便於 debug
    expect(consoleErrorSpy).toHaveBeenCalledWith('刪除活動失敗:', expect.any(Error));
  });

  it('happy path：deleteEvent 成功時 navigate 到 /events?toast=活動已刪除', async () => {
    mockedDeleteEvent.mockResolvedValue({ ok: true });

    const user = userEvent.setup();
    render(<EventDetailClient id="event-1" />);
    await openAndConfirmDelete(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events?toast=活動已刪除');
    });
    expect(mockShowToast).not.toHaveBeenCalledWith(expect.stringContaining('失敗'), 'error');
  });
});
