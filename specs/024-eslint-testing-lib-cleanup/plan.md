# 024 — ESLint Testing-Library Sensor + Repo-wide Cleanup

> **Branch**：`024-eslint-testing-lib-cleanup`
> **狀態**：Plan 完稿、待 implementer 接手
> **執行模式**：Path A（一次清光、無 Path B 退路）+ rule 不設 escape hatch

---

## 1. Context（為什麼做這件事）

### 1.1 問題

`CLAUDE.md` + `.claude/rules/coding-rules.md` + `.claude/rules/testing-standards.md` 把以下三條列為 Non-Negotiable，但 `eslint.config.mjs` **完全沒有對應的機械防線**：

| 規範                                                          | 文件位置                               | 現有 ESLint 防線 |
| ------------------------------------------------------------- | -------------------------------------- | ---------------- |
| 禁用 `@ts-ignore`（要 `@ts-expect-error` + 說明）             | `coding-rules.md:10` Non-Negotiable #1 | ❌ 無            |
| 整合測試禁用 `fireEvent`（要用 `userEvent`）                  | `testing-standards.md:23`              | ❌ 無            |
| 測試禁用 `container.querySelector`（要用 `screen.getByRole`） | `testing-standards.md:23`              | ❌ 無            |

所有違規目前只靠 reviewer 自律或人工 grep，pre-commit gate 不會擋 → 隨時間累積，文件規範與 code 現況脫節。

### 1.2 預期成果

1. 三條規範從**文件層級** → **機械層級**（pre-commit gate 自動擋下）
2. 全 repo `npx eslint src specs tests` **0 violation**
3. 後續任何 PR 違反三條規範 → husky pre-commit 直接擋
4. ComposeModal `<dialog>` cancel event + NotificationPanel img error 兩個原本用 `fireEvent` 的「DOM-event-only」case 改用 **native `dispatchEvent`**（不是 `fireEvent` 也不是 `userEvent`），完全合法、無需 inline disable comment

---

## 2. 原則決策（已與用戶確認）

| 議題                                        | 決策                                                                                                                                                                                     | 理由                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `prefer-user-event` 的 `allowedMethods`     | **不設**，rule 直接 `'error'`                                                                                                                                                            | Path A 嚴格度優先，兩個 escape case 改用 native `dispatchEvent` 即可滿足          |
| `no-node-access` 89 處撞牆                  | **不退到 Path B**，撞牆停下 escalate 給用戶                                                                                                                                              | 不允許 `warn` 殘留；撞硬牆時暫停、與用戶討論是否要 component refactor，不自動降級 |
| `ban-ts-comment` `minimumDescriptionLength` | `10` 字元                                                                                                                                                                                | 與 `coding-rules.md` 第 1 條「附說明」一致                                        |
| Worktree                                    | **另開** branch `chore/eslint-sensors-and-testing-library-cleanup` ←本 branch 名 = `024-eslint-testing-lib-cleanup`，worktree branch 名待 implementer 跟用戶確認是否沿用本 branch 或另開 | 不干擾 main 線開發                                                                |
| Commit 拆分                                 | 每 Phase 拆獨立 commit（Phase 4 可再拆 sub-commit）                                                                                                                                      | review 時可按 phase 分段看                                                        |

---

## 3. Audit 結果（執行前快照，供 implementer 對照）

### 3.1 違規總覽（採樣自 `project-health/2026-04-28-eslint-testing-library-cleanup-plan.md`）

> 注意：以下數字是「**安裝 plugin 後** ESLint 會報的 violation 數」，目前 plugin 未裝、所以 `npx eslint tests` 不會看到這些 rule。Implementer 在 Phase 1 安裝 plugin 後**第一件事**就是重跑 `npx eslint src specs tests` 確認實際數字。

```
總計 ~303 errors（plugin 安裝後）

  187  testing-library/prefer-screen-queries
   89  testing-library/no-node-access
   10  testing-library/render-result-naming-convention
    9  testing-library/no-container
    8  testing-library/prefer-user-event   ← grep 實際數字（plan 原 draft 寫 7）
    1  testing-library/no-unnecessary-act

   0   @ts-ignore（grep 確認，純 preventive sensor）
```

### 3.2 `prefer-user-event` 8 處精確分布（grep 結果）

| 檔案                                                         | 行號 | 類型                                         | 處理方式                                              |
| ------------------------------------------------------------ | ---- | -------------------------------------------- | ----------------------------------------------------- |
| `tests/integration/posts/PostCard.test.jsx`                  | 88   | `fireEvent.click(likeButton)`                | 機械改 `await user.click(...)`                        |
| `tests/integration/posts/PostCard.test.jsx`                  | 132  | `fireEvent.click(menuitem 編輯)`             | 機械改                                                |
| `tests/integration/posts/PostCard.test.jsx`                  | 148  | `fireEvent.click(menuitem 刪除)`             | 機械改                                                |
| `tests/integration/posts/PostCard.test.jsx`                  | 183  | `fireEvent.click(查看更多)`                  | 機械改                                                |
| `tests/integration/posts/PostCard.test.jsx`                  | 191  | `fireEvent.click(查看更多)`                  | 機械改                                                |
| `tests/integration/notifications/NotificationToast.test.jsx` | 141  | `fireEvent.click(通知)` + **fake timers**    | 機械改 + `userEvent.setup({ advanceTimers })`         |
| `tests/integration/posts/ComposeModal.test.jsx`              | 126  | `fireEvent(dialog, cancelEvent)` ←自訂 event | **改 native `dialog.dispatchEvent(cancelEvent)`**     |
| `tests/integration/notifications/NotificationPanel.test.jsx` | 267  | `fireEvent.error(img)` ← img error event     | **改 native `img.dispatchEvent(new Event('error'))`** |

### 3.3 `no-node-access` 89 處分布（按 domain 估算，以實際 ESLint 為準）

| Domain                             | 估計違規檔案數 | 已知範例                                                                                                   |
| ---------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------- |
| `tests/integration/profile/`       | 5              | ProfileEventList、ProfileHeader、UserLink、BioEditor                                                       |
| `tests/integration/posts/`         | 4              | PostDetail、PostFeed                                                                                       |
| `tests/integration/notifications/` | 4              | NotificationBell、NotificationPanel、scroll-to-comment、notification-click                                 |
| `tests/integration/navbar/`        | 2              | NavbarDesktop（已知 3 處 `container.querySelector` + 1 處 `avatarBtn.querySelector('svg')`）、NavbarMobile |
| `tests/integration/weather/`       | 2              | weather-page                                                                                               |
| `tests/integration/toast/`         | 2              | crud-toast                                                                                                 |
| `tests/integration/strava/`        | 1              | （待 Phase 4.7 確認）                                                                                      |

