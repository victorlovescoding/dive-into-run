# Harness Migration Progress

> Plan：見 [PLAN.md](./PLAN.md)。本檔追蹤進度與當前狀態。

## Quick Context（新 session 30 秒上手）

- 在做：per-domain 六層架構遷移（OpenAI harness pattern）
- Scope：7 domain + 3 providers + utils
- 總計 13 atomic PR，barrel re-export 過渡 → 最後 codemod 掃除
- Agent 模式：Tech Lead 發包 → Executor 施工 → Reviewer 監督

## 進度儀表板

| PR  | 內容                                  | 狀態      | Executor | Reviewer | PR Link | Notes                                    |
| --- | ------------------------------------- | --------- | -------- | -------- | ------- | ---------------------------------------- |
| 1   | Scaffold + eslint 骨架                | 🟨 進行中 | executor | —        | —       | 首輪施工：scaffold + tracker + 裝 plugin |
| 2   | Providers: firebase-connector         | ⬜ 待開始 | —        | —        | —       | —                                        |
| 3   | Providers: auth + toast               | ⬜ 待開始 | —        | —        | —       | —                                        |
| 4   | Utils                                 | ⬜ 待開始 | —        | —        | —       | —                                        |
| 5   | Domain: weather                       | ⬜ 待開始 | —        | —        | —       | —                                        |
| 6   | Domain: strava                        | ⬜ 待開始 | —        | —        | —       | —                                        |
| 7   | Domain: posts                         | ⬜ 待開始 | —        | —        | —       | —                                        |
| 8   | Domain: comments                      | ⬜ 待開始 | —        | —        | —       | —                                        |
| 9   | Domain: events（最大）                | ⬜ 待開始 | —        | —        | —       | —                                        |
| 10  | Domain: notifications（修 Repo→Repo） | ⬜ 待開始 | —        | —        | —       | —                                        |
| 11  | Domain: members                       | ⬜ 待開始 | —        | —        | —       | —                                        |
| 12  | ESLint 全開                           | ⬜ 待開始 | —        | —        | —       | —                                        |
| 13  | Codemod cleanup + final audit         | ⬜ 待開始 | —        | —        | —       | —                                        |

狀態圖例：⬜ 待開始 / 🟨 進行中 / 🔄 Review 中 / 🔴 卡關 / 🟢 已合併

## 當前 PR 狀態

### PR-1 實作紀錄

- Executor 上一輪動作：Executor 首輪執行，正在建 scaffold + tracker + eslint plugin
- 產出 diff 摘要：建 `src/domains/`、`src/providers/`、`src/utils/` 空骨架（.gitkeep）；裝 `eslint-plugin-boundaries`；在 `eslint.config.mjs` 追加 `boundaries/elements` settings（rules 全 off）；建 `docs/harness-migration/{PLAN.md,PROGRESS.md,DECISIONS.md}`；`CLAUDE.md` Reference Docs 表加 PROGRESS.md pointer
- 自測結果：
  - ✅ `npm run lint` → exit 0（僅 React version warning，非錯誤；`eslint src specs` 整樹通過）
  - ✅ `npm run type-check` → exit 0（`tsc --noEmit` 無輸出）
  - ⚠️ `npm run test` → browser project `111 files / 1106 tests passed`；server project 2 檔 fail（`firebase-admin.test.js` + `firebase-profile-server.test.js`），fail 原因為預期的 emulator gating（`vitest.setup.server.js` 偵測到無 `FIRESTORE_EMULATOR_HOST` 主動 throw）— 需跑 `npm run test:server` 或 `npm run test:coverage` 才會啟 emulator，本輪未跑該指令，屬已知 gating 非新回歸

### PR-1 Review 紀錄

- Reviewer 上一輪結論：尚未審查
- 若 ❌：違規清單 + 修復指引
- 第幾輪 review（超過 2 輪要 Tech Lead 介入）

## Session Handoff Notes

（每次 session 結束由 Tech Lead 寫，下一 session 第一件事讀這裡）

### 最新 handoff（日期 2026-04-22）

- 上輪結束時狀態：PR 1 Executor 首輪完成施工，產出 branch `chore/harness-pr1-scaffold` 並開 PR，等待 Reviewer 審查
- 遇到但未解決的問題：無（首 PR 純 scaffold，無搬檔壓力）
- 下 session 該做什麼：Tech Lead 派 Reviewer 對照 PLAN.md 的「PR 1」範圍核對 Executor 產出；通過後更新儀表板為 🟢，進 PR 2（firebase-connector）
- 需要使用者決策的事項：無

## 已完成 PR 紀錄（append-only）

（每個 PR 合併後填）
