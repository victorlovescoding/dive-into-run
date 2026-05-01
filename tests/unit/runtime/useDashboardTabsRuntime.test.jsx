import { describe, it, expect } from 'vitest';
import { act, renderHook, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * @typedef {typeof import('@/runtime/hooks/useDashboardTabsRuntime').default} UseDashboardTabsRuntimeHook
 */

const EMPTY_UID = '';

/**
 * 補齊 firebase client import 所需 env，避免 module evaluation 因空值直接失敗。
 * @returns {void}
 */
function seedFirebaseEnv() {
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.example.com';
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test-bucket';
  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '1234567890';
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = 'test-app-id';
}

/**
 * 動態載入 hook，避免測試間 module cache 汙染。
 * @returns {Promise<UseDashboardTabsRuntimeHook>} hook。
 */
async function loadHook() {
  seedFirebaseEnv();
  return (await import('@/runtime/hooks/useDashboardTabsRuntime')).default;
}

/**
 * 渲染最小 tablist harness，專注驗 runtime orchestration 與 keyboard side effect。
 * @param {object} props - harness props。
 * @param {UseDashboardTabsRuntimeHook} props.useDashboardTabsRuntime - 目標 hook。
 * @param {string} props.uid - 使用者 UID。
 * @returns {import('react').ReactElement} harness。
 */
function DashboardTabsRuntimeHarness({ useDashboardTabsRuntime, uid }) {
  const runtime = useDashboardTabsRuntime(uid);

  return (
    <div>
      <output aria-label="目前分頁索引">{String(runtime.activeTab)}</output>
      <div role="tablist">
        {runtime.tabs.map((tabConfig, index) => (
          <button
            key={tabConfig.id}
            id={tabConfig.id}
            type="button"
            role="tab"
            onClick={() => runtime.selectTab(index)}
            onKeyDown={runtime.handleTabKeyDown}
          >
            {tabConfig.label}
          </button>
        ))}
      </div>
    </div>
  );
}

describe('useDashboardTabsRuntime', () => {
  it('starts on events tab and exposes the expected tab configs', async () => {
    const useDashboardTabsRuntime = await loadHook();
    const { result } = renderHook(() => useDashboardTabsRuntime(EMPTY_UID));

    expect(result.current.activeTab).toBe(0);
    expect(
      result.current.tabs.map(({ id, panelId, label, emptyText, hostedIds }) => ({
        id,
        panelId,
        label,
        emptyText,
        hostedIds,
      })),
    ).toEqual([
      {
        id: 'tab-events',
        panelId: 'panel-events',
        label: '我的活動',
        emptyText: '尚未參加任何活動',
        hostedIds: undefined,
      },
      {
        id: 'tab-posts',
        panelId: 'panel-posts',
        label: '我的文章',
        emptyText: '尚未發表任何文章',
        hostedIds: undefined,
      },
      {
        id: 'tab-comments',
        panelId: 'panel-comments',
        label: '我的留言',
        emptyText: '尚未留過任何言',
        hostedIds: undefined,
      },
    ]);
    expect(result.current.tabs[0].tab.items).toEqual([]);
    expect(result.current.tabs[1].tab.items).toEqual([]);
    expect(result.current.tabs[2].tab.items).toEqual([]);
  });

  it('switches the active tab through selectTab', async () => {
    const useDashboardTabsRuntime = await loadHook();
    const { result } = renderHook(() => useDashboardTabsRuntime(EMPTY_UID));

    act(() => {
      result.current.selectTab(2);
    });
    expect(result.current.activeTab).toBe(2);

    act(() => {
      result.current.selectTab(1);
    });
    expect(result.current.activeTab).toBe(1);
  });

  it('moves focus and activeTab with keyboard navigation', async () => {
    const user = userEvent.setup();
    const useDashboardTabsRuntime = await loadHook();

    render(
      <DashboardTabsRuntimeHarness useDashboardTabsRuntime={useDashboardTabsRuntime} uid={EMPTY_UID} />,
    );

    const eventsTab = screen.getByRole('tab', { name: '我的活動' });
    const postsTab = screen.getByRole('tab', { name: '我的文章' });
    const commentsTab = screen.getByRole('tab', { name: '我的留言' });

    eventsTab.focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() => expect(screen.getByLabelText('目前分頁索引')).toHaveTextContent('1'));
    expect(postsTab).toHaveFocus();

    await user.keyboard('{End}');

    await waitFor(() => expect(screen.getByLabelText('目前分頁索引')).toHaveTextContent('2'));
    expect(commentsTab).toHaveFocus();

    await user.keyboard('{Home}');

    await waitFor(() => expect(screen.getByLabelText('目前分頁索引')).toHaveTextContent('0'));
    expect(eventsTab).toHaveFocus();
  });
});
