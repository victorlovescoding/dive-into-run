# Testing Handbook

> Last-Verified: 2026-05-11
> **用途**：測試撰寫的規範、範例與決策依據查找。配合 TDD skill 使用。
> **範圍**：Unit / Integration / E2E 三層級；含本 repo 獨家 pattern。
> **前提**：已熟讀 `.codex/rules/coding-rules.md` 與 `.codex/rules/code-style.md`。

---

## 1. 導讀與 routing

本 handbook 是**查找型 reference**，不取代 repo-specific `test-driven-development` skill，也不應在每次測試或 bugfix 時整份展開 550+ 行。下一節 `Current Blocking Rules` 是必讀摘要；其餘章節只按任務類型載入。

| 情境                             | 讀什麼                                                   |
| -------------------------------- | -------------------------------------------------------- |
| 要寫新的測試（從 RED 開始）      | 執行 `.agents/skills/test-driven-development` skill（repo-specific 5 步驟流程） |
| 只需要避免 commit/CI blocker     | 只讀 `Current Blocking Rules`                            |
| Unit test / pure logic           | 讀 `4. Unit Tests 指南`                                  |
| Integration / React interaction  | 讀 `5. Integration Tests 指南`                           |
| E2E / Playwright                 | 讀 `6. E2E Tests 指南`                                   |
| Server Vitest / Firebase Emulator server test | 讀 `.agents/skills/test-driven-development` 的 `Server Tests`、`11.5 Firebase Emulator + Vitest server checklist`、`12. 快速查找表` |
| Test helper placement            | 讀 `8. Fixture / Test Data`、`12. 快速查找表`             |
| 想看 mock / JSDoc 的**語法細節** | 讀 `.agents/skills/test-driven-development/references/coding-style.md`、`jsdoc-cheatsheet.md` |
| 想照抄**測試檔結構**             | 讀 `.agents/skills/test-driven-development/references/boilerplate.js` |
| 想知道**反模式**詳細案例         | 讀 `.agents/skills/test-driven-development/references/testing-anti-patterns.md` |

Skill 是**流程**（做什麼、照什麼順序），handbook 是**字典**（怎麼做、為何如此）。Superpowers generic TDD 可作通用方法論，但不能取代本 repo 的 `.agents/skills/test-driven-development` 與其 reference docs。

---

## Current Blocking Rules（commit blockers）

這些不是風格建議，是目前會被 commit gate 或 CI 擋下的測試規則。寫測試前先確認：

- **Mock boundary**：mock Firebase SDK、第三方 SDK、browser API、external fetch/network 等外部邊界；不要 `vi.mock()` repo 內部 layer：`@/lib/**`、`@/repo/**`、`@/service/**`、`@/runtime/**`。例外只限明確允許的 React provider boundary，例如 `@/runtime/providers/**`；若真的 mock 內部 layer，必須有不 mock 它的 self-test / matrix，否則會形成 coverage black hole。機械 gate：`scripts/audit-mock-boundary.sh`。
- **Flaky patterns**：避免 exact call-count / call-order assertions，除非次數或順序本身是真正行為合約；尤其不要新增 `expect(...).toHaveBeenCalledTimes(...)`、fixed sleep、`await new Promise((resolve) => setTimeout(resolve, N))`、`page.waitForTimeout(...)`。改用 behavior/payload assertion、單一條件 `waitFor`、`findBy*`、Playwright web-first assertions 或 fake timers。機械 gate：`scripts/audit-flaky-patterns.sh`。
- **Test bucket imports**：不同測試 bucket 可 import 的 `src/**` surface 不同；不要憑感覺跨 layer import。目前規則先讀 `.codex/references/quality-gates.md` 的 Test Bucket Rules；可執行政策仍暫時放在 legacy implementation location `specs/021-layered-dependency-architecture/test-buckets/policy.js`，直到遷移到非 `specs/**` 位置。

---

## 2. Testing Trophy（Kent C. Dodds）

| 層級        | 比例 | 目標                                          | 工具                                 |
| ----------- | ---- | --------------------------------------------- | ------------------------------------ |
| Integration | 60%  | UI + 使用者互動（最高 ROI）                   | Vitest + Testing Library + userEvent |
| Unit        | 20%  | `src/service/**` 純商業邏輯與 DOM-free helper | Vitest（jsdom）                      |
| E2E         | 20%  | Critical user journeys                        | Playwright（Chromium）               |

