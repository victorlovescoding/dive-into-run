# Implementation Plan: deletePost Subcollection Cleanup

**Branch**: `017-delete-post-cleanup` | **Date**: 2026-04-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-delete-post-cleanup/spec.md`

## Summary

刪除文章時一併清除 `likes` 和 `comments` subcollection，避免孤兒資料殘留 Firestore。技術方案是將現有 `deletePost` 對齊 `deleteEvent` 的 writeBatch 模式——先檢查文章存在、fetch subcollection docs、用 batch 一次性刪除所有文件。

## Technical Context

**Language/Version**: JavaScript (ES6+) with JSDoc + `checkJs: true`
**Primary Dependencies**: Firebase v9+ (Firestore), Next.js 15, React 19
**Storage**: Firebase Firestore — `posts/{postId}/likes/{uid}`, `posts/{postId}/comments/{commentId}`
**Testing**: Vitest (unit, jsdom), Playwright (E2E)
**Target Platform**: Web (Next.js App Router)
**Project Type**: Web application
**Performance Goals**: N/A — non-performance-critical path（刪除是低頻操作）
**Constraints**: Firestore writeBatch 500 筆上限（spec 已確認單篇文章不會超過）
**Scale/Scope**: 改動 `src/lib/firebase-posts.js`（deletePost 函式）+ `firestore.rules`（cascade delete 權限）

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle        | Status  | Notes                                                         |
| ---------------- | ------- | ------------------------------------------------------------- |
| I. SDD/TDD       | ✅ PASS | spec.md 已完成；實作前需先寫失敗測試                          |
| II. 服務層架構   | ✅ PASS | 修改 `src/lib/firebase-posts.js` + `firestore.rules`，UI 不變 |
| III. UX 一致性   | ✅ PASS | 使用者操作流程完全不變                                        |
| IV. 效能與併發   | ✅ PASS | 使用 `writeBatch` 確保原子性                                  |
| V. 程式碼品質    | ✅ PASS | 對齊 `deleteEvent` 既有模式，MVP 思維                         |
| VI. 現代化標準   | ✅ PASS | JSDoc 完整標註、`const` 優先                                  |
| VII. 安全與機密  | ✅ PASS | 無涉及機密                                                    |
| VIII. 代理人協議 | ✅ PASS | 修改前需確認                                                  |
| IX. 編碼鐵律     | ✅ PASS | 無 JSX 變更                                                   |

**Gate Result**: ALL PASS — 無違規，不需 Complexity Tracking。

## Project Structure

### Documentation (this feature)

```text
specs/017-delete-post-cleanup/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (by /speckit.tasks)
```

### Source Code (repository root)

```text
src/lib/
└── firebase-posts.js    # deletePost 函式改動

firestore.rules          # likes/comments subcollection cascade delete 權限

specs/017-delete-post-cleanup/tests/
├── unit/                # deletePost 單元測試（mock Firebase）
└── integration/         # 整合測試（若需要）
```

**Structure Decision**: 改動兩個既有檔案（`firebase-posts.js` + `firestore.rules`），不新增檔案。測試放 `specs/017-delete-post-cleanup/tests/unit/`。
