# Code Review — 011-event-share-og (Polish iteration)

日期：2026-04-10

**Scope**: 目前 uncommitted 的變更，排除 `CLAUDE.md` 與 `project-health/`。
**範圍檔案**:

- `src/components/ShareButton.jsx`（+42 / -5）
- `src/contexts/ToastContext.jsx`（+1 / -1）
- `specs/011-event-share-og/tests/integration/ShareButton.test.jsx`（+95 / -1）

**Verification**:

- `npx vitest run specs/011-event-share-og/tests/integration/ShareButton.test.jsx` → **9 passed / 9 total** ✅
- `npx eslint` on modified files → **0 errors / 0 warnings** ✅
- `npm run type-check` grep `ShareButton|ToastContext` → **空輸出**（0 new errors） ✅

---

## Taste Rating

🟢 **Good taste** — 上一輪 Improvement #1 和 #2 都精準落地。`executeShare` 現在是一條線性敘事：「try share → try copy → toast」，nesting 從 3 降到 2，函式職責分明。`copyToClipboard` 這個 helper 是教科書等級的「好的抽象」——它把一個真實的語義單元（「把文字複製到剪貼簿，不管用什麼手段」）變成一個函式，外界只關心成敗的 boolean，內部細節完全封裝。

---

## Linus's Three Questions

1. **Is this solving a real problem?**
   Yes — 降低 nesting 是 readability + 未來維護的真實收益；`vi.spyOn` 是避免 test 之間狀態污染的真實預防。兩者都不是過度工程。

2. **Is there a simpler way?**
   No further — `executeShare` 已經是三個 linear step，再砍會失去清晰性。函式拆法也恰到好處（`copyViaTextarea` sync / `copyToClipboard` async / `executeShare` orchestration），沒有 over-engineering 也沒有 under-engineering。

3. **What will this break?**
   Nothing — 9/9 tests 全綠，行為與上一輪完全相同，只是結構更乾淨。

---

## [CRITICAL ISSUES]

**None.**

---

## [IMPROVEMENT OPPORTUNITIES]

### 1. `document.execCommand = () => false` 的 stub 會在檔案內殘留（極輕微）

`specs/011-event-share-og/tests/integration/ShareButton.test.jsx:236-238` 和 `:262-264`

```js
if (!document.execCommand) {
  document.execCommand = () => false; // jsdom 沒有預設實作，先 stub
}
const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true);
```

`vi.restoreAllMocks()` 會還原 `vi.spyOn` 套的 wrapper，但**不會**還原第一行直接 assign 上去的 `() => false` base stub。結果是：第一個 test 執行後，`document.execCommand` 永久變成 `() => false`（在同一個 test 檔案的 jsdom instance 內）。

**目前不會炸的原因**：

- Vitest test files 彼此 isolated（各自 jsdom），不會跨檔污染
- 檔案內後續 test 用 `vi.spyOn` 包上去的時候，spy 的 base 是 `() => false`，依然可以被 `mockReturnValue` 改行為，restore 之後變回 `() => false`
- base stub 是 pure function，無狀態，不會造成 data corruption

**Pragmatic 角度**：這是「理論潔癖」而非實際問題。Linus 會說 "works fine, stop polishing"。可以無視。

如果要乾淨到極致，解法是用 `vi.stubGlobal` 或在 `beforeEach` 設定 / `afterEach` 清掉：

```js
// 或許更乾淨的做法
afterEach(() => {
  if ('execCommand' in document) {
    // @ts-expect-error — 清掉我們 stub 上去的 property
    delete document.execCommand;
  }
});
```

但這會引入 `@ts-expect-error`，CLAUDE.md 規則 1 雖然允許但不鼓勵。**結論：保持現狀即可**。

---

### 2. `execCommand` 在 `await` 之後可能失效（production 風險，不是 test 問題）

`src/components/ShareButton.jsx:46-52`

```js
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text); // ← 這個 await 如果 async reject
    return true;
  } catch {
    return copyViaTextarea(text); // ← 這裡的 execCommand 可能因失去 user gesture 失敗
  }
}
```