**為何 integration 居首**：

- 對 refactor 不敏感（測行為不測實作）
- 對 a11y 友善（`getByRole` 強制語義化 HTML）
- 執行速度與覆蓋率平衡（比 unit 慢、比 E2E 快）

Unit 只給**純邏輯**用（沒有 DOM），E2E 只給**關鍵流程**用（登入、發表文章、通知流）。猶豫時先寫 integration。

---

## 3. 目錄與檔案慣例

```
tests/
├── unit/                            # *.test.js / *.test.jsx（依 layer/domain 分組）
├── integration/                     # *.test.jsx（依 domain 分組）
├── e2e/                             # *.spec.js
├── _helpers/                        # 共用 test helper
└── test-results/                    # 測試輸出 artifacts

specs/
└── <feature>/                       # 規格與 planning artifacts，不再放 executable tests
    ├── spec.md
    ├── plan.md
    └── data-model.md                # 選用
```

- `specs/<feature>/` 是 planning artifact 目錄命名；不要用它推論 E2E command routing。
- E2E 檔名用 `.spec.js`、Vitest 用 `.test.js` — vitest.config.mjs 已把 `**/e2e/**` 排除
- Unit test 放 `tests/unit/<layer>/X.test.js(x)`；integration test 放 `tests/integration/<domain>/X.test.jsx`
- E2E test 放 `tests/e2e/<file>.spec.js`
- 共用 helper 放 `tests/_helpers/`
- Integration domain 對應參考：notification 系列 → `tests/integration/notifications/`、feed/post → `tests/integration/posts/`、event → `tests/integration/events/`、auth → `tests/integration/auth/`

---

## 4. Unit Tests 指南

**Target**：以 `src/service/**` 的純函式、驗證/轉換邏輯為主；`src/lib/**` 僅在需要驗證 compatibility facade 契約時補測。禁 DOM、禁 Testing Library。

### AAA Pattern

```js
it('should return the correct sum', () => {
  // Arrange
  const a = 10;
  const b = 5;

  // Act
  const result = calculateTotal(a, b);

  // Assert
  expect(result).toBe(15);
});
```

### F.I.R.S.T

| 字母 | 意義                      | 實踐                                 |
| ---- | ------------------------- | ------------------------------------ |
| F    | Fast（快）                | < 100ms/test。避免 I/O               |
| I    | Independent（獨立）       | `beforeEach` 用 `vi.clearAllMocks()` |
| R    | Repeatable（可重現）      | `vi.useFakeTimers()` 鎖住時間        |
| S    | Self-validating（自驗證） | `expect()` 斷言，不靠肉眼            |
| T    | Timely（及時）            | RED 先於 production code             |

### vi.mock + typed alias

語法細節見 `.agents/skills/test-driven-development/references/coding-style.md`。一句話規則：`vi.mock()` 後**立刻**為每個被 mock 的 function 建 `/** @type {import('vitest').Mock} */` alias，否則 `.mockResolvedValueOnce` 會觸發 TS2339。

### 實際範例

來源：`tests/unit/service/firebase-auth-helpers.test.js`

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithPopup, signOut } from 'firebase/auth';
import { signInWithGoogle, signOutUser } from '@/lib/firebase-auth-helpers';
import { auth, provider } from '@/config/client/firebase-client';

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

