# Unit Test Goals: Event Filtering Service

**Target Module**: `src/lib/firebase-events.js`
**Function**: `queryEvents(filters)`

## Test Scenarios

### 1. Single Location Filtering (US4)
- **Goal**: Verify that filtering by `city` only returns events from that city.
- **Input**: `{ city: 'Taichung' }`
- **Expected Outcome**: Result list contains only events where `city === 'Taichung'`.

### 2. Hybrid Filtering: Distance (US2)
- **Goal**: Verify that distance filtering is applied in-memory after fetching from Firestore.
- **Logic Check**: Must support **±0.5km tolerance**.
- **Input**: `{ minDistance: 5, maxDistance: 10 }`
- **Expected Outcome**:
    - 5.0km event -> Keep
    - 5.4km event -> Keep (within tolerance)
    - 10.5km event -> Keep (within tolerance)
    - 3.0km event -> Exclude

### 3. Seat Availability (US3)
- **Goal**: Verify that "Has Seats Only" filter excludes full events.
- **Input**: `{ hasSeatsOnly: true }`
- **Expected Outcome**: Events with `remainingSeats <= 0` are excluded.

### 4. Edge Cases (EC)
- **Goal**: Verify robustness against invalid inputs.
- **Scenarios**:
    - Empty filter object -> Should return all (default behavior) or throw error (depending on design).
    - Invalid distance numbers (negative) -> Should handle gracefully.