Web 規範上，`document.execCommand('copy')` 必須在 **user-initiated event handler** 的 synchronous call chain 內才能成功。一旦經過 `await`（哪怕是 rejected promise），微任務 queue 就已經 flush，user gesture context 可能失效。

**兩個情境**：

- **`navigator.clipboard === undefined`**（非常舊的瀏覽器 / 特殊環境）→ `undefined.writeText(...)` **synchronously** throw TypeError → 不會經過 await → user gesture 仍然有效 → `execCommand` 可以跑 ✅
- **`navigator.clipboard.writeText()` async rejects**（HTTP LAN IP 的常見情況）→ 經過 await → user gesture **可能**失效 → `execCommand` 可能回 `false` ⚠️

**但**——使用者本人已經在 iPhone HTTP LAN IP 實測過這個 code path，回報「需要點一次才能複製網址」（意思是修好之後可以跑了）。這代表 Safari 在 HTTP LAN IP 上的 `clipboard.writeText` 是 **synchronously** throw（不是 async reject），所以 user gesture 保留。或者 Safari 對這個規定比較寬鬆。

**結論**：這條風險在實測過的環境裡不存在。留個註記給未來讀 code 的人知道為什麼能 work，不需要改。如果未來遇到「在 Chrome Android HTTP LAN IP 按分享無反應」類似的 bug，這裡是第一個懷疑點。

---

## [STYLE NOTES]

無。

---

## [TESTING GAPS]

**None.** 9 個 test 覆蓋：

| Path                                                         | Test                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| Rendering & a11y                                             | `should render a button with aria-label "分享"`                    |
| 觸控 + Web Share API 可用                                    | `should call navigator.share when Web Share API is available`      |
| 無 Web Share → clipboard                                     | `should copy URL to clipboard when Web Share API is unavailable`   |
| Clipboard 成功 → success toast                               | `should show success toast after clipboard copy`                   |
| Share reject → error toast                                   | `should show error toast when navigator.share rejects`             |
| Share 使用者取消（AbortError）→ 不顯示 error                 | `should NOT show error toast when user cancels share (AbortError)` |
| 桌面（`pointer: fine`）+ 有 `navigator.share` → 走 clipboard | `should copy URL when pointer is fine (desktop)`                   |
| Clipboard reject → `execCommand` fallback 成功               | `should fall back to execCommand when clipboard API rejects`       |
| Clipboard reject + `execCommand` 失敗 → error toast          | `should show error toast when both clipboard and execCommand fail` |

所有 assertion 都對 visible DOM state（toast text / button role），不是 mock theater。

---

## [TASK GAPS]

與上一輪相同：這是 post-implementation polish，`tasks.md` 沒有對應 task。**非 blocker**，可以在 commit message 或 follow-up 的 tasks.md 補 `Phase 6: 熱修` section 記錄動機。

---

## VERDICT

✅ **Worth merging**

沒有 blocking issues，所有 verification 全綠。兩個 improvement opportunities 都是「理論層級潔癖」，Linus 會叫你停止 polish 直接 commit。

**建議 commit 流程**：

1. ~~修 improvement~~ — 不用，這兩個是 nitpick，不值得再動 code
2. （Optional）在 `tasks.md` 加 Phase 6 熱修 section 或在 commit message 描述動機
3. `git add -p` 仔細挑要 commit 的 hunks（排除 `CLAUDE.md` 和 `project-health/`）
4. Commit

---

## KEY INSIGHT

**這一輪把 readability 從「能過 review」推到「一眼就看懂」的境界。** `executeShare` 現在三行主邏輯就講完整個故事：「if 觸控＋有 share，用 share；else copy；copy 失敗顯示錯誤；成功顯示已複製」。沒有 nested try/catch 干擾閱讀，沒有隱式狀態，沒有特殊分支。

`copyToClipboard` 這個抽象的價值不在於「省幾行 code」——省不了多少——而在於**給語義命名**。未來讀 code 的人不需要再在腦裡解析「先試 Clipboard API、失敗就試 textarea、這整段到底在幹嘛」，他只要看 `copyToClipboard` 這個名字就知道。

> "Good code reads like prose."
> 這版 `executeShare` 就是 prose level。收工。
