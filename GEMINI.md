## Gemini Added Memories
- The user prefers responses in Taiwan Traditional Chinese. I should also provide important context before explaining implementation details and the reasoning behind each step.
- DO NOT GIVE ME HIGH LEVEL SHIT, IF I ASK FOR FIX OR EXPLANATION, I WANT ACTUAL CODE OR EXPLANATION!!! I DON'T WANT "Here's how you can blablabla"
- Be casual unless otherwise specified
- Be terse
- Suggest solutions that I didn't think about—anticipate my needs
- Treat me as an expert
- Be accurate and thorough
- Give the answer immediately. Provide detailed explanations and restate my query in your own words if necessary after giving the answer
- Value good arguments over authorities, the source is irrelevant
- Consider new technologies and contrarian ideas, not just the conventional wisdom
- You may use high levels of speculation or prediction, just flag it for me
- No moral lectures
- Discuss safety only when it's crucial and non-obvious
- If your content policy is an issue, provide the closest acceptable response and explain the content policy issue afterward
- Cite sources whenever possible at the end, not inline
- No need to mention your knowledge cutoff
- No need to disclose you're an AI
- Please respect my prettier preferences when you provide code.
- Split into multiple responses if one response isn't enough to answer the question.
If I ask for adjustments to code I have provided you, do not repeat all of my code unnecessarily. Instead try to keep the answer brief by giving just a couple lines before/after any changes you make. Multiple code blocks are ok.
- User preferred model is gemini-3-pro-preview.
- When information is uncertain or unverifiable, reply “無法回答” and avoid speculation. Prefer verifying via web search first; if still uncertain, say “無法回答.”. This rule is strictly non-negotiable.
- Attach sources for claims whenever possible. Provide citations with links and, when allowed, include short verbatim excerpts to enable verification. If a claim is purely mathematical/code-derived or from general knowledge with no external source, state that explicitly. This rule is strictly non-negotiable.
- Prefers the assistant to act as a thought debate partner: challenge their assumptions, offer counterpoints, test their logic, present different perspectives, and prioritize seeking truth rather than agreeing with them. This rule is strictly non-negotiable.

## Critical Rules (Non-Negotiable)
- "Before modifying any code in any file, you MUST first obtain my explicit confirmation. DO NOT make decisions or execute changes unilaterally in the middle of a discussion. There are NO exceptions to this rule."

## Current Workflow Status
- **Current Feature**: 001-event-filtering (Event Filtering Feature)
- **Current Phase**: Implementation
- **Next Step**: Pending user instruction (awaiting TDD/Implementation commands).

## Active Technologies
- JavaScript (ES6+) + Next.js 15, React 19, Firebase v9+ (Firestore) (001-event-filtering)
- Firestore (Collection: `events`) (001-event-filtering)

## Recent Changes
- 001-event-filtering: Added JavaScript (ES6+) + Next.js 15, React 19, Firebase v9+ (Firestore)

## Security & Secrets
- **Active Hooks**: This project uses Gemini CLI hooks to enforce security.
    - `block-dangerous-commands`: Prevents destructive commands (rm -rf, git reset --hard, etc.).
    - `notify-permission`: Triggers voice/notification alerts for permission requests.
- **Environment Variables**:
    - **NEVER** commit secrets (API keys, tokens) to Git or `settings.json`.
    - All sensitive tokens (Notion, Firebase API Keys) MUST stay in `.env`.
    - Reference them in `settings.json` using the `$VARIABLE_NAME` syntax.
    - AI MUST NOT create or suggest committing files containing raw secrets.
    - Ensure `.env` is listed in `.gitignore`.

## Available MCP Capabilities
- **Firebase**: Manage Firestore (database), Authentication, Storage, and serverless Functions.
- **GitHub**: Manage repositories, Pull Requests, Issues, and perform code searches.
- **Notion**: Manage knowledge, record logs, and document project details. Use via `notion-memorize` skill or direct MCP tools.
- **Vibe Kanban**: Track tasks and manage project-level tickets (requires `project_id`).
- **Chrome DevTools**: Browser automation for UI verification, screenshots, and performance auditing.

## Tooling & Standards
- **Linter**: ESLint 9 (configured in `eslint.config.mjs`)
- **Style Guide**: Airbnb Base + React Hooks (via `FlatCompat`)
- **Type Checking**: Enabled via `jsconfig.json` (`checkJs: true`) using JSDoc.
    - **Strict JSDoc & Type Safety**: Any new or modified function MUST include complete JSDoc. Strictly FORBIDDEN to claim task completion if `type-check` fails.
    - **Test Quality**: All tests (Unit/Integration/E2E) MUST strictly follow the project **Style Guide (Airbnb Base + React Hooks)** and pass `npm run type-check`, `npm run lint` & ensure no `@ts-ignore` via `grep`.
    - **No @ts-ignore**: Strictly FORBIDDEN. Verification MUST include `grep -r "@ts-ignore" src tests` to ensure a clean codebase. If an external library type issue is unresolvable, you MUST use `@ts-expect-error` with a comment explaining the reason. DO NOT ignore errors silently.
- **Strict Coding Rules (Non-Negotiable)**:
    - **No Logic in JSX**: Strictly FORBIDDEN to write complex logic (IIFE, heavy conditionals) inside JSX. Extract them into separate Components or Helper Functions. JSX should only handle View.
    - **No ESLint Abuse**: Strictly FORBIDDEN to use `eslint-disable` to bypass A11y rules (e.g. `jsx-a11y/click-events-have-key-events`). You MUST fix the underlying HTML structure (add roles, labels, event handlers) instead of silencing the error.
    - **Meaningful JSDoc**: Strictly FORBIDDEN to write empty/boilerplate JSDoc. Documentation MUST explain the *intent* and *params*, not just satisfy the linter.
- **Documentation**: JSDoc required for all exported functions and components
- **E2E**: Playwright (configured in `playwright.config.mjs`, Chromium only)

## Testing Standards (Kent C. Dodds Style)
- **Structure**: `tests/<feature-name>/[unit | integration | e2e]/`
    - `unit/`: Pure logic and service layer testing (e.g., `src/lib/`). No DOM/React.
        - **Logic**: Follow **AAA pattern** (Arrange, Act, Assert) for test structure.
        - **Quality**: Adhere to **F.I.R.S.T principles** (Fast, Independent, Repeatable, Self-Validating, Timely).
    - `integration/`: Component and interaction testing. MUST use **Three Musketeers** (`dom`, `react`, `user-event`).
    - `e2e/`: Full user journey testing using Playwright.
        - **Locators**: Prioritize `page.getByRole`, `page.getByText`. Avoid CSS/XPath selectors.
        - **Stability**: **NO** `page.waitForTimeout()`. Rely on auto-waiting and web-first assertions.
- **Testing Guardrails**: 
    - When writing integration tests, ALWAYS prioritize `userEvent` over direct state manipulation.
    - If a service layer (`src/lib/`) change occurs, corresponding Unit Tests MUST be updated before proceeding to UI.
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

## Key Directories
- `.gemini/`: CLI configuration, settings, and hooks.
- `.gemini/skills/`: Active Agent Skills (use `activate_skill` to load specialized instructions).
- `src/lib/`: Service layer and business logic (Firebase interactions).
- `src/lib/event-helpers.js`: 純邏輯 helper functions（formatPace, buildRoutePayload 等），從 page.jsx 抽出。
- `src/app/`: Next.js App Router pages and layouts.
