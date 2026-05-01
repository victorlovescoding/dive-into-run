/**
 * @file Integration test for EventDetailClient delete race condition.
 * @description
 * 同一活動詳情頁在多個 tab 打開，其中一個 tab 刪除成功後，另一個 tab 按刪除
 * 應顯示紅色 errorCard（與 load-time not-found 一致），不顯示誤導的 toast。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import EventDetailClient from '@/app/events/[id]/eventDetailClient';
import {
  createFirestoreDocSnapshot as createDocSnapshot,
  createFirestoreQuerySnapshot as createQuerySnapshot,
} from '../../_helpers/factories';

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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock('@/runtime/providers/AuthProvider', () => ({
  AuthContext: mockAuthContext,
}));

vi.mock('@/runtime/providers/ToastProvider', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

vi.mock('@/config/client/firebase-client', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => ({ __type: 'serverTimestamp' })),
  where: vi.fn(),
  writeBatch: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
  },
}));

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

const firestoreMocks = {
  ['collection']: /** @type {import('vitest').Mock} */ (collection),
  ['doc']: /** @type {import('vitest').Mock} */ (doc),
  ['getDoc']: /** @type {import('vitest').Mock} */ (getDoc),
  ['getDocs']: /** @type {import('vitest').Mock} */ (getDocs),
  ['limit']: /** @type {import('vitest').Mock} */ (limit),
  ['orderBy']: /** @type {import('vitest').Mock} */ (orderBy),
  ['query']: /** @type {import('vitest').Mock} */ (query),
  ['serverTimestamp']: /** @type {import('vitest').Mock} */ (serverTimestamp),
  ['where']: /** @type {import('vitest').Mock} */ (where),
  ['writeBatch']: /** @type {import('vitest').Mock} */ (writeBatch),
};

const mockEvent = {
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

/**
 * 設定刪除流程需要的 Firestore SDK 邊界 stub。
 * @param {{ deleteEventExists?: boolean, batchError?: Error | null }} [options] - 刪除情境。
 * @returns {{ batch: { delete: import('vitest').Mock, commit: import('vitest').Mock } }} SDK spies。
 */
function setupFirestoreMocks({ deleteEventExists = true, batchError = null } = {}) {
  let eventReadCount = 0;
  const batch = {
    set: vi.fn(),
    delete: vi.fn(),
    commit: batchError
      ? vi.fn().mockRejectedValue(batchError)
      : vi.fn().mockResolvedValue(undefined),
  };

  firestoreMocks.collection.mockImplementation((_dbOrRef, ...segments) => ({
    type: 'collection',
    path: segments.join('/'),
  }));
  firestoreMocks.doc.mockImplementation((base, ...segments) => {
    if (base?.type === 'collection' && segments.length === 0) {
      return { id: 'generated-doc', path: `${base.path}/generated-doc` };
    }
    if (base?.type === 'collection') {
      return { id: String(segments.at(-1)), path: [base.path, ...segments].join('/') };
    }
    return { id: String(segments.at(-1)), path: segments.join('/') };
  });
  firestoreMocks.query.mockImplementation((...parts) => ({
    type: 'query',
    path: parts[0]?.path,
    parts,
  }));
  firestoreMocks.where.mockImplementation((...parts) => ({ type: 'where', parts }));
  firestoreMocks.orderBy.mockImplementation((...parts) => ({ type: 'orderBy', parts }));
  firestoreMocks.limit.mockImplementation((count) => ({ type: 'limit', count }));
  firestoreMocks.writeBatch.mockReturnValue(batch);
  firestoreMocks.getDoc.mockImplementation(async (ref) => {
    if (ref.path === 'events/event-1') {
      eventReadCount += 1;
      return createDocSnapshot(
        'event-1',
        eventReadCount === 1 || deleteEventExists ? mockEvent : null,
      );
    }
    if (ref.path === 'events/event-1/participants/host-1') {
      return createDocSnapshot('host-1', null);
    }
    return createDocSnapshot(String(ref.id), null);
  });
  firestoreMocks.getDocs.mockImplementation(async (ref) => {
    if (ref.path === 'events/event-1/participants') return createQuerySnapshot([]);
    if (ref.path === 'events/event-1/comments') return createQuerySnapshot([]);
    return createQuerySnapshot([]);
  });

  return { batch };
}

describe('EventDetailClient delete race condition', () => {
  /** @type {ReturnType<typeof vi.spyOn>} */
  let consoleErrorSpy;
  /** @type {ReturnType<typeof vi.spyOn>} */
  let consoleWarnSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    setupFirestoreMocks();
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

  it('race path：deleteEventTree 讀到活動不存在時顯示紅卡片、不 toast、不 navigate', async () => {
    setupFirestoreMocks({ deleteEventExists: false });

    const user = userEvent.setup();
    render(<EventDetailClient id="event-1" />);
    await openAndConfirmDelete(user);

    await waitFor(() => {
      expect(screen.getByText('找不到這個活動（可能已被刪除）')).toBeInTheDocument();
    });
    expect(firestoreMocks.getDoc).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'events/event-1' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockShowToast).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('already deleted by another session'),
    );
  });

  it('genuine error：batch commit 失敗時 toast「刪除活動失敗」、不顯示紅卡片', async () => {
    setupFirestoreMocks({ batchError: new Error('Firestore batch failed') });

    const user = userEvent.setup();
    render(<EventDetailClient id="event-1" />);
    await openAndConfirmDelete(user);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('刪除活動失敗，請稍後再試', 'error');
    });
    expect(screen.queryByText('找不到這個活動（可能已被刪除）')).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('刪除活動失敗:', expect.any(Error));
  });

  it('happy path：deleteEventTree commit 成功時 navigate 到 /events?toast=活動已刪除', async () => {
    const { batch } = setupFirestoreMocks();

    const user = userEvent.setup();
    render(<EventDetailClient id="event-1" />);
    await openAndConfirmDelete(user);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events?toast=活動已刪除');
    });
    expect(batch.delete).toHaveBeenCalledWith(expect.objectContaining({ path: 'events/event-1' }));
    expect(batch.commit).toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalledWith(expect.stringContaining('失敗'), 'error');
  });
});
