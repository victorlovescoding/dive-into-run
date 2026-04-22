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

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* ==========================================================================
   SECTION 1: UNIT TEST EXAMPLE (Pure Logic)
   Target: src/lib/math-helper.js
   ========================================================================== */

// import { calculateTotal } from '@/lib/math-helper'; // Example import

/**
 * Mock function to simulate a pure logic function.
 * @param {number} a - First operand.
 * @param {number} b - Second operand.
 * @returns {number} Sum of a and b.
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

/**
 * @typedef {object} User
 * @property {string} id - Unique user identifier.
 * @property {string} name - Display name.
 */

/**
 * Mock Component for the example.
 * @param {object} props - Component props.
 * @param {User} props.user - Complex object prop.
 * @param {(id: string) => void} props.onUpdate - Typed callback.
 * @returns {import('react').ReactElement} Rendered component.
 */
function UserProfile({ user, onUpdate }) {
  return (
    <div>
      <h1>{user.name}</h1>
      <button type="button" onClick={() => onUpdate(user.id)}>
        Update
      </button>
    </div>
  );
}

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

/* ==========================================================================
   SECTION 3: MODULE MOCK PATTERN (vi.mock + typed alias)
   When mocking an entire module, TS doesn't know the imports became Mock.
   Create typed aliases IMMEDIATELY after vi.mock() to avoid TS2339.
   ========================================================================== */

// import { fetchItems, addItem } from '@/lib/firebase-items'; // Example import

// vi.mock('@/lib/firebase-items', () => ({
//   fetchItems: vi.fn(),
//   addItem: vi.fn(),
// }));

// /* Cast mocked imports — TS needs Mock type to recognize .mockXxx() */
// const mockedFetchItems = /** @type {import('vitest').Mock} */ (fetchItems);
// const mockedAddItem = /** @type {import('vitest').Mock} */ (addItem);

// describe('Integration: ItemList', () => {
//   it('should render items from mock data', async () => {
//     // Arrange — use mocked alias for .mockXxx()
//     mockedFetchItems.mockResolvedValueOnce({ items: [{ id: '1', name: 'Test' }] });
//
//     render(<ItemList />);
//
//     // Assert
//     await screen.findByText('Test');
//
//     // expect() can use original name — it accepts any
//     expect(fetchItems).toHaveBeenCalledTimes(1);
//   });
// });
