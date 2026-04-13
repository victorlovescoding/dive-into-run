# Code Review — 013-pre-run-weather

日期：2026-04-13 (Round 2 — post-fix re-review)

---

## Taste Rating

🟢 **Good taste** — Clean architecture, proper service layer isolation, pragmatic CWA API normalization. Previous critical issues all resolved.

---

## Verification Results

| Check                                           | Result                      |
| ----------------------------------------------- | --------------------------- |
| `npx vitest run specs/013-pre-run-weather/`     | ✅ 87/87 pass               |
| `@ts-ignore` scan                               | ✅ none found               |
| `eslint-disable` in src/ (excl. weather-api.js) | ✅ none found               |
| `npm run type-check` (full)                     | ⚠️ 2 new issues (see below) |
| `npm run lint` (full)                           | ⚠️ 2 warnings (see below)   |

---

## Previous Issues — Resolution Status

| #            | Issue                                                           | Status                                                                           |
| ------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Critical 1   | `eslint-disable react-hooks/exhaustive-deps` in WeatherPage     | ✅ **Fixed** — removed, `restoreLocation` added to deps                          |
| Critical 2   | Dynamic `import()` of `removeFavorite`                          | ✅ **Fixed** — changed to static import                                          |
| Should-fix 1 | `eslint-disable import/prefer-default-export` in weather-api.js | ✅ **Addressed** — kept but reasoned (changing to default breaks 4 import sites) |
| Should-fix 2 | Magic number `humidity: 70`                                     | ✅ **Fixed** — `COUNTY_DEFAULT_HUMIDITY` constant with JSDoc                     |
| Should-fix 3 | FavoritesBar inline styles                                      | ✅ **Fixed** — extracted to `.chipSelectButton` CSS class                        |

---

## [NEW ISSUES] Found in Round 2

**1. [src/lib/firebase-weather-favorites.js, L76] Type error: spread loses type info**

```js
return snapshot.docs.map((d) => ({
  id: d.id,
  ...d.data(), // d.data() returns DocumentData → type info lost
}));
```

`d.data()` returns Firestore `DocumentData` (`{ [field: string]: any }`), so the spread doesn't carry the declared return type. Fix with cast:

```js
return snapshot.docs.map(
  (d) =>
    /** @type {{ id: string, countyCode: string, countyName: string, townshipCode: string | null, townshipName: string | null, displaySuffix: string | null, createdAt: import('firebase/firestore').Timestamp }} */ ({
      id: d.id,
      ...d.data(),
    }),
);
```

**Severity**: Low — doesn't affect runtime, only type-check strictness. This is a known Firestore SDK ergonomic issue.

**2. [src/lib/firebase-weather-favorites.js, L69, L87] Missing `@returns` description**

```
69:1  Warning: Missing JSDoc @returns description.  jsdoc/require-returns-description
87:1  Warning: Missing JSDoc @returns description.  jsdoc/require-returns-description
```

`getFavorites` and `isFavorited` have `@returns` type but no description text. Add descriptions:

```js
// L69
@returns {Promise<Array<...>>} 收藏地點陣列（含 Firestore doc ID）。

// L87
@returns {Promise<{favorited: boolean, docId: string | null}>} 收藏狀態與文件 ID。
```

---

## [TESTING ASSESSMENT]

87 tests across 6 files:

- **Unit (49)**: weather-helpers (29) + weather-api-route (20) — test real logic (parsing, normalization, formatting), not just mocks
- **Integration (28)**: weather-page (10) + township-drilldown (11) + favorites (7) — test component behavior via user interaction (userEvent + screen queries)
- **Unit favorites (10)**: firebase-weather-favorites — necessarily mock-heavy (Firestore SDK), but asserts on return values and call arguments
- **E2E (5)**: Playwright skeleton with skip-when-no-api-key guard

The integration tests properly exercise component rendering, state transitions, and user flows. The mock-Leaflet approach is pragmatic for jsdom. The unit tests for the API route verify actual normalization logic with realistic CWA response shapes.

---

## [TASK GAPS]

All 33 tasks marked `[x]` — all have corresponding code in the diff. No missing implementations. No scope creep.

---

## VERDICT

✅ **Worth merging** — Architecture is sound, all previous critical issues resolved. Two minor lint/type issues remain (`@returns` descriptions + Firestore spread type) — these are trivially fixable but don't block merge.

---

## KEY INSIGHT

The service layer boundary is the strongest design decision here. CWA's inconsistent API (different casing for `locationName` vs `LocationName`, different response structures for F-C0032 vs F-D0047) is fully contained in `route.js`. The UI layer sees a clean, uniform `WeatherInfo` shape. This is textbook "good taste" — one normalization layer shields every consumer from upstream chaos.
