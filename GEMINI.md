
## Active Technologies
- JavaScript (ES6+) + Next.js 15, React 19, Firebase v9+ (Firestore) (001-event-filtering)
- Firestore (Collection: `events`) (001-event-filtering)

## Recent Changes
- 001-event-filtering: Added JavaScript (ES6+) + Next.js 15, React 19, Firebase v9+ (Firestore)

## Tooling & Standards
- **Linter**: ESLint 9 (configured in `eslint.config.mjs`)
- **Style Guide**: Airbnb Base + React Hooks (via `FlatCompat`)
- **Type Checking**: Enabled via `jsconfig.json` (`checkJs: true`) using JSDoc
- **Documentation**: JSDoc required for all exported functions and components

## Testing Standards (Kent C. Dodds Style)
- **Structure**: `tests/<feature-name>/[unit | integration | e2e]/`
    - `unit/`: Pure logic and service layer testing (e.g., `src/lib/`). No DOM/React.
        - **Logic**: Follow **AAA pattern** (Arrange, Act, Assert) for test structure.
        - **Quality**: Adhere to **F.I.R.S.T principles** (Fast, Independent, Repeatable, Self-Validating, Timely).
    - `integration/`: Component and interaction testing. MUST use **Three Musketeers** (`dom`, `react`, `user-event`).
    - `e2e/`: Full user journey testing using Playwright.
        - **Locators**: Prioritize `page.getByRole`, `page.getByText`. Avoid CSS/XPath selectors.
        - **Stability**: **NO** `page.waitForTimeout()`. Rely on auto-waiting and web-first assertions.
- **Philosophy**: Test how the user uses your software. Avoid testing implementation details.
- **Queries**: Prioritize `screen.getByRole` (accessibility-first). Avoid `container.querySelector`.
- **Interactions**: MUST use `@testing-library/user-event` (`userEvent.setup()`). **DO NOT** use `fireEvent`.
- **Assertions**: Use `@testing-library/jest-dom` matchers (e.g., `toBeInTheDocument`, `toHaveTextContent`).

## Testing Strategy & Proportion (Testing Trophy)
- **Distribution**: We follow the **Testing Trophy** (by Kent C. Dodds).
    - **Integration (60%)**: Focus on component behavior and service integration.
    - **Unit (20%)**: Focus on critical business logic and helpers.
    - **E2E (20%)**: Focus on critical user journeys (Happy Paths).
- **Mocking Guidelines (Unit Tests)**:
    - **Isolation**: Unit tests MUST be 100% isolated. No real Firebase or Emulators.
    - **Firestore**: Use `vi.mock('firebase/firestore')` with factory mocks.
    - **Data**: Mock return values should match the actual schema definitions.
- **Mocking Guidelines (Integration/E2E)**:
    - **Service Layer**: Prefer mocking the service layer (`src/lib/`) for fast integration tests.
    - **Emulator**: Use Firebase Emulators only for E2E or complex integration scenarios.
