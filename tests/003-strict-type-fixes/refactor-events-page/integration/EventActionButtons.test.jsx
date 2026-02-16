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
 * @typedef {Object} EventData
 * @property {string} id
 * @property {string} hostUid
 * @property {number} maxParticipants
 * @property {string[]} participants
 */

/**
 * @typedef {Object} User
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
      maxParticipants: 10,
      participants: ['other-user']
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
      />
    );

    // Act
    const joinButton = screen.getByRole('button', { name: /join event/i });

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
      maxParticipants: 10,
      participants: ['user-123', 'other-user'] // User is in participants
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
      />
    );

    // Act
    const leaveButton = screen.getByRole('button', { name: /leave event/i });

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
      maxParticipants: 1,
      participants: ['other-user'] // 1/1 participants
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
      />
    );

    // Act & Assert
    // Assuming "Full" is rendered as text or a disabled button
    // Adjust selector based on implementation details if needed (e.g., getByText)
    expect(screen.getByText(/full/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /join event/i })).not.toBeInTheDocument();
  });

  it('should NOT render Join/Leave buttons if user is the host', () => {
    // Arrange
    /** @type {User} */
    const mockUser = { uid: 'host-999' };
    
    /** @type {EventData} */
    const mockEvent = {
      id: 'event-1',
      hostUid: 'host-999', // User is host
      maxParticipants: 10,
      participants: []
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
      />
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
      maxParticipants: 10,
      participants: []
    };

    render(
      <EventActionButtons 
        event={mockEvent} 
        user={mockUser} 
        onJoin={vi.fn()} 
        onLeave={vi.fn()}
        isPending={true} // Pending state
        isCreating={false}
        isFormOpen={false}
      />
    );

    // Act
    const joinButton = screen.getByRole('button', { name: /join event/i });

    // Assert
    expect(joinButton).toBeDisabled();
  });
});
