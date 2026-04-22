# 021 Layered Dependency Architecture Handoff

> 這份文件是後續所有新 session 的唯一交接簿。任何 session 開始前先讀這份，結束前必更新這份。

## Session Protocol

1. 讀 `plan.md`、`tasks.md`、本檔。
2. 從 `tasks.md` 挑一個且只做一個尚未完成的 session task。
3. 指派 worker 與 reviewer，同步告知：
   - task goal
   - write scope
   - reviewer checklist
   - 驗證標準
4. reviewer 在施工中即時糾偏。
5. 主 agent 最後整合、審核、更新本檔、commit。

## Global Invariants

- 終態分層：`Types -> Config -> Repo -> Service -> Runtime -> UI`
- `Providers` 正式屬於 `Runtime.Provider`
- `dependency-cruiser` 首次正式接線就要 `0 violation`
- 不使用 baseline、grandfathered violations、或先排除舊檔
- `specs/**/tests` 必須拆成 `unit / integration / e2e / specs-test-utils`
- production code 不得 import `specs/**`
- `src/app/**` 最終只保留 Next entry files

## Current State

**Current Session**: S001 completed  
**Next Recommended Session**: S002  
**Current Branch**: `021-layered-dependency-architecture`

**What exists now**

- repo 尚未安裝 `dependency-cruiser`
- repo 尚未建立六層實體目錄
- 目前 enforcement 仍主要靠 ESLint 的局部結構限制
- 本目錄的三份文件已建立，可供後續低 context 接手

## Session Queue Snapshot

> completion 真相來源以 `tasks.md` checkbox 為準；本表是方便新 session 快速閱讀的鏡像摘要。

| Session | Status | Goal |
| --- | --- | --- |
| S001 | done | docs bootstrap |
| S002 | todo | foundation leaf extraction + remove `firestore-types` |
| S003 | todo | split `firebase-admin` + Strava server flow |
| S004 | todo | split `firebase-profile-server` |
| S005 | todo | repo/service extraction A |
| S006 | todo | repo/service extraction B |
| S007 | todo | weather/storage mixed runtime split |
| S008 | todo | formalize providers |
| S009 | todo | formalize runtime hooks |
| S010 | todo | split `events/page.jsx` |
| S011 | todo | split `eventDetailClient.jsx` |
| S012 | todo | split `PostDetailClient.jsx` |
| S013 | todo | split weather/dashboard UI-runtime mixed files |
| S014 | todo | tests four-bucket rules |
| S015 | todo | clean the 4 real test conflicts |
| S016 | todo | add dep-cruise package/config/scripts |
| S017 | todo | CI wiring + final 0-violation verification |

## Known Pitfalls

### Architecture blockers

1. `src/lib/firestore-types.js` 是 value re-export leak，不能留下。
2. `src/lib/firebase-admin.js` 同時是 config + repo + use-case。
3. `src/lib/firebase-profile-server.js` 是 server-only adapter，但尚未被正式建模。
4. `src/lib/weather-helpers.js` 混 service / runtime / constants / persistence。
5. `src/lib/firebase-storage-helpers.js` 混 browser runtime 與 storage repo。
6. `src/contexts/AuthContext.jsx`、`NotificationContext.jsx` 直接依賴 repo，provider 邊界未立起來。
7. `src/app/events/page.jsx`、`eventDetailClient.jsx`、`PostDetailClient.jsx`、`components/weather/WeatherPage.jsx` 都是多層混檔。

### Test blockers

tests 不可整包排除。已知真衝突 unit 檔：

- `specs/009-global-toast/tests/unit/toast-context.test.jsx`
- `specs/010-responsive-navbar/tests/unit/isActivePath.test.js`
- `specs/019-posts-ui-refactor/tests/unit/PostCard.test.jsx`
- `specs/019-posts-ui-refactor/tests/unit/PostCardSkeleton.test.jsx`

不應被當作 production-bound 覆蓋證據的測試：

- `specs/003-strict-type-fixes/lib-firebase-events/tests/integration/placeholder.test.jsx`
- `specs/014-notification-system/tests/integration/scroll-to-comment.test.jsx`

## Reviewer Checklist Template

每個 session 的 reviewer 至少檢查：

1. 實作是否真的限制在本 session 的 write scope。
2. 是否符合六層與 role 規則，而不是只做目錄搬移。
3. 是否把 `Providers` 正式當成 runtime 邊界。
4. 是否避免用 baseline / 排除 / 例外白名單掩蓋舊問題。
5. 是否把新發現的坑、決策、殘留風險記錄到本檔。
6. 是否有最小必要驗證證據。

## Session Log

### S001

- **Goal**: 建立 Session 追蹤與交接機制，讓後續新 session 可低 context 接手。
- **Write Scope**: `specs/021-layered-dependency-architecture/**`
- **Completed**: yes
- **Evidence**:
  - created `plan.md`
  - created `tasks.md`
  - created `handoff.md`
- **Pitfalls recorded**:
  - 不可把目前的 `src/lib` / `src/app` 命名直接視為層級真相
  - `dependency-cruiser` 未接線前，不可假設 resolved graph 已被驗證
  - tests bucket 規則要一起設計，不能等最後才補
- **Next Session Brief**:
  - 做 S002
  - write scope 以 `src/types/**`、`src/config/**`、受影響 import callers、`specs/021-layered-dependency-architecture/handoff.md` 為主
  - 必須完成 `src/lib/firestore-types.js` 移除與替代方案
  - reviewer 要特別盯 value/type leak 是否真的消失

## Next Session Brief

### S002: Foundation Leaf Extraction

**Goal**

- 建立 `src/types/**` 與 `src/config/**` 的第一批實體結構
- 搬 `weather-types`、`firebase-client`、geo cache、location data
- 移除 `src/lib/firestore-types.js`
- 修正受影響 import 與 JSDoc

**Write Scope**

- `src/types/**`
- `src/config/**`
- 所有直接依賴 `src/lib/firestore-types.js`、`firebase-client.js`、`weather-types.js`、`weather-geo-cache.js`、`taiwan-locations.js` 的 callers
- `specs/021-layered-dependency-architecture/handoff.md`

**Acceptance**

- `src/lib/firestore-types.js` 不存在
- 所有原先 callers 改用正確 type-only JSDoc 或新 config/types 路徑
- 沒有新增 runtime 依賴回邊
- `npm run type-check:changed` 與 `npm run lint:changed` 通過

**Reviewer focus**

- `firestore-types` 的 value leak 是否真的消失
- `firebase-client` 是否被正確視為 `config`，而不是繼續當 service/repo
- 是否只改動本 session 的 write scope
