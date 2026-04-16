# Quickstart: Post Edit Dirty Check — Manual Verification

**Feature**: 020-post-edit-dirty-check | **Date**: 2026-04-16

> 供 code review / QA / 自檢用；每個 checkpoint 對應 spec 的 Acceptance Scenario 或 Edge Case。

---

## 前置作業

1. `npm run dev`（預設 <http://localhost:3000>）或 `firebase emulators:exec --only auth,firestore "npm run test:e2e:emulator"` 完成前置
2. 登入自己的帳號，確認至少有一篇**自己發佈的文章**含**非空白的標題與內文**
3. 另建一篇文章：標題為 `"   前後有空白   "`、內文 `"  hello world  "`（便於驗證 trim）

---

## Scenario A — 編輯文章不改動任何欄位

**對應**：US1 AS-1 / AS-2、SC-001

### From 列表頁 `/posts`

1. 進入 `/posts`
2. 找到自己的文章，點擊「編輯」按鈕
3. 對話框開啟，標題與內文已帶入原文
4. **不做任何輸入**
5. ✅ **期望**：「更新」按鈕呈**停用**狀態（灰階 / `[disabled]` attribute）、無法點擊
6. 嘗試點擊或 Enter：✅ 無任何網路請求（DevTools → Network 驗證）、無 toast、對話框保持開啟

### From 詳情頁 `/posts/[id]`

7. 進入 `/posts/<自己文章 id>`
8. 點擊「編輯」
9. 重複步驟 4~6
10. ✅ 行為**與列表頁完全一致**

---

## Scenario B — 改了再改回原樣

**對應**：US1 AS-3、SC-002

1. 打開編輯對話框（依 Scenario A 任一入口）
2. 在**標題**末尾加上 `"x"` → 按鈕亮起（可點）
3. 刪掉剛加的 `"x"` → ✅ **期望**：按鈕回到**停用**狀態
4. 在**內文**中間加上 `"y"` → 按鈕亮起
5. 刪掉剛加的 `"y"` → ✅ 按鈕回到**停用**狀態

---

## Scenario C — 只加前後空白

**對應**：US1 AS-5、Edge Case「前後空白字元」、SC-003

1. 打開編輯對話框
2. 在**標題尾端**加 3 個空白 → ✅ 按鈕**仍為停用**（trim 後與 original 相同）
3. 在**內文首端**加 3 個空白 → ✅ 按鈕**仍為停用**
4. 同時刪掉原本的前後空白（若有）→ ✅ 按鈕**仍為停用**

---

## Scenario D — 中間空白保留

**對應**：US1 AS-6、Edge Case「中間空白」

1. 打開編輯對話框
2. 修改標題：`"原標題 中間多幾個空格 結尾"`（中間插入新空白）
3. 按「更新」 → 成功
4. 重新打開編輯對話框
5. ✅ **期望**：標題內**中間空白完整保留**；前後空白已 trim

---

## Scenario E — 純空白送出（dirty + validation 雙 gate）

**對應**：US1 Clarification Q2、Edge Case「改成全空白」

1. 打開編輯對話框
2. 將**標題**全選，改為 `"     "`（純空白）
3. ✅ **期望**：按鈕**亮起**（dirty 成立，trim 後 `''` ≠ 原 title）
4. 按「更新」→ ✅ **期望**：出現 error toast「請輸入標題」、對話框**保持開啟**、無資料庫寫入
5. 同理驗證將**內文**改為純空白

---

## Scenario F — 送出中狀態

**對應**：US1 AS-4、FR-008、Edge Case「送出過程中」

1. DevTools → Network → 切換為 `Slow 3G`（模擬慢網）
2. 打開編輯對話框
3. 修改標題為 `"變更過的標題"`
4. 按「更新」
5. ✅ **期望**（請求回傳前）：
   - 按鈕呈**停用**
   - 按鈕文字顯示「**更新中…**」
   - 對話框保持開啟
6. 請求回傳後：對話框關閉、Toast 成功訊息、列表/詳情頁顯示最新標題

---

## Scenario G — 多次開關對話框

**對應**：Edge Case「多次開關編輯對話框」

1. 打開編輯對話框 A（post X）
2. 標題改為 `"aaa"`（按鈕亮）
3. **按 Esc 或關閉按鈕**（不送出），對話框關閉
4. 重新打開編輯對話框（同 post X）
5. ✅ **期望**：標題值**為 post X 的原始標題**（而非 `"aaa"`）、按鈕**停用**
6. 打開編輯對話框 B（post Y）
7. ✅ **期望**：基準值為 post Y 的原始內容，dirty 判定基於 post Y

---

## Scenario H — 新增文章流程不受影響

**對應**：US2 AS-1 / AS-2、FR-005

1. 進入 `/posts`
2. 點擊「發表文章」
3. 對話框標題顯示「**發表文章**」（不是「編輯文章」）
4. ✅ **期望**：按鈕文字為「發布」
5. 空白狀態下，按鈕**可點**（不受 dirty gate 影響）
6. 點擊「發布」（空白）→ ✅ error toast「請輸入標題和內容」（沿用現況 validation）
7. 輸入合法內容 → 按鈕**可點** → 送出成功

---

## Scenario I — 活動編輯頁行為一致性抽查

**對應**：SC-004、FR-009

1. 進入自己的活動詳情頁
2. 點擊「編輯活動」
3. 不改任何欄位 → ✅ 「編輯完成」按鈕停用（既有行為）
4. 對照步驟 3 與 Scenario A：兩者**感知一致**（按鈕停用外觀、不可點擊、無寫入）

---

## 自動化測試對照

| Scenario | Integration                                                                                              | E2E                          |
| -------- | -------------------------------------------------------------------------------------------------------- | ---------------------------- |
| A        | ✅ `compose-modal-dirty.test.jsx` / `posts-page-edit-dirty.test.jsx` / `post-detail-edit-dirty.test.jsx` | ✅ `post-edit-dirty.spec.js` |
| B        | ✅                                                                                                       | ✅                           |
| C        | ✅                                                                                                       | –                            |
| D        | ✅                                                                                                       | –                            |
| E        | ✅                                                                                                       | –                            |
| F        | ✅（mock delay）                                                                                         | –                            |
| G        | ✅                                                                                                       | –                            |
| H        | ✅（sanity check）                                                                                       | –                            |
| I        | –                                                                                                        | 人工抽查                     |

---

## Pass Criteria

- [ ] 所有 Scenario A~I 人工驗證通過
- [ ] `npm run test:branch` 全綠
- [ ] `npm run test:e2e:branch` 全綠
- [ ] `npm run type-check:branch` 無 error
- [ ] `npm run lint:branch` 無 warning
- [ ] DevTools Network 面板：未變更時按「更新」**0 次**寫入（SC-003）
