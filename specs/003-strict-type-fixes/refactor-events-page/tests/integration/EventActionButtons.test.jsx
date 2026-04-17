/**
 * @file Integration Test for EventActionButtons Component
 * @description
 * Verifies that the EventActionButtons component renders correctly based on user state and event status.
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. Use `@testing-library/react` for components.
 * 3. Use `user-event` for interactions.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 * 6. AAA Pattern (Arrange, Act, Assert) is mandatory.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
// Note: We are testing a component that doesn't exist yet (TDD), so the import will fail if we ran it now.
// But we write the test assuming it will be at this path.
import EventActionButtons from '@/components/EventActionButtons';

/**
 * @typedef {object} EventData
 * @property {string} id
 * @property {string} hostUid
 * @property {string} hostName
 * @property {number} maxParticipants
 * @property {string[]} participants
 * @property {number} [participantsCount]
 * @property {string} title
 * @property {string} time
 * @property {string} registrationDeadline
 * @property {string} city
 * @property {string} district
 * @property {string} meetPlace
 * @property {number} distanceKm
 * @property {number} paceSec
 */

/**
 * @typedef {object} User
 * @property {string} uid
 */

describe('Integration: EventActionButtons', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render "Join Event" button when user is logged in, not host, not joined, and event not full', async () => {
    // Arrange
    const user = userEvent.setup();
    /** @type {import('vitest').Mock} */
    const mockOnJoin = vi.fn();
    /** @type {import('vitest').Mock} */
    const mockOnLeave = vi.fn();

    /** @type {User} */
    const mockUser = { uid: 'user-123' };

    /** @type {EventData} */
    const mockEvent = {
      id: 'event-1',
      hostUid: 'host-999',
      hostName: 'Test Host',
      maxParticipants: 10,
      participants: ['other-user'],
      participantsCount: 1,
      title: 'Mock Event',
      time: '2026-01-01T10:00',
      registrationDeadline: '2025-12-31T23:59',
      city: '臺北市',
      district: '中正區',
      meetPlace: '公園',
      distanceKm: 5,
      paceSec: 360,
    };

    render(
      <EventActionButtons
        event={mockEvent}
        user={mockUser}
        onJoin={mockOnJoin}
        onLeave={mockOnLeave}
        isPending={false}
        isCreating={false}
        isFormOpen={false}
        myJoinedEventIds={new Set()}
      />,
    );

    // Act
    const joinButton = screen.getByRole('button', { name: /參加活動/i });

    // Assert
    expect(joinButton).toBeInTheDocument();

    // Interact
    await user.click(joinButton);
    expect(mockOnJoin).toHaveBeenCalledTimes(1);
  });

  it('should render "Leave Event" button when user has joined', async () => {
    // Arrange
    const user = userEvent.setup();
    /** @type {import('vitest').Mock} */
    const mockOnJoin = vi.fn();
    /** @type {import('vitest').Mock} */
    const mockOnLeave = vi.fn();

    /** @type {User} */
    const mockUser = { uid: 'user-123' };

    /** @type {EventData} */
    const mockEvent = {
      id: 'event-1',
      hostUid: 'host-999',
      hostName: 'Test Host',
      maxParticipants: 10,
      participants: ['user-123', 'other-user'],
      participantsCount: 2,
      title: 'Mock Event',
      time: '2026-01-01T10:00',
      registrationDeadline: '2025-12-31T23:59',
      city: '臺北市',
      district: '中正區',
      meetPlace: '公園',
      distanceKm: 5,
      paceSec: 360,
    };

    render(
      <EventActionButtons
        event={mockEvent}
        user={mockUser}
        onJoin={mockOnJoin}
        onLeave={mockOnLeave}
        isPending={false}
        isCreating={false}
        isFormOpen={false}
        myJoinedEventIds={new Set(['event-1'])}
      />,
    );

    // Act
    const leaveButton = screen.getByRole('button', { name: /退出活動/i });

    // Assert
    expect(leaveButton).toBeInTheDocument();

    // Interact
    await user.click(leaveButton);
    expect(mockOnLeave).toHaveBeenCalledTimes(1);
  });

  it('should render "Full" text when event is full and user not joined', () => {
    // Arrange
    /** @type {User} */
    const mockUser = { uid: 'user-123' };

    /** @type {EventData} */
    const mockEvent = {
      id: 'event-1',
      hostUid: 'host-999',
      hostName: 'Test Host',
      maxParticipants: 1,
      participants: ['other-user'],
      participantsCount: 1,
      title: 'Mock Event',
      time: '2026-01-01T10:00',
      registrationDeadline: '2025-12-31T23:59',
      city: '臺北市',
      district: '中正區',
      meetPlace: '公園',
      distanceKm: 5,
      paceSec: 360,
    };

    render(
      <EventActionButtons
        event={mockEvent}
        user={mockUser}
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        isPending={false}
        isCreating={false}
        isFormOpen={false}
        myJoinedEventIds={new Set()}
      />,
    );

    // Act & Assert
    expect(screen.getByText(/已額滿/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /參加活動/i })).not.toBeInTheDocument();
  });

  it('should NOT render Join/Leave buttons if user is the host', () => {
    // Arrange
    /** @type {User} */
    const mockUser = { uid: 'host-999' };

    /** @type {EventData} */
    const mockEvent = {
      id: 'event-1',
      hostUid: 'host-999',
      hostName: 'Test Host',
      maxParticipants: 10,
      participants: [],
      participantsCount: 0,
      title: 'Mock Event',
      time: '2026-01-01T10:00',
      registrationDeadline: '2025-12-31T23:59',
      city: '臺北市',
      district: '中正區',
      meetPlace: '公園',
      distanceKm: 5,
      paceSec: 360,
    };

    render(
      <EventActionButtons
        event={mockEvent}
        user={mockUser}
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        isPending={false}
        isCreating={false}
        isFormOpen={false}
        myJoinedEventIds={new Set()}
      />,
    );

    // Act & Assert
    expect(screen.queryByRole('button', { name: /join event/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /leave event/i })).not.toBeInTheDocument();
  });

  it('should be disabled when operation is pending', () => {
    // Arrange
    /** @type {User} */
    const mockUser = { uid: 'user-123' };

    /** @type {EventData} */
    const mockEvent = {
      id: 'event-1',
      hostUid: 'host-999',
      hostName: 'Test Host',
      maxParticipants: 10,
      participants: [],
      participantsCount: 0,
      title: 'Mock Event',
      time: '2026-01-01T10:00',
      registrationDeadline: '2025-12-31T23:59',
      city: '臺北市',
      district: '中正區',
      meetPlace: '公園',
      distanceKm: 5,
      paceSec: 360,
    };

    render(
      <EventActionButtons
        event={mockEvent}
        user={mockUser}
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        isPending
        isCreating={false}
        isFormOpen={false}
        myJoinedEventIds={new Set()}
      />,
    );

    // Act
    const joinButton = screen.getByRole('button', { name: /參加活動/i });

    // Assert
    expect(joinButton).toBeDisabled();
  });

  it('should NOT render Join/Leave buttons if user is NOT logged in', () => {
    // Arrange
    /** @type {EventData} */
    const mockEvent = {
      id: 'event-1',
      hostUid: 'host-999',
      hostName: 'Test Host',
      maxParticipants: 10,
      participants: [],
      participantsCount: 0,
      title: 'Mock Event',
      time: '2026-01-01T10:00',
      registrationDeadline: '2025-12-31T23:59',
      city: '臺北市',
      district: '中正區',
      meetPlace: '公園',
      distanceKm: 5,
      paceSec: 360,
    };

    render(
      <EventActionButtons
        event={mockEvent}
        user={null} // Not logged in
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        isPending={false}
        isCreating={false}
        isFormOpen={false}
        myJoinedEventIds={new Set()}
      />,
    );

    // Act & Assert
    expect(screen.queryByRole('button', { name: /參加活動/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /退出活動/i })).not.toBeInTheDocument();
    expect(screen.getByText(/登入/i)).toBeInTheDocument();
  });
});
