# Quickstart: 文章搜尋驗證

## Prerequisites

- 在 `103-posts-search` feature branch/worktree 執行。
- 安裝依賴：`npm install`。
- 準備 Firestore 測試資料時，至少包含：
  - title 命中文章。
  - content-only 命中文章。
  - title/content 都命中文章。
  - 同一 hit tier 中不同 `postAt` 的文章。
  - `postAt` 相同但 id 不同的文章。
  - soft-deleted 文章。
  - account-deletion-hidden 文章。
  - 匿名、一般登入者、文章作者三種互動情境。

## Manual/dev flow

1. 啟動本機開發伺服器：

   ```bash
   npm run dev
   ```

2. 開啟 `/posts`。
3. 在文章河道標題下方搜尋框輸入有效 keyword，按 Enter 或搜尋按鈕。
4. 確認導向 `/posts/search?q={keyword}`，搜尋框保留 keyword。
5. 重新整理搜尋頁，確認 keyword 與結果可還原。
6. 清空搜尋框 submit，確認導回 `/posts`。
7. 直接開 `/posts/search` 或 `/posts/search?q=%20%20`，確認導回 `/posts`。
8. 驗證結果：
   - title hit 排在 content-only hit 前。
   - 同 tier 依 `postAt desc` 排序。
   - `postAt` 相同時依 id desc 穩定排序。
   - soft-deleted/account-deletion-hidden 不出現。
   - content hit 摘要顯示第一個命中附近文字。
   - title 或摘要命中處有 highlight。
9. 捲到底部，確認 load more 追加結果且沒有重複 post id。
10. 分別以匿名、一般登入者、作者驗證卡片互動與權限：
    - 匿名可搜尋與進詳文，但按讚/收藏等需登入互動被擋。
    - 登入者看到 liked/favorite 狀態。
    - 作者看到作者操作入口。

## Unit targets

- `tests/unit/service/post-service.test.js`
  - keyword trim/case-fold。
  - title/content contains matching。
  - title tier 優先、`postAt desc`、id desc tie-break。
  - snippet/highlight metadata。
  - public active visibility exclusion。
- `tests/unit/runtime/post-use-cases.test.js`
  - candidate pagination scan。
  - active filter + matching + page fill 補抓。
  - cursor 指向最後掃描候選。
  - load-more dedupe。
  - empty/error response behavior。
- `tests/unit/runtime/usePostsSearchPageRuntime.test.jsx`
  - invalid/missing q redirect。
  - valid q initial load。
  - retry。
  - load more。
  - optimistic like/favorite rollback。
- `tests/unit/ui/posts/PostSearchForm.test.jsx`
  - blank submit inline prompt/no navigation。
  - valid submit URL encoding。
- `tests/unit/ui/posts/PostsSearchPageScreen.test.jsx`
  - loading/empty/error/success states。
  - no compose prompt on search page。

## Commands

Development smoke checks:

```bash
git diff --check
npm run lint:changed
npm run type-check:changed
```

Closeout gates:

```bash
npm run lint -- --max-warnings 0
npm run type-check
npm run depcruise
npm run spellcheck
```

Important caveat:

- `npm run test`, `npm run test:branch`, `npm run test:e2e:branch`, and related e2e/test scripts currently echo disabled stub messages in `package.json`; they are not effective acceptance gates until restored.
- Use targeted Vitest commands for newly added tests during implementation, then report exact command and exit code.

## Expected outcomes

- `/posts` search submit never mutates the main feed state.
- `/posts/search?q={keyword}` is refresh-safe and independently reloads results.
- Search result visibility matches existing public active post rules.
- Sorting, snippet, highlight, load-more, dedupe, retry, and card interaction contracts match `contracts/posts-search-ui-contract.md`.
- Candidate scan performance is measured against the 2 秒首批目標; if normal data volume exceeds the target, record the need for an indexed or external search follow-up.