---

## 4. ESLint Sensor 設定（具體 config diff）

### 4.1 套件變更

```bash
npm i -D eslint-plugin-testing-library
```

當前可用版本：`^7.16.2`（v7 系列）。`@testing-library/user-event` 已在 devDependencies (`^14.6.1`)，**不用裝**。

### 4.2 `eslint.config.mjs` 修改點（3 處）

#### Change 1：頂部新增 import（接在現有 imports 之後）

```js
// 加在現有 import block 末端（line 16 之後）
import testingLibrary from 'eslint-plugin-testing-library';
```

#### Change 2：第 9 條 type-aware section 加 `ban-ts-comment`（line 242–258）

**改前**（line 254–257）：

```js
plugins: { '@typescript-eslint': tsPlugin },
rules: {
  '@typescript-eslint/no-deprecated': 'error',
},
```

**改後**：

```js
plugins: { '@typescript-eslint': tsPlugin },
rules: {
  '@typescript-eslint/no-deprecated': 'error',
  '@typescript-eslint/ban-ts-comment': [
    'error',
    {
      'ts-ignore': true,                            // 完全禁
      'ts-expect-error': 'allow-with-description',  // 允許但要附說明
      'ts-nocheck': true,
      'ts-check': false,
      minimumDescriptionLength: 10,
    },
  ],
},
```

#### Change 3：第 18 條測試 scope **之前**插入新區塊（line 369 前）

新增「17.5 testing-library 規則」block：

```js
// 17.5 testing-library 規則（Constitution: testing-standards.md）
//      Rationale: integration tests must use userEvent (not fireEvent),
//      query by role/label (not container.querySelector). Mechanical guard
//      so reviewers don't have to enforce manually.
{
  files: ['tests/**/*.{js,jsx,mjs}', '**/*.test.{js,jsx,mjs}', '**/*.spec.{js,jsx,mjs}'],
  ...testingLibrary.configs['flat/react'],
  rules: {
    ...testingLibrary.configs['flat/react'].rules,
    // v7 預設 config 未啟用，手動補
    'testing-library/prefer-user-event': 'error',
  },
},
```

> 為何放第 18 條之前：第 18 條覆寫測試檔的多項 rule（`no-console`、`jsdoc/require-jsdoc` 等）。把 testing-library config 放在它**之前**讓第 18 條能覆寫 testing-library 的衝突項（如 `jsdoc/require-jsdoc` 在 testing-library 預設可能有衝突）。實作後在 Phase 1 sanity check 確認順序正確。

### 4.3 `flat/react` 預設啟用清單（已 verify v7.16.2）

```
await-async-events / await-async-queries / await-async-utils
no-await-sync-events / no-await-sync-queries
no-container / no-debugging-utils (warn) / no-dom-import
no-global-regexp-flag-in-query / no-manual-cleanup / no-node-access
no-promise-in-fire-event / no-render-in-lifecycle / no-unnecessary-act
no-wait-for-multiple-assertions / no-wait-for-side-effects / no-wait-for-snapshot
prefer-find-by / prefer-presence-queries / prefer-query-by-disappearance
prefer-screen-queries / render-result-naming-convention
```

`prefer-user-event` 不在預設清單，本 plan 手動補 `'error'`。

---

## 5. 執行 Phase（task-ready）

### Phase 1：基礎建設（單一 commit）

#### Task 1.1：安裝 plugin

```bash
npm i -D eslint-plugin-testing-library
```

驗證：`package.json` devDependencies 出現 `eslint-plugin-testing-library: "^7.x.x"`、`package-lock.json` 同步更新。

#### Task 1.2：改 `eslint.config.mjs`

按 §4.2 三個 change 修改。完成後 `node -e "import('./eslint.config.mjs').then(c => console.log('OK'))"` 應該 print `OK`（確認 config 語法正確）。

#### Task 1.3：Sanity check（三條 rule 都觸發）

建 throwaway 測試檔 `tests/_sanity-eslint.test.jsx`（**不 commit**）：

```jsx
// @ts-ignore
import { fireEvent } from '@testing-library/react';

describe('sanity', () => {
  it('should trigger all three sensors', () => {
    const container = document.createElement('div');
    const x = container.querySelector('.foo');
    fireEvent.click(x);
  });
});
```

跑 `npx eslint tests/_sanity-eslint.test.jsx` 預期看到：

- `@typescript-eslint/ban-ts-comment` (line 1)
- `testing-library/no-node-access` (line 6)
- `testing-library/no-container` (line 6)
- `testing-library/prefer-user-event` (line 7)

確認後 `rm tests/_sanity-eslint.test.jsx`。

#### Task 1.4：跑全 repo audit、對齊 grep snapshot

```bash
npx eslint src specs tests 2>&1 | tee /tmp/eslint-baseline.txt
# 拆出每條 rule 的實際數量
grep -oE 'testing-library/[a-z-]+' /tmp/eslint-baseline.txt | sort | uniq -c | sort -rn
grep -c '@typescript-eslint/ban-ts-comment' /tmp/eslint-baseline.txt
```

對齊基準（從嚴到寬）：

1. **每條 rule 的實際違規數應 ≥ Appendix A grep snapshot**（grep 是子集、ESLint 是 superset）。如果某 rule 真實數 < grep snapshot → grep regex 有錯，但不阻塞執行。
2. **每條 rule 的實際違規數應 ≤ §3.1 估算 +20%**。超過 → 暫停 escalate 給用戶（可能採樣已過時、需要重評 phase 拆分）。
3. **Appendix A 已標的「特別大量」case**（如 NavbarMobile 20+ 處 `document.getElementById`）必須在實際 audit 中確認，否則 Phase 4 sub-task 拆分會失準。

把實際數字補進 PR description「Audit baseline」段，後續 phase 都對著這份真實 audit 跑、不再用 §3.1 估算。

#### Phase 1 commit

```
chore(eslint): add ts-ignore + testing-library sensors

- add eslint-plugin-testing-library devDep (v7.x)
- add @typescript-eslint/ban-ts-comment to type-aware section
- add testing-library flat/react config + manual prefer-user-event

Note: this commit alone breaks `npm run lint` repo-wide (~303 violations).
Subsequent commits in this PR clean them all up.
```

> ⚠️ **Husky 顧慮**：本 commit 完成後 pre-commit 的 `lint` step 會 fail（~303 violations）。**對策**：Phase 1–5 全部在同一 working tree 內按順序完成，**不在中途 push**；最後 Phase 5 驗證 0 violation 後再 push。如果中途必須 commit（例如 IDE crash 風險），用 `--no-verify` 並在 commit message 註明「WIP, hooks bypassed intentionally during Phase X」—— 但 push 前必須 squash 或補完整 cleanup。

