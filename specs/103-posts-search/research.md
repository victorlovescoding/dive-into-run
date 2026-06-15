# Research: 文章搜尋

## Decision: MVP 使用 `postAt desc` 候選集合分頁掃描

**Rationale**: Firestore 原生不支援任意位置 substring contains query。現有最新文章 repo query 已用 `orderBy('postAt', 'desc')` + `orderBy(documentId(), 'desc')`，包含第一頁與下一頁 cursor（`src/repo/client/firebase-posts-repo.js:77-119`）。MVP 可沿用此排序取候選集合，在 use-case/service 做搜尋比對與結果頁補抓，符合「不要求專用搜尋索引或外部搜尋引擎」的產品澄清。

**Alternatives considered**: 現有 search repo query（`src/repo/client/firebase-posts-repo.js:121-166`）只做 title prefix range、用 title cursor，無法滿足 title/content 任意位置 contains 與 `postAt` 排序。外部搜尋引擎或專用索引能改善大資料量效能，但明確不屬於 MVP。

## Decision: 搜尋正規化與 matching 放在 service/use-case 層

**Rationale**: 文章資料 shape 已在 service 定義，title/content 欄位見 `src/service/post-service.js:16-29`，建立 payload 包含 title/content/postAt/counts 見 `src/service/post-service.js:88-101`。搜尋應在 service 層提供 trim、case-fold、contains、hit type、snippet/highlight metadata、stable comparator 等純邏輯，use-case 層負責呼叫 repo 候選頁、active filter、補抓、dedupe 與 cursor 回傳。

**Alternatives considered**: 把 matching 放在 UI 會違反分層並讓 JSX 承擔業務邏輯。把 matching 放在 repo 會誤導為 Firestore 可直接 contains，也不利於測試純函式。

## Decision: 可見性沿用 public active 規則

**Rationale**: 目前 active 判斷為 `!accountDeletionHidden && !deletedAt`，集中於 `isActiveRecord` 與 `isPublicPostRecordVisible`（`src/service/post-service.js:50-57`, `src/service/post-service.js:217-224`）。use-case 已用 `collectActiveRecords` 過濾 active docs 並在不足 page size 時補抓（`src/runtime/client/use-cases/post-use-cases.js:84-120`, `src/runtime/client/use-cases/post-use-cases.js:219-259`）。搜尋結果必須排除 soft-deleted 與 account-deletion-hidden 文章，與列表、詳文、會員頁、收藏頁一致。

**Alternatives considered**: 只依賴 Firestore query 過濾會需要額外欄位/索引設計，且現有可見性已在 service/use-case 中抽象；MVP 不增加新 visibility storage 欄位。

## Decision: 搜尋排序採 title hit 優先，再 content-only hit，層內 `postAt desc` + `id desc`

**Rationale**: 規格要求標題命中優先於僅內文命中，且同層級依發文時間新到舊，時間相同時依文章 ID 新到舊穩定 tie-break。沿用候選 query 的 `postAt desc` + `documentId desc` 能讓掃描順序與 tie-break 一致；service comparator 仍需明確排序已收集結果，避免不同補抓批次造成順序漂移。

**Alternatives considered**: 沿用現有 prefix query 的 `orderBy('title')` 會違反排序需求。只保留原候選順序缺少 title/content relevance 層級，不足以滿足 FR-018。

## Decision: 結果頁重用 `PostCard` 與 posts runtime 互動能力

**Rationale**: `/posts` route 是 thin entry（`src/app/posts/page.jsx:3-17`），runtime 已集中 user/router/searchParams、初始載入與回傳 handlers（`src/runtime/hooks/usePostsPageRuntime.js:48-52`, `src/runtime/hooks/usePostsPageRuntime.js:116-142`, `src/runtime/hooks/usePostsPageRuntime.js:450-484`）。互動 handlers 已包含按讚、收藏、作者選單、刪除、文章 submit 等（`src/runtime/hooks/usePostsPageRuntime.js:277-438`）。`PostCard` 的資料與 handler contract 覆蓋作者、時間、title/content、counts、liked/favorite/isAuthor 與操作入口（`src/components/PostCard.jsx:13-27`, `src/components/PostCard.jsx:243-254`）。搜尋頁應建立自己的 runtime，但復用相同互動 use-case/helper，避免複製 UI 心智。