const mockedSignInWithPopup = /** @type {import('vitest').Mock} */ (signInWithPopup);
const mockedSignOut = /** @type {import('vitest').Mock} */ (signOut);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('signInWithGoogle', () => {
  it('should call signInWithPopup with auth and provider', async () => {
    // Arrange
    const fakeCredential = { user: { uid: '123' } };
    mockedSignInWithPopup.mockResolvedValue(fakeCredential);

    // Act
    const result = await signInWithGoogle();

    // Assert
    expect(mockedSignInWithPopup).toHaveBeenCalledOnce();
    expect(mockedSignInWithPopup).toHaveBeenCalledWith(auth, provider);
    expect(result).toBe(fakeCredential);
  });
});
```

---

## 5. Integration Tests 指南

**Target**：UI 元件的渲染 + 使用者互動 + state 變化。**禁止** `fireEvent`。
**檔案位置**：新增測試一律放 `tests/integration/<domain>/X.test.jsx`（例：`tests/integration/notifications/`、`tests/integration/posts/`）。

### Testing Library 三劍客

```js
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom'; // for toBeInTheDocument etc.
```

### 為何禁 `fireEvent`

| 項目     | `fireEvent`          | `userEvent`                             |
| -------- | -------------------- | --------------------------------------- |
| 事件模擬 | 單一 DOM event       | 完整使用者序列（focus、keydown、click） |
| a11y     | 不觸發無障礙相關事件 | 觸發 — 測試自然涵蓋 a11y                |
| Async    | 同步                 | async — 貼近真實                        |

```jsx
// ❌ BAD — 舊寫法
fireEvent.click(button);

// ✅ GOOD
const user = userEvent.setup();
await user.click(button);
```

### 查詢優先序

`getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByTestId`。**禁用** `container.querySelector`（違反 `.codex/rules/coding-rules.md` 禁令清單）。

```jsx
// ❌ BAD
const btn = container.querySelector('.submit-btn');

// ✅ GOOD
const btn = screen.getByRole('button', { name: /送出/i });
```

### Provider 包裹：renderWithProviders 模式

來源：`tests/integration/notifications/NotificationBell.test.jsx`

```jsx
function renderWithProviders(ui, { user = null } = {}) {
  return render(
    <AuthContext.Provider value={{ user, setUser: () => {}, loading: false }}>
      <NotificationProvider>{ui}</NotificationProvider>
    </AuthContext.Provider>,
  );
}

it('should NOT render when user is null', () => {
  renderWithProviders(<NotificationBell />, { user: null });
  expect(screen.queryByRole('button', { name: /通知/ })).not.toBeInTheDocument();
});
```

### renderHook 測試 Hook

來源：`tests/integration/toast/toast-context.test.jsx`

```jsx
import { renderHook, act } from '@testing-library/react';

const { result } = renderHook(() => useToast(), {
  wrapper: ({ children }) => <ToastProvider>{children}</ToastProvider>,
});

act(() => {
  result.current.showToast('done');
});

expect(result.current.toasts).toHaveLength(1);
```

### `within()` 限縮範圍

頁面同時有多個同名元素（navbar + drawer）時：

```jsx
const nav = screen.getByRole('navigation', { name: '主要導覽' });
const link = within(nav).getByRole('link', { name: '會員頁面' });
```

---

## 6. E2E Tests 指南

**Target**：Critical user journeys。**禁** `page.waitForTimeout()`。

### Locator 優先序

```js
page.getByRole('button', { name: '篩選活動' }); // 最優先
page.getByLabel('選擇縣市');
page.getByText(/沒有符合條件/);
page.locator('[aria-controls="notification-panel"]'); // 最後手段
```

### 禁 `page.waitForTimeout`，用 `await expect()` 自動等待

```js
// ❌ BAD
await page.click(button);
await page.waitForTimeout(2000);
expect(await page.isVisible('.result')).toBe(true);

// ✅ GOOD — Playwright 自動輪詢直到可見或超時
await page.getByRole('button', { name: '搜尋' }).click();
await expect(page.getByText('沒有符合條件的活動')).toBeVisible();
```

明確需要更長 timeout 時用 `{ timeout: 15000 }` 參數，不要用 sleep。

### Async readiness：DOM ready 不等於資料 ready

`page.goto()`、`waitForSelector()`、`loginAsUser(..., { waitForSelector })` 只保證 DOM 或登入流程到某個可見狀態，不保證 `useEffect`、Firestore listener、route mock 或 background fetch 已完成。第一個依賴 async 資料的互動前，先等可觀察 ready signal：

- 資料列表：等已知 title / row / empty state 出現。
- Realtime listener：等 badge、toast container、loading 消失或 marker doc 被 render。
- 需要 emulator seed 後再觸發 UI：先證明 listener initial snapshot 完成，再 seed 增量資料。

### Race Condition：Marker Notification 模式

當 test 依賴 Firebase `onSnapshot` 的**即時推送**（例如 toast 彈出），必須確保 listener 已完成 initial snapshot，否則新 seed 的資料會被當成 initial batch 靜默丟掉。

來源：`tests/e2e/comment-notifications.spec.js` Scenario 4

```js
test.beforeAll(async () => {
  await cleanupEmulator();
  // Seed 一個「1 分鐘前」的 marker，確保登入後 initial snapshot 完成、badge 出現
  await seedDoc('notifications', 'marker', {
    // ...
    createdAt: ts(new Date(Date.now() - 60000).toISOString()),
  });
});