---

### Phase 2：機械批次違規（commit 2）

範圍：207 處純機械替換（不需要動 production code）

#### Task 2.1：`prefer-screen-queries` (187 處)

純文字替換 `getByText(container, ...)` → `screen.getByText(...)` 等。

**Step 1: dry-run autofix 看 fixable 數量**：

```bash
# 先 commit 當前 working tree 確認乾淨（避免 autofix 改完混到別的 dirty changes）
git status
# dry-run（v9 是 --fix-dry-run）
npx eslint tests --fix-dry-run --rule '{"testing-library/prefer-screen-queries": "error"}' --format json 2>/dev/null \
  | node -e "let d=''; process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d); let fixed=0,unfixed=0; r.forEach(f=>{f.messages.forEach(m=>{if(m.ruleId==='testing-library/prefer-screen-queries'){if(m.fix)fixed++;else unfixed++}})}); console.log('fixable:',fixed,'unfixable:',unfixed)})"
```

`fixable` 是 ESLint 能 autofix 的處數、`unfixable` 要人工處理。經驗：`prefer-screen-queries` 大部分（>90%）autofix 可解；剩下是 destructured pattern（如 `const { getByText } = render(...)` 後 `getByText(name)`）需要人工改成 `screen.getByText(name)` + 移除解構。

**Step 2: 真正 autofix**：

```bash
npx eslint tests --fix --rule '{"testing-library/prefer-screen-queries": "error"}'
git diff --stat   # 確認改動範圍合理
npm run test:browser   # 確認沒改壞
```

**Step 3: grep 漏網之魚**：

```bash
# 形式 1：getByX(container, ...)
grep -rEn '(get|find|query)(All)?By(Text|Role|LabelText|TestId|PlaceholderText|AltText|Title|DisplayValue)\(\s*[a-zA-Z_]' tests/ \
  | grep -v "screen\." | grep -v "within(" | grep -v "page\."
# 形式 2：destructured query function
grep -rEn 'const\s+\{[^}]*(get|find|query)(All)?By' tests/
```

每處逐個改成 `screen.getByX(...)` 或 `within(scope).getByX(...)`。

#### Task 2.2：`render-result-naming-convention` (10 處)

把 `const { container } = render(...)` 等的命名改成 rule 接受的 pattern：

