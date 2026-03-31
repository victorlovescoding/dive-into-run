/**
 * @file Golden Sample for Testing in this project.
 * @description
 * THIS IS THE SOURCE OF TRUTH. COPY THIS STYLE.
 *
 * Rules:
 * 1. Use `vitest` for test runner.
 * 2. Use `@testing-library/react` for components.
 * 3. Use `user-event` for interactions.
 * 4. STRICT JSDoc is required.
 * 5. NO `console.log`.
 * 6. AAA Pattern (Arrange, Act, Assert) is mandatory.
 */

/* ==========================================================================
   SECTION 1: UNIT TEST EXAMPLE (Pure Logic)
   Target: src/lib/math-helper.js
   ========================================================================== */

import { describe, it, expect } from 'vitest';
// import { calculateTotal } from '@/lib/math-helper'; // Example import

/**
 * Mock function to simulate a pure logic function.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
const calculateTotal = (a, b) => a + b;

describe('Unit: calculateTotal', () => {
  it('should return the correct sum of two numbers', () => {
    // Arrange
    const inputA = 10;
    const inputB = 5;
    const expected = 15;

    // Act
    const result = calculateTotal(inputA, inputB);

    // Assert
    expect(result).toBe(expected);
  });

  it('should handle negative numbers correctly', () => {
    // Arrange
    const inputA = -5;
    const inputB = 10;
    const expected = 5;

    // Act
    const result = calculateTotal(inputA, inputB);

    // Assert
    expect(result).toBe(expected);
  });
});

/* ==========================================================================
   SECTION 2: INTEGRATION TEST EXAMPLE (React Component)
   Target: src/components/UserProfile.jsx
   ========================================================================== */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 */

/**
 * Mock Component for the example
 * @param {Object} props
 * @param {User} props.user - Complex object prop
 * @param {(id: string) => void} props.onUpdate - Typed callback
 */
const UserProfile = ({ user, onUpdate }) => (
  <div>
    <h1>{user.name}</h1>
    <button type="button" onClick={() => onUpdate(user.id)}>
      Update
    </button>
  </div>
);

describe('Integration: UserProfile', () => {
  it('should render the user name and handle button click', async () => {
    // Arrange
    const user = userEvent.setup();

    /** @type {import('vitest').Mock} */
    const mockOnUpdate = vi.fn();

    /** @type {User} */
    const mockUser = { id: '123', name: 'John Doe' };

    render(<UserProfile user={mockUser} onUpdate={mockOnUpdate} />);

    // Act
    // Verify initial state strictly using accessible queries
    const heading = screen.getByRole('heading', { name: /john doe/i });
    const button = screen.getByRole('button', { name: /update/i });

    expect(heading).toBeInTheDocument();
    expect(button).toBeInTheDocument();

    // Interact
    await user.click(button);

    // Assert
    expect(mockOnUpdate).toHaveBeenCalledWith('123');
    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
  });
});