test('登入後新通知產生 → toast 即時出現', async ({ page }) => {
  await loginAsUser(page, EMAIL, PASSWORD, { startPage: '/posts' });
  // 等 badge 出現 → 確認 initial snapshot 完成
  await expect(page.locator('[class*="badge"]')).toBeVisible({ timeout: 15000 });

  // 現在 seed 才會觸發 onSnapshot 的第二次 callback
  await seedDoc('notifications', 'new-one', {
    /* ... */
  });

  // toast 應即時出現
  const toast = page.locator('[role="status"][aria-live="polite"]');
  await expect(toast).toBeVisible({ timeout: 30000 });
});
```

### Serial Mode：何時需要

Firebase Emulator 的 Firestore 狀態是 shared across tests。需要 serial 時機：

- Test A 建立的 doc 被 test B 讀取（狀態依賴）
- 多個 test 共用同一使用者登入 session

```js
test.describe.configure({ mode: 'serial' });
```

### Emulator Helper（`tests/_helpers/e2e-helpers.js`）

| Helper                                              | 用途                                |
| --------------------------------------------------- | ----------------------------------- |
| `cleanupEmulator()`                                 | 清空 Auth + Firestore               |
| `createTestUser(email, password, name)`             | 透過 Auth Emulator REST 建立使用者  |
| `seedDoc(collectionPath, docId, data)`              | 透過 Firestore REST seed document   |
| `ts(isoString)`                                     | ISO 字串 → Firestore Timestamp 格式 |
| `loginAsUser(page, email, password, { startPage })` | Playwright 登入並等待頁面 ready     |
| `signOutUser(page)`                                 | 登出流程                            |

執行：一般 flaky/debug 先用 `bash scripts/run-all-e2e.sh`；只跑目前 changed E2E specs 時用 `npm run test:e2e:branch`。
已有 emulator/dev env 時才用 `E2E_FEATURE=<feature> npm run test:e2e:emulator` 指定 seeded setup。

### E2E Debug SOP

1. 用 `bash scripts/run-all-e2e.sh` 先跑 CI-like reproduction；完整流程過了，才縮到 `npm run test:e2e:branch` 或單檔。`npm run test:e2e:branch` 只收目前 diff/staged/unstaged 的 changed E2E specs；沒有 changed spec 會 skip，遇到 unknown spec 時改跑 run-all。
2. 讀 Playwright error、call log、screenshot、`error-context.md`，先分清 locator 找不到、timeout、資料狀態錯還是真正 assertion fail。
3. 區分症狀與根因：DOM 還在不等於資料沒刪；資料寫入成功不等於 listener 已收到。
4. 一次只改一個變數；不要同時改 seed、locator、timeout。
5. 用資料驗證猜想：Firestore REST 查 state、加暫時 log、看 screenshot。
6. 假設被推翻就立刻換方向，不要把 timeout 拉長當修復。
7. 修完至少重跑兩次；flaky 問題一次 pass 不算證據。

---

## 7. Mock 策略決策樹

| 層級         | 何時用                                          | 位置                 | 範例                                                                 |
| ------------ | ----------------------------------------------- | -------------------- | -------------------------------------------------------------------- |
| **Global**   | 跨所有測試檔案都需要 mock 的瀏覽器 / 第三方 API | `vitest.setup.jsx`   | `ResizeObserver`、`IntersectionObserver`、Leaflet、`firebase-client` |
| **Module**   | 單一測試檔案需 mock 整個 module                 | 檔案頂端 `vi.mock()` | `firebase/firestore`、`next/navigation`                              |
| **Function** | 只 mock 單一 callback prop                      | 測試內部 `vi.fn()`   | `const onUpdate = vi.fn()`                                           |

**規則**：

- 不要重複 mock `vitest.setup.jsx` 已 mock 的東西
- 每個 `vi.mock()` 後**必須**加 typed alias
- Mock typedef 欄位名**必須**對齊 production function 參數（見 `.agents/skills/test-driven-development/references/coding-style.md`）
- Mock repo 內部 layer 會讓真實程式碼完全不執行，coverage 可能顯示 0% 或被 exclude 掩蓋。原則上 mock 外部邊界；若 consumer test 必須 mock 內部 layer，旁邊要有不 mock 該 layer 的 self-test / matrix，直接驗證輸出、state 或 adapter contract。

---

## 8. Fixture / Test Data

### 完整 mock — 避免 Incomplete Mocks 反模式

```js
// ❌ BAD — 下游 code 讀 metadata.requestId 會 undefined
const mockResponse = {
  status: 'success',
  data: { userId: '123' },
};

