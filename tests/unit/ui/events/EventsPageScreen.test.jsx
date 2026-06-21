// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EventsPageScreen from '@/ui/events/EventsPageScreen';
import { createFavoriteLoginDialogState } from '../../../_helpers/favorite-login-continuation-helpers';

const eventCreateFormProps = [];
const eventDeleteConfirmProps = [];
const eventEditFormProps = [];
const eventsFilterPanelProps = [];
const eventsListSectionProps = [];

const mocks = vi.hoisted(() => ({
  useEventsPageRuntime: vi.fn(),
}));

vi.mock('@/runtime/hooks/useEventsPageRuntime', () => ({
  default: mocks.useEventsPageRuntime,
}));

vi.mock('@/components/EventDeleteConfirm', () => ({
  default: (props) => {
    eventDeleteConfirmProps.push(props);
    return <div role="dialog" aria-label="刪除活動" />;
  },
}));

vi.mock('@/components/EventEditForm', () => ({
  default: (props) => {
    eventEditFormProps.push(props);
    return <form aria-label="編輯活動" />;
  },
}));

vi.mock('@/ui/events/EventCreateForm', () => ({
  default: (props) => {
    eventCreateFormProps.push(props);
    return <form aria-label="新增活動" />;
  },
}));

vi.mock('@/ui/events/EventsFilterPanel', () => ({
  default: (props) => {
    eventsFilterPanelProps.push(props);
    return <aside aria-label="活動篩選" />;
  },
}));

vi.mock('@/ui/events/EventsListSection', () => ({
  default: (props) => {
    eventsListSectionProps.push(props);
    return <section aria-label="活動列表" />;
  },
}));

/**
 * Creates the events page runtime contract with test-focused defaults.
 * @param {Record<string, unknown>} overrides - Runtime values to override.
 * @returns {Record<string, unknown>} Complete runtime object for the screen.
 */
function createRuntime(overrides = {}) {
  return {
    user: null,
    events: [],
    hostName: '',
    isFormOpen: false,
    isFilterOpen: false,
    filterTimeStart: '',
    filterTimeEnd: '',
    filterDistanceMin: '',
    filterDistanceMax: '',
    filterHasSeatsOnly: false,
    filterCity: '',
    filterDistrict: '',
    showMap: false,
    routeCoordinates: [],
    routePointCount: 0,
    selectedCity: '',
    selectedDistrict: '',
    minDateTime: '',
    isFilteredResults: false,
    isLoadingEvents: false,
    isFiltering: false,
    loadError: null,
    isLoadingMore: false,
    loadMoreError: null,
    hasMore: false,
    favoriteEventIds: new Set(),
    sentinelRef: { current: null },
    isCreating: false,
    pendingByEventId: {},
    myJoinedEventIds: new Set(),
    membershipStatusByEventId: {},
    draftFormData: null,
    editingEvent: null,
    isUpdating: false,
    deletingEventId: null,
    isDeletingEvent: false,
    cityOptions: [],
    filterDistrictOptions: [],
    selectedDistrictOptions: [],
    dialogState: createFavoriteLoginDialogState({ isOpen: false }),
    getRemainingSeats: vi.fn(),
    setFilterTimeStart: vi.fn(),
    setFilterTimeEnd: vi.fn(),
    setFilterDistanceMin: vi.fn(),
    setFilterDistanceMax: vi.fn(),
    setFilterHasSeatsOnly: vi.fn(),
    setFilterDistrict: vi.fn(),
    setSelectedDistrict: vi.fn(),
    setRouteCoordinates: vi.fn(),
    handleOpenFilter: vi.fn(),
    handleCloseFilter: vi.fn(),
    handleFilterCityChange: vi.fn(),
    handleSelectedCityChange: vi.fn(),
    handleEnableRoutePlanning: vi.fn(),
    handleDisableRoutePlanning: vi.fn(),
    handleToggleCreateRunForm: vi.fn(),
    handleCloseCreateForm: vi.fn(),
    handleClearFilters: vi.fn(),
    handleSearchFilters: vi.fn(),
    handleSubmit: vi.fn(),
    handleJoinClick: vi.fn(),
    handleLeaveClick: vi.fn(),
    handleEditEvent: vi.fn(),
    handleEditCancel: vi.fn(),
    handleEditSubmit: vi.fn(),
    handleDeleteEventRequest: vi.fn(),
    handleDeleteCancel: vi.fn(),
    handleDeleteConfirm: vi.fn(),
    handleToggleFavoriteEvent: vi.fn(),
    confirmContinuation: vi.fn(),
    cancelContinuation: vi.fn(),
    closeContinuation: vi.fn(),
    loadMore: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders the events page screen with runtime overrides.
 * @param {Record<string, unknown>} runtimeOverrides - Runtime values to override.
 * @returns {ReturnType<typeof render>} Render result.
 */
function renderScreen(runtimeOverrides = {}) {
  mocks.useEventsPageRuntime.mockReturnValue(createRuntime(runtimeOverrides));
  return render(<EventsPageScreen />);
}

afterEach(() => {
  eventCreateFormProps.length = 0;
  eventDeleteConfirmProps.length = 0;
  eventEditFormProps.length = 0;
  eventsFilterPanelProps.length = 0;
  eventsListSectionProps.length = 0;
  vi.clearAllMocks();
});

describe('EventsPageScreen favorite login continuation dialog', () => {
  it('renders runtime dialog state and forwards confirm, cancel, and close handlers', async () => {
    const user = userEvent.setup();
    const confirmContinuation = vi.fn();
    const cancelContinuation = vi.fn();
    const closeContinuation = vi.fn();

    renderScreen({
      dialogState: createFavoriteLoginDialogState(),
      confirmContinuation,
      cancelContinuation,
      closeContinuation,
    });

    const dialog = screen.getByRole('dialog', { name: '登入後即可收藏' });
    expect(dialog).toHaveTextContent('登入後會自動將這個活動加入收藏。');

    await user.click(screen.getByRole('button', { name: '使用 Google 登入' }));
    await user.click(screen.getByRole('button', { name: '稍後再說' }));
    await user.click(screen.getByRole('button', { name: '關閉收藏登入提示' }));

    expect(confirmContinuation).toHaveBeenLastCalledWith();
    expect(cancelContinuation).toHaveBeenLastCalledWith();
    expect(closeContinuation).toHaveBeenLastCalledWith();
  });
});
