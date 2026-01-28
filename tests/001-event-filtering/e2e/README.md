# E2E Test Goals: Event Filtering UI

**Target Page**: `/events`
**Spec Reference**: `specs/001-event-filtering/spec.md`

## Test Scenarios (GWT)

### 1. Filter Interaction (US1, US4)
- **Given**: User is on the events page.
- **When**: User clicks filter button -> Selects "Taipei" -> Clicks Search.
- **Then**:
    - Filter modal must **close automatically**.
    - Event list must update (visual change).
    - Only Taipei events are shown.

### 2. Auto-Close Behavior (UI-004)
- **Goal**: Verify the modal closes upon clicking Search, regardless of results.

### 3. Clear Functionality (UI-003)
- **Goal**: Verify "Clear" button resets inputs but keeps "Has Seats" checked.
- **Action**: Fill inputs -> Click Clear -> Check state.

### 4. Empty State (UI-007)
- **Goal**: Verify "No matching events" message appears when no results found.