// ✅ GOOD — 鏡射真實 API 所有欄位
const mockResponse = {
  status: 'success',
  data: { userId: '123', name: 'Alice' },
  metadata: { requestId: 'req-789', timestamp: 1234567890 },
};
```

詳細見 `.agents/skills/test-driven-development/references/testing-anti-patterns.md` Anti-Pattern 4。

### Typedef 對齊生產型別

```js
// Stub 定義：addComment(eventId, { uid, name, photoURL }, content)

// ✅ GOOD — 欄位名對齊
/**
 * @typedef {object} MockUser
 * @property {string} uid
 * @property {string} name
 * @property {string} photoURL
 */
```

### 共用 fixture 放哪

- 單檔案內自用 → 測試檔案頂端
- ≥ 2 個檔案用 → `tests/_helpers/`（例：e2e-helpers.js、mock-helpers.js）

---

## 9. Red Phase 驗證

### Iron Wall — 3 項檢查全綠才能 commit

| 檢查       | 指令                                                                                             | 門檻           |
| ---------- | ------------------------------------------------------------------------------------------------ | -------------- |
| Type Check | `npm run type-check:changed`；branch review 用 `npm run type-check:branch`；全量用 `npm run type-check` 或 `npx tsc --noEmit --project tsconfig.json` | **0 errors**   |
| Lint       | `npm run lint:changed` 或 `npx eslint <test-file>`（可加 `--fix` 自動修）                        | **0 problems** |
| Sanity     | `grep "@ts-ignore" <test-file>`                                                                  | **empty**      |

不要對單一 JS/JSX 檔直接跑 `tsc <file> --allowJs --checkJs`。那種寫法不會完整套用本 repo 的 `tsconfig.json`、`@/` paths 與專案 include/exclude，容易得到假綠或假紅。

### 有效 RED vs 無效失敗

| 症狀                                              | 判定        | 處置                            |
| ------------------------------------------------- | ----------- | ------------------------------- |
| `AssertionError: expected ... got undefined`      | ✅ 有效 RED | 進入 GREEN 寫 production code   |
| `TestingLibraryElementError: Unable to find role` | ✅ 有效 RED | 元件未實作 — 實作後才 pass      |
| `Failed to resolve import "@/lib/xxx"`            | ❌ 無效     | 缺 stub — 回 TDD skill Step 2.7 |
| `ReferenceError: x is not defined`                | ❌ 無效     | 測試寫錯 — 修測試               |
| `TypeError: X is not a function`                  | ❌ 無效     | mock 不完整 — 補 mock           |

**部分 PASS 是正常的**：驗證 throw 的 case 會直接通過（stub 本來就 throw）。重點是**正面斷言 case 必須 fail**。

### Stub 檔案建立時機

在寫測試**之前**（skill Step 2.7）。規則：只有 `export` signature + 完整 JSDoc + `throw new Error('Not implemented')`，**不寫任何邏輯**。

---

## 10. Anti-Patterns 速查表

詳細案例見 `.agents/skills/test-driven-development/references/testing-anti-patterns.md`。

| #   | 反模式                          | 一句話修復                              |
| --- | ------------------------------- | --------------------------------------- |
| 1   | Assert on mock elements         | 不要斷言 `*-mock` testId，測真實 `role` |
| 2   | Test-only methods in production | 抽到 `tests/_helpers/`                  |
| 3   | Mock without understanding      | 先用真實實作觀察，再 mock 最小必要範圍  |
| 4   | Incomplete mocks                | 鏡射真實 API 的**所有**欄位             |
| 5   | Tests as afterthought           | TDD — RED 先於 production code          |

**Red flags**：mock setup > 50% 測試長度、mock 移除測試就掛、無法解釋為何 mock。

---

## 11. 本 repo 常見錯誤（skill 沒寫）

### 11.1 Firebase `onSnapshot` 的 initial load

症狀：toast 該彈不彈，或已存在的資料觸發重複 toast。

原因：`onSnapshot` 第一次 callback 會送**當前所有 docs**（initial snapshot），不應被當成「新事件」。

Pattern：

```js
let isInitialLoad = true;

