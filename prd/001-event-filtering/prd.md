# Feature Specification: Event Filtering (MVP)

**Feature Branch**: `feature/filter-events`
**Created**: 2026-01-27
**Status**: Draft
**Input**: User requirement for MVP event filtering mechanism.

## Summary
Provide a lightweight but effective filtering mechanism for the event list, allowing users to find running events based on **Location**, **Time**, **Distance**, and **Seat Availability**. This feature follows the **MVP** principle, avoiding over-engineering (e.g., complex composite indexes) by using a hybrid filtering strategy.

## User Scenarios & Testing (Mandatory)

### User Story 1 - Filter by Location & Time (Priority: P1)
As a runner, I want to find events in my **City/District** that are happening within a specific **Time Range**, so I can plan my schedule.

**Why P1**: Location and Time are the most critical decision factors for joining a physical event.
**Independent Test**:
- Mock Firestore data with events in Taipei and Kaohsiung, with different dates.
- Verify that querying "Taipei" + "Next Weekend" returns only matching events.

### User Story 2 - Filter by Distance (Priority: P2)
As a runner, I want to filter events by **Distance (km)**, so I can choose a run that matches my training volume (e.g., 5km vs 21km).

**Why P2**: Distance defines the difficulty and target audience of the run.
**Independent Test**:
- Mock a list of events with distances [3km, 5km, 10km, 42km].
- Apply filter "5km - 10km".
- Verify that only 5km and 10km events remain.

### User Story 3 - Filter by Seat Availability (Priority: P3)
As a user, I want to see only events that **Have Seats Remaining**, so I don't waste time checking full events.

**Why P3**: Improves UX by hiding "Sold Out" items.
**Independent Test**:
- Mock events with `remainingSeats: 0` and `remainingSeats: 5`.
- Apply "Has Seats" filter.
- Verify full events are excluded.

## Requirements (Mandatory)

### Functional Requirements
- **FR-001**: System MUST support filtering by **City** (Exact match) and **District** (Exact match).
- **FR-002**: System MUST support filtering by **Event Time Range** (Start Date ~ End Date).
- **FR-003**: System MUST support filtering by **Distance Range** (Min km ~ Max km).
- **FR-004**: System MUST support filtering by **Has Seats Only** (Boolean).
- **FR-005**: The filtering logic MUST be composed in the Service Layer (`src/lib/firebase-events.js`).

### UI Requirements (Scope: `src/app/events/page.js`)
- **UI-001**: The existing filter UI elements for City, District, Time, Distance, and "Has Seats" MUST be connected to the new logic.
- **UI-002**: Unused filter UI elements (Host, RunType, Pace, RegTime, MaxPeople) SHOULD be visually hidden or disabled for this MVP.
- **UI-003**: **Flexible Filtering**: Users can select any combination of filters (single or multiple). Unset filters should be ignored (treated as "All").
- **UI-004**: **Auto-Close**: Upon clicking the "Search" button, the filter overlay MUST automatically close (`isFilterOpen = false`).
- **UI-005**: **Result Update**: The event list on the main page MUST update to show only matching events. If no events match, show an empty state message.
- **UI-006**: **Default State**: The "Has Seats Only" filter MUST be **checked by default** when the user first opens the filter.

## Technical Strategy (Hybrid Filtering)

To avoid Firestore's "single range query" limitation and excessive index creation:

1.  **Stage 1: Firestore Query (Backend/Network)**
    - Apply `where('city', '==', city)`
    - Apply `where('district', '==', district)` (if selected)
    - Apply `where('time', '>=', start)` AND `where('time', '<=', end)`
    - **Sorting**: Maintain chronological order (Event time descending or nearest first).

2.  **Stage 2: In-Memory Filtering (Service Layer)**
    - After fetching Stage 1 results, iterate through the list.
    - **Distance Tolerance**: Apply distance filter with a **±0.5km tolerance** (e.g., a 5.4km event will match a "5km max" filter).
    - Apply `event.remainingSeats > 0` (if checked).

## Success Criteria
- **SC-001**: Querying "Taipei + 5-10km" returns correct results within 1 second (for <1000 total events).
- **SC-002**: Unit tests for `applyFilters` (or equivalent logic) pass with 100% logic coverage.