**Alternatives considered**: 建立完全獨立的搜尋卡片會提高行為漂移風險。把搜尋結果塞回 `/posts` 主 runtime 會違反獨立搜尋頁與「主河道不被搜尋取代」需求。

## Decision: 搜尋入口插在 `/posts` h1 後、ComposePrompt 前

**Rationale**: `PostsPageScreen` 現在在 `h1` 後直接顯示 `ComposePrompt`（`src/ui/posts/PostsPageScreen.jsx:103-122`）。搜尋是文章河道頂部入口，應置於標題後、發文提示前，避免和主 feed 列表或 composer state 混在一起。

**Alternatives considered**: 放在列表後會降低發現性。放在 composer 內會把搜尋與發文混成同一任務。

## Decision: hydrate/dedupe 沿用既有 helper 概念

**Rationale**: `hydratePosts` 目前把 liked/favorite/isAuthor 狀態合併到 post（`src/runtime/hooks/usePostsPageRuntimeHelpers.js:19-25`），`mergeUniquePosts` 以 id 去重追加（`src/runtime/hooks/usePostsPageRuntimeHelpers.js:28-38`）。搜尋頁需要同樣的個人化狀態與 load-more 去重，應復用或抽出共用 helper。

**Alternatives considered**: 在搜尋 runtime 重新實作 hydration/dedupe 會增加測試面與漂移風險。只依賴後端不重複不足以處理補抓或重試合併。

## Decision: snippet/highlight metadata 由搜尋 use-case/service 回傳，UI 只負責呈現

**Rationale**: 規格要求內文命中摘要顯示第一個命中片段附近內容，並高亮關鍵字。這是搜尋結果資料的衍生狀態，應由純函式計算 `matchedFields`、`snippet`、`highlightRanges` 等 metadata，UI 不做搜尋演算法。

**Alternatives considered**: 在 `PostCard` 內直接尋找字串會讓通用卡片承擔搜尋專屬邏輯。直接用 HTML 字串高亮會帶來 escaping/security 風險；應用 range metadata 或切片 segments 渲染。

## Decision: 測試以 service/runtime/UI unit 為主，承認現有 test/e2e scripts 是 stub

**Rationale**: 現有相關測試涵蓋詳文 UI（`tests/unit/ui/posts/PostDetailScreen.test.jsx`）、comments runtime（`tests/unit/runtime/usePostComments.test.jsx`）、soft-delete rules（`tests/server/firestore/post-soft-delete-rules.test.js`）。目前沒有 posts 主頁/e2e/integration 測試；`package.json` 的 `npm run test`、branch test、e2e 多數是 `echo "Test gate disabled for testless reset"` stub。搜尋功能應新增有效的 unit targets，驗證 matching/sorting/snippet、runtime states、form navigation、result states。

**Alternatives considered**: 把 disabled stub scripts 當驗收 gate 會形成假陽性。只靠 manual QA 不足以保證排序、visibility、dedupe 這些細節。

## Decision: 2 秒首批結果是 MVP 風險，需要實作量測與後續升級路徑

**Rationale**: Candidate scan 會受公開 active posts 數量、匹配率、Firestore latency 與每頁候選量影響；任意 contains 在大型資料量下可能無法穩定達成 2 秒。MVP 仍可先交付，條件是 implementation 中量測首批 candidate scan 次數/耗時，並在超標時保留升級到索引欄位、server-side search index 或外部搜尋服務的決策點。

**Alternatives considered**: 直接宣稱 candidate scan 一定滿足 2 秒是不可靠的。立即導入外部搜尋能降低風險，但超出 MVP 與目前規格界線。