- 解構保留 `container` 命名 OK，但 `const x = render(...)` → `const view = render(...)` 或 `const { ... } = render(...)`
- 規則細節：[testing-library docs](https://github.com/testing-library/eslint-plugin-testing-library/blob/main/docs/rules/render-result-naming-convention.md)

#### Task 2.3：`no-container` (9 處)

多半跟 Task 4 (`no-node-access`) 重疊。先機械處理「拿 `container` 但只用一次」的 case：

- `const { container } = render(...)` 沒後續 `container.X` → 改 `render(...)` 不解構

#### Task 2.4：`no-unnecessary-act` (1 處)

拆 `act(() => { /* 同步 code */ })` wrapper，留下純同步呼叫。

#### Phase 2 commit

```
test: fix testing-library mechanical violations

- prefer-screen-queries: 187 → 0 (mostly via --fix + manual sweep)
- render-result-naming-convention: 10 → 0
- no-container: 9 → 0
- no-unnecessary-act: 1 → 0

Production code untouched. Test behavior unchanged.
```

#### Phase 2 驗證

```bash
npx eslint src specs tests 2>&1 | grep -E "(prefer-screen-queries|render-result-naming-convention|no-container|no-unnecessary-act)" | wc -l
# 預期：0
npm run test:browser
# 預期：全綠（這 4 條都是純查詢方式變更，不影響行為）
```

---

### Phase 3：`prefer-user-event` 8 處（commit 3）

按 §3.2 表格逐處處理。

#### Task 3.1：PostCard 5 處 click migration（line 88, 132, 148, 183, 191）

**Pattern A**（line 88, 132, 148, 183, 191 全適用）：

```jsx
// 改前
it('描述', () => {
  // setup ...
  fireEvent.click(target);
  expect(handler).toHaveBeenCalled();
});

// 改後
it('描述', async () => {
  // ← async
  const user = userEvent.setup(); // ← setup
  // setup ...
  await user.click(target); // ← await user.click
  expect(handler).toHaveBeenCalled();
});
```

注意：每個 `it` block 各自 `userEvent.setup()`，不共用 `user` 變數（避免 state pollution）。

#### Task 3.2：NotificationToast line 141（fake timers 環境）

**關鍵坑**：`tests/integration/notifications/NotificationToast.test.jsx:48` 有 `vi.useFakeTimers()`。`userEvent` 預設用 real `setTimeout`，跟 fake timers **互相鎖死**（user.click 內部的 `setTimeout` 不 advance → click 永遠不 resolve）。

**正確寫法**：

```jsx
// 改後
it('面板開啟時不顯示 toast', async () => {
  // ← async
  // Arrange
  renderWithProviders();
  act(() => {
    notificationsCallback([], null);
    unreadCallback([]);
  });

  // Act — 點擊鈴鐺開啟面板
  const user = userEvent.setup({
    advanceTimers: vi.advanceTimersByTime, // ← 關鍵選項
  });
  await user.click(screen.getByRole('button', { name: /通知/ }));

  act(() => {
    notificationsOnNew([{ id: 'n1', message: '不應顯示' }]);
  });

  // Assert
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
```

#### Task 3.3：ComposeModal line 126（`<dialog>` cancel event）

**問題**：jsdom 不實作 `<dialog>` 的 ESC → cancel event 行為。`userEvent.keyboard('{Escape}')` 不會觸發 cancel handler。

**解法**：用 native DOM `dispatchEvent`（不是 `fireEvent`、不是 `userEvent`），完全繞過 testing-library，testing-library lint rule **不會抓**：

```jsx
// 改前（line 118–128）
it('表單空白時 Escape 不阻止關閉', async () => {
  const user = userEvent.setup();
  render(<ModalWrapper />);
  await user.click(screen.getByRole('button', { name: '開啟 Modal' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('open');
  // 觸發 cancel event 模擬 Escape（jsdom 不會自動呼叫 close）
  const cancelEvent = new Event('cancel', { cancelable: true });
  fireEvent(dialog, cancelEvent); // ❌ fireEvent
  expect(cancelEvent.defaultPrevented).toBe(false);
});

// 改後
it('表單空白時 Escape 不阻止關閉', async () => {
  const user = userEvent.setup();
  render(<ModalWrapper />);
  await user.click(screen.getByRole('button', { name: '開啟 Modal' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('open');
  // 觸發 cancel event 模擬 Escape（jsdom 不會自動呼叫 close）
  const cancelEvent = new Event('cancel', { cancelable: true });
  dialog.dispatchEvent(cancelEvent); // ✅ native DOM API
  expect(cancelEvent.defaultPrevented).toBe(false);
});
```

同檔頂部 import 移除 `fireEvent`：

```jsx
// 改前
import { render, screen, fireEvent } from '@testing-library/react';
// 改後
import { render, screen } from '@testing-library/react';
```

#### Task 3.4：NotificationPanel line 267（img error event）

同 Task 3.3 邏輯：用 native `dispatchEvent` 繞過 testing-library。

```jsx
// 改前（line 260–272）
it('should handle avatar error with fallback', () => {
  const notification = createMockNotification({ actorPhotoURL: 'https://broken.url/img.jpg' });
  render(<NotificationItem notification={notification} onClick={vi.fn()} />);
  const img = screen.getByRole('img', { name: 'Test Actor 的頭像' });
  // 用 fireEvent 觸發圖片載入錯誤（確保 React 狀態更新）
  fireEvent.error(img); // ❌ fireEvent
  expect(screen.queryByRole('img', { name: 'Test Actor 的頭像' })).not.toBeInTheDocument();
  expect(screen.getByText('T')).toBeInTheDocument();
});

// 改後
it('should handle avatar error with fallback', () => {
  const notification = createMockNotification({ actorPhotoURL: 'https://broken.url/img.jpg' });
  render(<NotificationItem notification={notification} onClick={vi.fn()} />);
  const img = screen.getByRole('img', { name: 'Test Actor 的頭像' });
  // 觸發圖片載入錯誤（native DOM event，繞過 testing-library）
  img.dispatchEvent(new Event('error')); // ✅ native DOM API
  expect(screen.queryByRole('img', { name: 'Test Actor 的頭像' })).not.toBeInTheDocument();
  expect(screen.getByText('T')).toBeInTheDocument();
});
```

⚠️ **回歸風險**：`img.dispatchEvent(new Event('error'))` 跟 `fireEvent.error(img)` 行為差異：

- `fireEvent.error` 會呼叫 React 的 `unstable_batchedUpdates` 包裹 → state update 同步 flush
- 純 `dispatchEvent` 不會 → state update 可能延後到下一個 event loop tick

如果改完測試掛（`queryByRole` 還抓得到 img），用 `await waitFor`：

```jsx
img.dispatchEvent(new Event('error'));
await waitFor(() => {
  expect(screen.queryByRole('img', { name: 'Test Actor 的頭像' })).not.toBeInTheDocument();
});
```

同檔頂部 import 也要拿掉 `fireEvent`。

#### Phase 3 commit

```
test: replace fireEvent with userEvent.setup() pattern

- PostCard: 5x fireEvent.click → await user.click (functions made async)
- NotificationToast: 1x click migrated with advanceTimers option (fake timer compat)
- ComposeModal: <dialog> cancel event → native dialog.dispatchEvent (jsdom limitation)
- NotificationPanel: img error event → native img.dispatchEvent (no userEvent equivalent)

All `fireEvent` imports removed. 0 prefer-user-event violations.
```

#### Phase 3 驗證

```bash
grep -rn "fireEvent" tests/integration/                # 預期：0
npx eslint src specs tests 2>&1 | grep prefer-user-event | wc -l   # 預期：0
npm run test:browser                                   # 預期：全綠
```

---

### Phase 4：`no-node-access` 89 處（commit 4–N，每 domain 一個 sub-commit）

#### 修法分類（每處 audit 後選一種）

| 類型                    | 條件                                                                    | 修法                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **A. 改 a11y 結構**     | Element 缺語意身份（如 SVG `aria-hidden`、純佈局 div）                  | 改 component：加 `role` / `aria-label` / `aria-labelledby` → 測試用 `getByRole`。**首選**，順便修 a11y。 |
| **B. 用 `within()`**    | Element 有語意身份但被同 role 多個元素干擾                              | 限縮範圍：`within(navContainer).getByRole(...)`                                                          |
| **C. 加 `data-testid`** | 純測試需求（無 a11y 意義的 element，如 hidden marker、layout sentinel） | Component 加 `data-testid="xxx"` → 測試用 `screen.queryByTestId('xxx')`。**最後手段**。                  |

#### 已知範例（NavbarDesktop.test.jsx）

| 違規行                                                | Component                                               | 類型 | 修法                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 159: `container.querySelector('[class*="skeleton"]')` | `UserMenu.jsx:30` `<div className={styles.skeleton} />` | C    | 加 `data-testid="auth-skeleton"`。Skeleton 對 a11y 用戶應該是 invisible（`aria-hidden`），所以不加 role。                            |
| 163: `container.querySelector('[class*="avatar"]')`   | `UserMenu.jsx:42-72` avatar button                      | B    | 已有 `aria-label="使用者選單"` → `within(nav).queryByRole('button', { name: '使用者選單' })`                                         |
| 212: `avatarBtn.querySelector('svg')`                 | `UserMenu.jsx:60-71` SVG fallback                       | A    | SVG 把 `aria-hidden="true"` 改 `role="img" aria-label="預設頭像"`，測試用 `within(avatarBtn).getByRole('img', { name: '預設頭像' })` |

#### Sub-task 拆分

按 domain 拆，每 domain 一個 sub-commit：

- **Task 4.1**：`tests/integration/navbar/` (NavbarDesktop, NavbarMobile)
- **Task 4.2**：`tests/integration/posts/` (PostDetail, PostFeed, PostCard 殘留)
- **Task 4.3**：`tests/integration/notifications/` (NotificationBell, NotificationPanel, scroll-to-comment, notification-click)
- **Task 4.4**：`tests/integration/profile/` (ProfileEventList, ProfileHeader, UserLink, BioEditor)
- **Task 4.5**：`tests/integration/weather/` (weather-page)
- **Task 4.6**：`tests/integration/toast/` (crud-toast)
- **Task 4.7**：`tests/integration/strava/` （Phase 4 開始時 grep 確認違規檔案）

#### 每個 sub-task 的執行模板

1. `npx eslint <domain-path> --rule '{"testing-library/no-node-access": "error"}' 2>&1 | grep no-node-access` → 列出該 domain 所有違規行號
2. 逐行 audit：判斷 A / B / C 類型
3. **如果是 A**（要動 component）：
   - 先確認 a11y 改善方向（`role`、`aria-label` 是否合理）
   - 如果 production component 已有 a11y test 覆蓋，跑一次確認沒回退
   - 如果不確定 → **暫停** escalate 給用戶
4. 修 + 驗 (`npx vitest run <該檔>`)
5. domain 內全綠 → sub-commit

#### Phase 4 撞牆 SOP（無 Path B 退路）

如果某個 case **真的**沒辦法用 A / B / C 解決（例如第三方 library Portal 內部 DOM 結構動不了、Leaflet 渲染的 map element），按以下流程：

1. **不要**自行加 `// eslint-disable-next-line testing-library/no-node-access`
2. **不要**改 ESLint config 加 file override
3. **暫停** Phase 4，把卡住的 case 寫成 escalation note：

   ```markdown
   ## Phase 4 撞牆：<檔案>:<行號>

   - 違規 code: ...
   - 嘗試的 A/B/C 方案:
     - A: ... (失敗原因)
     - B: ... (失敗原因)
     - C: ... (為何不適合)
   - 建議: <重大 refactor / 換 component library / 其他>
   ```

4. 與用戶討論：(a) 接受 component refactor；(b) 退到 Path B 就此 case；(c) 重新評估整個 Phase 4 策略

#### Phase 4 commits

```
test(navbar): eliminate no-node-access via a11y attrs + within
test(posts): eliminate no-node-access ...
test(notifications): eliminate no-node-access ...
test(profile): eliminate no-node-access ...
test(weather): eliminate no-node-access ...
test(toast): eliminate no-node-access ...
test(strava): eliminate no-node-access ...
```

每個 commit message 簡述該 domain 用了哪些類型（A/B/C）、有沒有動 component。

---

### Phase 5：全 repo 驗證 + 收尾（commit N+1，可能 squash 進前面）

#### Task 5.1：ESLint 0 violation

```bash
npx eslint src specs tests
# 預期：no output, exit 0
```

#### Task 5.2：Vitest 全綠

```bash
npm run test:browser
npm run test:server          # 不應受影響但驗證
```

#### Task 5.3：Type check

```bash
npm run type-check
# 預期：0 errors
```

#### Task 5.4：Pre-commit gate full run

```bash
# 在 working tree 故意改一行測試檔，再 git add + commit
git commit -m "verify pre-commit gate"
# 預期：husky 跑完 lint → type-check → spellcheck → vitest 全綠才放行
git reset --soft HEAD~1   # 取消測試 commit
```

#### Task 5.5：Push & PR

```bash
git push -u origin <branch>
gh pr create --title "chore: add ESLint testing-library sensors + repo-wide cleanup" \
  --body "$(cat <<'EOF'
## Summary
- Add eslint-plugin-testing-library + ban-ts-comment sensors
- Eliminate ~303 pre-existing violations
- Improve a11y in N components (UserMenu, etc.) as side effect

## Why
Three Non-Negotiable rules in coding-rules.md / testing-standards.md had no
mechanical guard. Pre-commit gate now blocks new violations.

## Test plan
- [x] npx eslint src specs tests → 0 errors
- [x] npm run test:browser → all green
- [x] npm run test:server → all green
- [x] Husky pre-commit gate verified

## Post-merge action required
After merging, every active worktree (including main) must run `npm install`
to sync the new `eslint-plugin-testing-library` devDependency. See plan §5
Task 5.6 for the SOP.
EOF
)"
```

#### Task 5.6：Post-merge worktree 同步 SOP（merger 必做）

> **為何需要**：本 PR 新增 `eslint-plugin-testing-library` 到 `devDependencies`。`package.json` / `package-lock.json` 跟著 merge 進 main，但 **`node_modules/` 是 gitignored、不會自動同步**。任何 worktree（含 main）在 merge 後第一次跑 `npm run lint` 會炸：
>
> ```
> Cannot find module 'eslint-plugin-testing-library'
> ```

**Step 1：main worktree 同步**

```bash
# 切回 main worktree（路徑視本地設定）
git -C <main-worktree-path> checkout main
git -C <main-worktree-path> pull

# 同步 node_modules
cd <main-worktree-path>
npm install                    # 會依 package-lock.json 把新 plugin 裝起來

# 驗證
npm run lint                   # 應該 0 violation（cleanup 已 merge）
```

**Step 2：所有非 main worktree 也要 rebase + 同步**

```bash
git worktree list              # 列出所有 worktree
```

對每個非 main worktree（包含本 cleanup worktree 自己，如果還留著的話）：

```bash
git -C <worktree-path> rebase main         # 把 main 的新 dep 變更 rebase 進來
cd <worktree-path>
npm install                                # 同步 node_modules
```

> CLAUDE.md Git Workflow §5 已要求「每個非 main worktree 執行 `git -C <path> rebase main`」，本 task 是它的延伸 —— **rebase 後還要 `npm install`**，否則該 worktree 的 lint / test / pre-commit gate 會立刻炸。

**Step 3：清理本 cleanup worktree（可選）**

如果 cleanup 已完成、不再需要該 worktree：

```bash
git worktree remove <cleanup-worktree-path>
git branch -d <cleanup-branch>     # 本地刪 branch（remote 已 merged）
```

**遺漏這 step 的後果**

| 情境                                  | 後果                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| Main worktree 沒跑 `npm install`      | 下次 `npm run lint` 立刻炸 module not found                                       |
| 其他 worktree 沒 rebase               | 該 worktree 的 lint 還是綠（因為沒 plugin），但該 worktree 上開的新 PR 跑 CI 會炸 |
| 其他 worktree rebase 了沒 npm install | husky pre-commit 立刻炸（lint step）                                              |

→ Step 1 + Step 2 必做、Step 3 視情況。

---

## 6. Risks & Mitigations

| 風險                                                                | 機率 | 影響 | 緩解                                                                       |
| ------------------------------------------------------------------- | ---- | ---- | -------------------------------------------------------------------------- |
| Phase 2 autofix 改壞測試行為                                        | 低   | 中   | autofix 後立刻 `npm run test:browser`；任何紅燈逐個 revert                 |
| Phase 3 NotificationToast `advanceTimers` 還是死鎖                  | 中   | 中   | 後備：用 `vi.useRealTimers()` 包該 it block，測完再 `vi.useFakeTimers()`   |
| Phase 3 NotificationPanel `dispatchEvent` 不觸發 React state update | 中   | 低   | 用 `await waitFor()` 包 assertion（已寫進 Task 3.4）                       |
| Phase 4 撞牆無 Path B 退路 → 整個 cleanup 卡住                      | 中   | 高   | §5 Phase 4 撞牆 SOP：暫停 + escalate，**不**自行降級                       |
| 動 component 加 a11y 屬性導致其他測試紅                             | 中   | 中   | 每改一個 component 立刻 `npx vitest run <對應測試檔>`                      |
| PR 巨大 review 痛苦                                                 | 高   | 中   | 按 phase 拆 commit + 按 domain 拆 sub-commit；reviewer 可分段看            |
| Husky 在 cleanup 中途擋下意外 commit                                | 中   | 低   | Phase 1 commit message 已標註；中途如需 commit 用 `--no-verify` 並寫清 WIP |

---

## 7. Out of Scope（明確不做）

- **不**改文件規範本身（`coding-rules.md` / `testing-standards.md` 已正確、只是缺 sensor）
- **不**做 ESLint config 全面 audit（其他 rule 不動）
- **不**動 husky pre-commit 流程
- **不**做 a11y 全面審查（清 `no-node-access` 順便會加 a11y 屬性，但不主動掃所有 component）
- **不**升級 `@testing-library/*` 主版本
- **不**改 `package.json` 其他 dep
- **不**動 `vitest.config.mjs` / `playwright.config.mjs`

---

## 8. 估算與 Checkpoint

### 8.1 Phase 級總覽

| Phase                         | 預估時間    | Checkpoint                                                                   |
| ----------------------------- | ----------- | ---------------------------------------------------------------------------- |
| 1. 基礎建設 + sanity check    | 30 min      | 三條 sensor 全觸發、baseline audit 對齊 Appendix A                           |
| 2. 機械批次 (~207 處)         | 1–2 hr      | autofix + 人工，4 條 rule 全 0 violation、測試全綠                           |
| 3. prefer-user-event (8 處)   | 1 hr        | 0 fireEvent import、測試全綠（含 fake timer + dispatchEvent 兩個 edge case） |
| 4. no-node-access (~43–89 處) | 6–9 hr      | 按 domain 分 sub-commit，每 sub-commit 該 domain 該 rule 0 violation         |
| 5. 驗證 + 收尾                | 30 min      | `npx eslint` 0、`npm run test` 全綠、PR 開好                                 |
| **合計**                      | **9–13 hr** |                                                                              |

> Phase 4 撞牆 SOP 觸發時暫停計時，等用戶決策。

### 8.2 Session 切分建議（按「修法性質」分組）

> **原則**：同一 session 只做**性質相近**的改動，避免在 ESLint config / 純測試重構 / a11y component refactor / 動 src 之間切換 context。Context switch 是品質殺手 —— 改 a11y 結構需要的 mental model 跟改 ESLint config 完全不同，混在同 session 容易疏漏。

| Session   | 時間       | 內容                                                                                            | 性質（為何分這組）                                                                                                                                   |
| --------- | ---------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1**    | 30 min     | Phase 1 全部                                                                                    | 🔧 **基礎設施** — 改 ESLint config + npm install + sanity check。完全不碰測試碼                                                                      |
| **S2**    | 1–2 hr     | Phase 2 全部（4 條機械 rule）                                                                   | 🤖 **純機械測試碼替換** — 大量 autofix + grep 漏網之魚。改測試但邏輯不變                                                                             |
| **S3**    | 1 hr       | Phase 3 全部（fireEvent → userEvent + native dispatchEvent）                                    | ⚡ **Event API 遷移** — 8 處測試的 event triggering 機制統一改變（含 fake timer 坑 + dispatchEvent 兩個 edge case）                                  |
| **S4** ⚠️ | **3–5 hr** | Phase 4.1 **NavbarMobile 單檔**（~20 處 `document.getElementById('mobile-drawer')`）            | 🏗️ **重型 component refactor** — MobileDrawer 加 `role="dialog"` / a11y label，是本 PR 風險最高的 session。建議**單獨一個 session**、不混其他 domain |
| **S5**    | 1.5–2 hr   | Phase 4.1 NavbarDesktop（3 處）+ Phase 4.3 notifications NotificationBell/NotificationPanel SVG | 🎨 **SVG icon a11y 統一改造** — 都是把 `aria-hidden="true"` 改 `role="img" aria-label="..."`，pattern 相同                                           |
| **S6**    | 1.5 hr     | Phase 4.3 notifications 剩餘（unreadDot, scroll-to-comment, notification-click）                | 🔖 **notifications domain testid 補完** — 都是 `.unreadDot` / 特定 ID 元素加 `data-testid`                                                           |
| **S7**    | 1.5 hr     | Phase 4.4 profile（3 處）+ Phase 4.5 weather（2 處）                                            | 🧹 **純測試重構** — sentinel / class-based query → testid 或 within，**不動 component**                                                              |
| **S8**    | 1 hr       | Phase 4.2 posts（2 處）+ Phase 4.6 toast（3 處）+ Phase 4.7 strava（2 處）                      | 🧺 **小量收尾雜項** — 各 domain 違規少、性質類似（form a11y、container.firstChild 改 matcher）                                                       |
| **S9**    | 30 min     | Phase 5 全部（驗證 + PR）                                                                       | ✅ **驗證收尾** — 跑指令、開 PR、寫 description                                                                                                      |

**合計 9 個 session、~12–14 hr 工作時間**（比 §8.1 略多 buffer，因 session 切換有啟動成本）

### 8.3 Session 切分的關鍵限制

⚠️ **跨 session 不能 push**（Phase 1 commit 後 lint repo-wide fail，直到 S9 才回 0）：

```bash
# 每個 session 結束、要切去做別的工作前：
git status                                       # 確認 working tree
git stash push -m "WIP: 024 cleanup after S<N>"  # stash 中斷狀態
git checkout <別的 branch>
# ... 別的工作 ...
git checkout 024-eslint-testing-lib-cleanup
git stash pop                                    # 恢復繼續做 S<N+1>
```

### 8.4 風險點（按 session 標）

| Session | 風險   | 緩解                                                                                               |
| ------- | ------ | -------------------------------------------------------------------------------------------------- |
| S1      | 低     | 純 config 改動，可 rollback                                                                        |
| S2      | 中     | autofix 改壞測試 → S2 結束前必跑 `npm run test:browser`                                            |
| S3      | 中     | NotificationToast fake timer 死鎖（plan §5 Task 3.2 已寫 `advanceTimers` 解法）                    |
| **S4**  | **高** | NavbarMobile 重型 refactor 撞牆機率高 → 預留 5 hr buffer，撞牆走 plan §5 Phase 4 撞牆 SOP escalate |
| S5      | 中     | 動多個 component 加 a11y → 跑全 navbar/notifications 測試確認沒退                                  |
| S6      | 低     | 純 testid 加，影響範圍小                                                                           |
| S7      | 低     | 純測試改，不動 component                                                                           |
| S8      | 中     | 三個 domain 雖小但分散 → 容易漏 grep 隱性違規                                                      |
| S9      | 低     | 驗證指令                                                                                           |

### 8.5 建議排程

如果你希望「**開始就一氣呵成做完最危險部分**」：S1 → S2 → S3 → S4（前 4 session，~6–8 hr，跨 1–2 天）。S4 通過後本 PR 風險最大的部分過去。

如果你希望「**先快速攢成就感**」：S1 → S2 → S3（3 session、~3 hr，當天可完成），然後讓 Phase 4 (S4–S8) 分 2–3 天慢慢做。

**不建議**：S4 跟其他 session 合併（風險太集中）、跳著做 session（性質會混雜、品質掉）。

---

## 9. 相關檔案 Reference

### 主戰場（會被改）

| 檔案                                                         | 用途                                                                              |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `eslint.config.mjs`                                          | 加 sensor（§4.2）                                                                 |
| `package.json` / `package-lock.json`                         | 加 dev dep                                                                        |
| `tests/integration/posts/PostCard.test.jsx`                  | Phase 3 Task 3.1 + Phase 4 (no-node-access)                                       |
| `tests/integration/posts/ComposeModal.test.jsx`              | Phase 3 Task 3.3                                                                  |
| `tests/integration/notifications/NotificationToast.test.jsx` | Phase 3 Task 3.2 (fake timer 坑)                                                  |
| `tests/integration/notifications/NotificationPanel.test.jsx` | Phase 3 Task 3.4 + Phase 4                                                        |
| `tests/integration/navbar/NavbarDesktop.test.jsx`            | Phase 4 Task 4.1（已 audit 3 處範例）                                             |
| `src/components/Navbar/UserMenu.jsx`                         | Phase 4 Task 4.1 對應 component（加 SVG `role="img"`、加 skeleton `data-testid`） |
| Phase 2 的 187 處 `prefer-screen-queries`                    | 散布全 `tests/integration/`                                                       |

### 規範來源（不改）

| 檔案                                     | 內容                                                           |
| ---------------------------------------- | -------------------------------------------------------------- |
| `.claude/rules/coding-rules.md`          | Non-Negotiable #1：`@ts-ignore` 禁用                           |
| `.claude/rules/testing-standards.md`     | `fireEvent` / `container.querySelector` 禁用                   |
| `.claude/references/testing-handbook.md` | Testing Library 三劍客、`renderWithProviders`、`within()` 範例 |
| `CLAUDE.md`                              | Non-Negotiable 索引                                            |

---

## 10. Decision Log

| Decision                                            | Rationale                                                                                          | Trade-off                                                             |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Path A（一次清光）                                  | 用戶決策 — 不留 warn 長尾                                                                          | PR 巨大、review 痛                                                    |
| `prefer-user-event` 不設 `allowedMethods`           | 用戶決策 — 嚴格度優先；兩個 escape case 改用 native `dispatchEvent` 即可，不需要 rule level escape | ComposeModal cancel 測試從 `fireEvent` 改 `dispatchEvent`（行為相同） |
| `no-node-access` 撞牆**不**退到 Path B              | 用戶決策 — 不允許 `warn` 殘留                                                                      | 撞硬牆時要暫停 escalate，可能整個 PR 卡住                             |
| 用 `eslint-plugin-testing-library` v7               | 官方維護、語意精確                                                                                 | 多一個 dev dep                                                        |
| `ban-ts-comment` 用既有 `@typescript-eslint` plugin | 零新 dep                                                                                           | 無                                                                    |
| `ban-ts-comment` `minimumDescriptionLength: 10`     | 與 `coding-rules.md` 第 1 條一致                                                                   | `@ts-expect-error` 必須附 ≥10 字說明                                  |
| Worktree 另開                                       | 用戶決策                                                                                           | 不會干擾 main 開發                                                    |
| Phase 4 按 domain 拆 sub-commit                     | review 友善                                                                                        | commit history 較長（但有意義）                                       |

---

## 11. Implementer 接手 checklist

接手執行前，先確認：

- [ ] 已讀完本 plan §1–§5
- [ ] 已開好 worktree（branch 名與用戶確認）
- [ ] 已在 worktree 跑 `npm install`
- [ ] 已確認 main 是最新（`git -C <main worktree> pull`）
- [ ] 已知 Phase 4 撞牆要 escalate（不自行 disable / config override）
- [ ] 已確認本 session 不會被打斷超過半天（避免 working tree 長時間 broken state）
- [ ] 已準備好對應的 `gh` token（Phase 5 會開 PR）

---

## 12. 後續產出 task 的銜接

本 plan 是 implementation plan。後續執行者可：

- 用 `/speckit.tasks` 從本 plan 產出 `tasks.md`（dependency-ordered task list）
- 或直接按 §5 的 Phase / Task 編號當 task 清單執行（Phase 1.1 → 1.2 → ... → 5.5）

每個 Phase 都有明確的 commit message template + 驗證指令，task generator 不需要再推導。

---

## Appendix A：grep-based pre-audit snapshot (2026-04-28)

> **用途**：plan 撰寫時 plugin 還沒裝、無法跑真正的 ESLint。本附錄是用 grep 估算的「至少會被抓到的」違規清單，給 implementer 在 Phase 1 Task 1.4 對齊用。
>
> **重要 caveat**：
>
> 1. 真實 ESLint 數字 **≥** 這份 grep snapshot（因為 testing-library rule 還抓 `.children`、`.childNodes` 等我 grep 沒涵蓋的 pattern）
> 2. `prefer-screen-queries` 187 處與 `render-result-naming-convention` 10 處我 grep 不準，未列入本附錄；以 ESLint 真實 audit 為準
> 3. 註解（JSDoc / inline comment）裡提到 `container.querySelector` 等字串會被 grep 抓到但 ESLint 不會 → 本附錄已手動排除

### A.1 `no-node-access` grep snapshot（按 domain，至少 ~43 處）

> 含 `.querySelector` / `.querySelectorAll` / `.parentElement` / `.firstChild` / `document.getElementById` / `document.querySelector` 等 pattern

#### **navbar 23 處（⚠️ 比 plan §3.3 估計大很多）**

| 檔案                                              | 行號                                                                                | 違規 code 摘要                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `tests/integration/navbar/NavbarDesktop.test.jsx` | 159                                                                                 | `container.querySelector('[class*="skeleton"]')`            |
| `tests/integration/navbar/NavbarDesktop.test.jsx` | 163                                                                                 | `container.querySelector('[class*="avatar"]')`              |
| `tests/integration/navbar/NavbarDesktop.test.jsx` | 212                                                                                 | `avatarBtn.querySelector('svg')`                            |
| `tests/integration/navbar/NavbarMobile.test.jsx`  | 152                                                                                 | `btn.querySelectorAll('span')`                              |
| `tests/integration/navbar/NavbarMobile.test.jsx`  | 164, 176, 185, 194, 206, 216, 229, 239, 252, 262, 295, 306, 325, 337, 350, 364, 374 | **17 處** `document.getElementById('mobile-drawer')`        |
| `tests/integration/navbar/NavbarMobile.test.jsx`  | 278                                                                                 | `document.querySelector('[aria-controls="mobile-drawer"]')` |
| `tests/integration/navbar/NavbarMobile.test.jsx`  | 321                                                                                 | `document.querySelector('[class*="overlay"]')`              |

> **NavbarMobile 重大發現**：~20 處 `document.getElementById('mobile-drawer')` 是 a11y attribute (aria-controls) 加錯地方的標誌 —— component 應該在 mobile drawer 用 `role="dialog"` 或暴露穩定的 a11y label，測試才能用 `getByRole('dialog', { name: '...' })`。Phase 4 Task 4.1 處理 NavbarMobile 時**幾乎一定要動 `MobileMenu` / `MobileDrawer` component**，不是純測試重構。

#### notifications 8 處

| 檔案                                                          | 行號     | 違規 code 摘要                                                                     |
| ------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `tests/integration/notifications/NotificationBell.test.jsx`   | 276      | `bell.querySelector('svg')`                                                        |
| `tests/integration/notifications/NotificationPanel.test.jsx`  | 234, 244 | `container.querySelector('[class*="unreadDot"]')` × 2                              |
| `tests/integration/notifications/notification-click.test.jsx` | 240, 250 | `panel.querySelector('[class*="unreadDot"]')` / `reopenedPanel.querySelector(...)` |
| `tests/integration/notifications/scroll-to-comment.test.jsx`  | 34       | `document.getElementById(commentId)`                                               |
| `tests/integration/notifications/scroll-to-comment.test.jsx`  | 88, 106  | `container.querySelector('#cmt-123')` × 2                                          |

#### posts 2 處

| 檔案                                          | 行號 | 違規 code 摘要                                                       |
| --------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `tests/integration/posts/PostDetail.test.jsx` | 186  | `(btn) => btn.querySelector('svg') && btn.textContent.includes('5')` |
| `tests/integration/posts/PostFeed.test.jsx`   | 223  | `container.querySelector('[class*="feed"]')`                         |

#### profile 3 處

| 檔案                                                  | 行號     | 違規 code 摘要                                                   |
| ----------------------------------------------------- | -------- | ---------------------------------------------------------------- |
| `tests/integration/profile/ProfileEventList.test.jsx` | 241, 257 | `container.querySelector('[aria-hidden="true"]')` (sentinel) × 2 |
| `tests/integration/profile/ProfileHeader.test.jsx`    | 183      | `document.querySelectorAll('script').length`                     |

#### strava 2 處

| 檔案                                             | 行號   | 違規 code 摘要                               |
| ------------------------------------------------ | ------ | -------------------------------------------- |
| `tests/integration/strava/RunsRouteMap.test.jsx` | 59, 68 | `container.firstChild` × 2（測 null render） |

#### toast 3 處

| 檔案                                               | 行號     | 違規 code 摘要                                   |
| -------------------------------------------------- | -------- | ------------------------------------------------ |
| `tests/integration/toast/crud-toast.test.jsx`      | 265, 287 | `document.querySelector('form')` × 2             |
| `tests/integration/toast/toast-container.test.jsx` | 65       | `screen.getByTestId('toast-id-1').parentElement` |

#### weather 2 處

| 檔案                                              | 行號 | 違規 code 摘要                                                     |
| ------------------------------------------------- | ---- | ------------------------------------------------------------------ |
| `tests/integration/weather/favorites.test.jsx`    | 501  | `chip.closest(...) \|\| chip.closest(...) \|\| chip.parentElement` |
| `tests/integration/weather/weather-page.test.jsx` | 396  | `document.querySelector('[class*="skeleton"]')`                    |

### A.2 `no-container` grep snapshot（7 檔，~12 處）

> Pattern：`const { container } = render(...)` / `const { container, ... } = render(...)`

| 檔案                                                         | 行號     |
| ------------------------------------------------------------ | -------- |
| `tests/integration/toast/toast-container.test.jsx`           | 43       |
| `tests/integration/posts/PostFeed.test.jsx`                  | 214      |
| `tests/integration/strava/RunsRouteMap.test.jsx`             | 57, 66   |
| `tests/integration/profile/ProfileEventList.test.jsx`        | 238, 254 |
| `tests/integration/events/EventCardMenu.test.jsx`            | 106, 124 |
| `tests/integration/notifications/scroll-to-comment.test.jsx` | 82, 102  |
| `tests/integration/notifications/NotificationPanel.test.jsx` | 230, 240 |

註：`no-container` 只在「拿了 container 又用它呼叫 querySelector」時才報；單純解構 `container` 但不用、或只 `container.firstChild` 是否觸發要看 v7 規則細節。實作 Phase 2 Task 2.3 時逐個驗證。

### A.3 `prefer-user-event` 8 處（已在 §3.2 列完整清單）

略，見 §3.2。

### A.4 對 Phase 4 sub-task 拆分的影響

根據本附錄，建議調整 plan §5 Phase 4 的 sub-task 順序與工作量：

| Sub-task          | 違規數（A.1 estimate） | 主要工作                                                                                             | 預估時間調整              |
| ----------------- | ---------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------- |
| 4.1 navbar        | **23**                 | NavbarDesktop 3 處 + NavbarMobile **要動 MobileDrawer component**（加 `role="dialog"` / a11y label） | 2–3 hr（plan 原估算偏低） |
| 4.2 posts         | 2                      | 純測試重構                                                                                           | 30 min                    |
| 4.3 notifications | 8                      | NotificationBell SVG 加 role + NotificationPanel unreadDot 加 testid                                 | 1.5 hr                    |
| 4.4 profile       | 3                      | ProfileEventList sentinel 改 testid、ProfileHeader script tag 測試重思路                             | 1 hr                      |
| 4.5 weather       | 2                      | 純測試重構                                                                                           | 30 min                    |
| 4.6 toast         | 3                      | crud-toast form 加 role、toast-container parentElement → within                                      | 45 min                    |
| 4.7 strava        | 2                      | RunsRouteMap null 測試改用 `container.toBeEmptyDOMElement()` 或類似                                  | 30 min                    |
| **小計**          | **~43** (grep)         | 真實可能 ≥ 89（plan §3.1）                                                                           | 6–9 hr                    |

> **關鍵**：`no-node-access` 真實 ESLint 數字若顯著 > grep snapshot（例如真的是 89 處），多出來的部分大概率集中在 `.children` / `.childNodes` 等本附錄沒涵蓋的 pattern，分布應該按比例擴張。Implementer 在 Task 1.4 對齊後，按各 domain 的真實數字調 §8 估時。