const unsub = onSnapshot(query, (snap) => {
  if (isInitialLoad) {
    isInitialLoad = false;
    setNotifications(snap.docs.map(/* ... */));
    return;
  }
  // 只有 initial load 之後的 change 才觸發 toast
  snap.docChanges().forEach((change) => {
    if (change.type === 'added') showToast(/* ... */);
  });
});
```

E2E 測這種 flow 時，**必須**用 marker notification（見 §6）確保 initial load 完成。

### 11.2 Firestore `Timestamp.toDate()` 的 mock

Firestore 傳回的時間欄位是 `Timestamp` 物件，不是 `Date`。Mock 時要模擬 `.toDate()`：

```js
// ✅ GOOD
const firestoreTimestamp = {
  toDate: () => new Date('2026-04-14T11:50:00Z'),
};
expect(formatRelativeTime(firestoreTimestamp)).toBe('10 分鐘前');
```

### 11.3 `act()` 何時需要包裹

當測試模擬**外部觸發**的 state 更新（如 `onSnapshot` callback 或 subscription listener），React 會警告 state update 未被 `act()` 包裹：

```jsx
render(<NotificationBell />);

// 模擬 listener callback 被觸發
act(() => {
  unreadCallback?.(fakeNotifications(5));
});

expect(screen.getByText('5')).toBeInTheDocument();
```

`userEvent.click()` 等互動**不需要**手動 `act()`（Testing Library 內建處理）。

### 11.4 E2E 何時需要 serial mode

- 多個 test 共用同一 Firestore doc（例：文章 + 留言順序）
- 測試依賴登入 session 持續性
- 有 initial state seed + 後續 mutation 的因果鏈

預設 parallel（`playwright.config.mjs` 的 `fullyParallel: true`）。需要 serial 時**在 describe 層級**標註：

```js
test.describe.configure({ mode: 'serial' });
```

### 11.5 Firebase Emulator + Vitest server checklist

Server-only 邏輯、Firebase Admin、route/server adapters 放 `tests/server/**`，用 `npm run test:server -- tests/server/<suite>/<name>.test.js`。不要把需要 emulator 的測試塞進 browser/jsdom bucket，也不要把 server project 放進 pre-commit；pre-commit 應維持 browser Vitest + audit gates，server test 由手動指令與 CI 負責。

Checklist：

- `projectId` 對齊 `demo-test`：`firebase emulators:exec --project=demo-test`、server setup env（`GCLOUD_PROJECT` / `FIREBASE_ADMIN_PROJECT_ID`）與 REST endpoint 都要一致。
- Vitest projects：browser project 不寫 `include`、只 exclude server；server project 明確 include `tests/server/**` 並保留 root alias/setup。
- Emulator REST helpers 先 snapshot `const originalFetch = globalThis.fetch;`，cleanup / Auth REST / Firestore REST 都用 `originalFetch`，避免 test case 的 `vi.stubGlobal('fetch', ...)` 汙染下個 `beforeEach`。
- Firestore state 用 REST DELETE 在 `beforeEach` 清；cleanup 要用同一個 `demo-test` project URL。
- Admin SDK emulator init 可先靠 env lazy init；不要預設做 fake service account，除非實測證明需要。
- V8 coverage 的 `lines.total` 是 instrumentable lines，不是 raw file lines；估 coverage 影響時看 `coverage/coverage-summary.json`，不要用檔案行數腦補。

### 11.6 Flaky test gotchas

- Exact call-count / call-order assertions 只在真正合約才用；一般 async flow 改驗 payload、visible state、output 或至少下限條件。`toHaveBeenCalledTimes` 目前會被 flaky audit 擋。
- `waitFor` callback 只等一個條件；不要在裡面塞多個昂貴 DOM query、call-order assertion 或 negative assertion。`findBy*` 能表達「等元素出現」時優先用它。
- Heavy fixture 會被 coverage instrumentation 放大。Pagination 通常用 3-5 筆 + boundary case；真的測大量資料時，放在專門測試並加 local timeout，不要拉大全域 timeout。
- Dense `waitFor` 與 call-order cleanup 仍是 open debt，見 `docs/TECH_DEBT.md` 的 TD-007；不要把文件寫成「都已修完」。

---

## 12. 快速查找表

### 常用指令

| 指令                                                          | 用途                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| `npm run test`                                                | Browser/jsdom Vitest only（unit + integration）；不跑 server project |
| `npm run test:browser`                                        | Browser/jsdom Vitest（unit + integration）                    |
| `npm run test:server`                                         | Server Vitest（Firebase Auth/Firestore emulator wrapper）     |
| `npm run test:coverage`                                       | Coverage（Firebase Auth/Firestore emulator wrapper）          |
| `npm run type-check`                                          | 全 repo TypeScript/JSDoc 檢查（讀 `tsconfig.json`）            |
| `npm run type-check:changed`                                  | 只顯示 changed JS/JSX/MJS 的 type errors                      |
| `npm run type-check:branch`                                   | 只顯示 branch vs `main` changed files 的 type errors          |
| `npm run test:branch`                                         | 僅當前 branch 的 Vitest                                       |
| `npx vitest run tests/unit/service/x.test.js`                 | 單檔 unit                                                     |
| `npx vitest run tests/integration/notifications/x.test.jsx`   | 單檔 integration                                              |
| `bash scripts/run-all-e2e.sh`                                 | CI-like 全 E2E reproduction；debug flaky 時先跑這個            |
| `npm run test:e2e:branch`                                     | 目前 changed E2E specs routing；沒有 changed spec 會 skip，unknown spec 改跑 run-all |
| `E2E_FEATURE=<feature> npm run test:e2e:emulator`             | 已有 emulator/dev env 時，指定 seeded setup 跑 E2E             |
| `firebase emulators:exec --only auth,firestore,storage --project=demo-test "FIREBASE_PROJECT_ID=demo-test GCLOUD_PROJECT=demo-test NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test E2E_FEATURE=<feature> npm run test:e2e:emulator"` | 手動控制 emulator 生命週期；project/env 必須對齊 `demo-test` |

### 關鍵檔案

| 用途             | 路徑                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| TDD skill 入口   | `.agents/skills/test-driven-development/SKILL.md`                            |
| Mock 語法規範    | `.agents/skills/test-driven-development/references/coding-style.md`          |
| JSDoc 進階       | `.agents/skills/test-driven-development/references/jsdoc-cheatsheet.md`      |
| 測試 boilerplate | `.agents/skills/test-driven-development/references/boilerplate.js`           |
| 反模式全集       | `.agents/skills/test-driven-development/references/testing-anti-patterns.md` |
| Vitest 配置      | `vitest.config.mjs`、`vitest.setup.jsx`                                      |
| Playwright 配置  | `playwright.config.mjs`、`playwright.emulator.config.mjs`                    |
| E2E 共用 helper  | `tests/_helpers/e2e-helpers.js`                                              |
| Mock helper      | `tests/_helpers/mock-helpers.js`                                             |

### 常用斷言速查

```js
// Element
expect(el).toBeInTheDocument();
expect(el).toHaveAttribute('aria-expanded', 'true');
expect(el).toHaveClass(/commentHighlight/);
expect(el).toHaveValue('');
expect(el).not.toBeChecked();

// Mock calls
expect(mockFn).toHaveBeenCalledOnce();
expect(mockFn).toHaveBeenCalledWith(expect.objectContaining({ uid: 'x' }));
expect(mockFn).toHaveBeenNthCalledWith(2, expect.objectContaining({ uid: 'x' }));

// Async
await waitFor(() => expect(mockFn).toHaveBeenCalled());
await screen.findByText('載入完成'); // 等同 waitFor + getByText
```
