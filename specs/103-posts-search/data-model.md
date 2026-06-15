# Data Model: 文章搜尋

## SearchKeyword

代表使用者輸入並送出的搜尋字串。

**Fields**

- `rawValue`: 使用者在搜尋框輸入的原始字串。
- `value`: `rawValue.trim()` 後的有效搜尋值。
- `caseFoldedValue`: 英文字母大小寫不敏感比對用值；中文不做斷詞、同義詞或模糊處理。
- `urlValue`: 放入 `/posts/search?q=` 的 encoded query 值。

**Validation**

- `value.length >= 1` 才是有效搜尋；trim 後空字串不得查詢。
- 搜尋欄位只匹配文章 title/content。
- 1 個字元是有效搜尋值。

**Relationships**

- `SearchKeyword` 產生 `PostSearchMatch`。
- `SearchKeyword.value` 必須可從 `/posts/search?q={keyword}` 還原。

**State transitions**

- `editing` -> `invalid`: submit 後 trim 為空，停留目前頁並顯示提示。
- `editing` -> `submitted`: submit 後有效，導向或載入 `/posts/search?q={urlValue}`。
- `submitted` -> `cleared`: 搜尋結果頁清空後 submit，導回 `/posts`。

## PublicActivePost

可被搜尋與顯示的公開 active 文章。

**Fields**

- `id`: 文章 ID；排序 tie-breaker。
- `authorUid`: 作者 UID。
- `authorName`: 作者顯示名稱。
- `authorImgURL`: 作者頭像 URL。
- `title`: 文章標題。
- `content`: 文章內容。
- `postAt`: 發文時間。
- `likesCount`: 按讚數。
- `commentsCount`: 留言數。
- `deletedAt`: soft-delete timestamp；存在時不可顯示。
- `accountDeletionHidden`: 帳號刪除隱藏旗標；true 時不可顯示。

**Validation**

- 必須通過 `isPublicPostRecordVisible` / `isActiveRecord`。
- `title` 或 `content` 任一包含 `SearchKeyword.caseFoldedValue` 才能成為結果。
- 作者名稱、留言、編輯歷史、tag、category 不參與搜尋。

**Relationships**

- 一篇 `PublicActivePost` 可產生一筆 `PostSearchMatch`。
- 一篇 post 可連到 `PersonalizedInteractionState`。

**State transitions**

- `active` -> `softDeleted`: 設定 `deletedAt` 後從搜尋結果排除。
- `active` -> `accountHidden`: 帳號刪除隱藏後從搜尋結果排除。
- `active` -> `updated`: title/content 改變後，下次搜尋依最新內容重新匹配。

## PostSearchMatch

單篇文章對某個 keyword 的命中資訊。

**Fields**

- `post`: `PublicActivePost`。
- `hitType`: `title` 或 `content`；title/content 都命中時為 `title`。
- `matchedFields`: 例如 `{ title: true, content: false }`。
- `firstMatchIndex`: 第一個命中位置；依 `hitType` 對應 title 或 content。
- `snippet`: 結果摘要；content hit 時取第一個內容命中附近文字，title-only hit 可沿用內容摘要。
- `highlightRanges`: title/snippet 的高亮 range metadata，UI 用 segments 呈現。
- `rankKey`: 排序鍵，包含 `hitTypeRank`, `postAt`, `id`。

**Validation**

- `hitTypeRank`: title hit 優先於 content-only hit。
- 同層級排序為 `postAt desc`，時間相同時 `id desc`。
- snippet/highlight metadata 不得要求 UI 解析 HTML。

**Relationships**

- 屬於一個 `SearchResult`。
- 使用 `SearchKeyword` 產生。

**State transitions**

- `candidate` -> `excluded`: 不 active 或 title/content 不包含 keyword。
- `candidate` -> `matched`: active 且 title/content 命中。
- `matched` -> `rendered`: 已附加 interaction state 並進入 UI。

## SearchResult

搜尋頁一次載入或 load-more 後的結果集合。

**Fields**

- `keyword`: `SearchKeyword.value`。
- `items`: `PostSearchMatch[]`，已排序且以 post id 去重。
- `nextCursor`: `SearchPageCursor | null`。
- `hasMore`: 是否仍有候選集合可掃描。
- `status`: `idle | loading | success | empty | loadingMore | error`。
- `errorMessage`: 可見錯誤文案，例如「搜尋失敗，請稍後再試」。

**Validation**

- `items` 只包含 public active posts。
- 同一組搜尋結果內同一 post id 不得重複。
- `empty` 僅能在候選集合已結束且 `items.length === 0` 時出現。

**Relationships**

- `items` 由多個 `PostSearchMatch` 組成。
- `nextCursor` 指向下一批候選集合掃描起點。

**State transitions**

- `idle` -> `loading`: 有效 `q` 開始初始搜尋。
- `loading` -> `success`: 回傳一批結果。
- `loading` -> `empty`: 無符合結果且候選集合耗盡。
- `loading` -> `error`: 初始搜尋失敗。
- `success` -> `loadingMore`: sentinel 觸發載入更多。
- `loadingMore` -> `success`: 新結果去重後追加。
- `loadingMore` -> `error`: 載入更多失敗，保留既有 `items`。
- `error` -> `loading`: 使用者點擊 retry。

## SearchPageCursor

搜尋結果頁 load-more 的候選集合 cursor。

**Fields**

- `lastPostAt`: 最後掃描候選文章的 `postAt`。
- `lastPostId`: 最後掃描候選文章的 id。
- `scannedCount`: 本次搜尋已掃描候選數，用於量測與除錯。
- `resultCount`: 目前已回傳結果數。
- `exhausted`: 候選集合是否已耗盡。

**Validation**

- cursor 依候選集合排序 `postAt desc` + `id desc` 前進。
- cursor 記錄的是最後掃描候選，不一定是最後命中結果。
- `exhausted === true` 時不得再發出 load-more query。

**Relationships**

- `SearchResult.nextCursor` 使用此 model。
- repo cursor 對應 Firestore `startAfter(lastPostAt, lastPostId)`。

**State transitions**

- `initial`: 無 cursor，從最新候選文章開始。
- `advanced`: 掃描一頁或多頁候選後更新。
- `exhausted`: Firestore 候選頁不足或沒有更多 docs。

## PersonalizedInteractionState

登入使用者對搜尋結果文章的個人化互動狀態。

**Fields**

- `userUid`: 目前使用者 UID；匿名時為 null。
- `likedPostIds`: 使用者已按讚文章 id set。
- `favoritePostIds`: 使用者已收藏文章 id set。
- `isAuthor`: 對單篇 post 計算 `post.authorUid === userUid`。
- `canInteract`: 是否可執行需登入互動。

**Validation**

- 匿名使用者可以搜尋與進入詳文，但 `canInteract === false`。
- 登入使用者看到 liked/favorite/isAuthor 狀態。
- 作者操作只對 `isAuthor === true` 的文章顯示。

**Relationships**

- 合併到 `PostSearchMatch.post` 供 `PostCard` 顯示。
- 與既有 `hydratePosts` 行為保持一致。

**State transitions**

- `anonymous` -> `authenticated`: 登入後重新 hydrate 搜尋結果。
- `authenticated` -> `liked/unliked`: 按讚 optimistic update，失敗 rollback。
- `authenticated` -> `favorited/unfavorited`: 收藏 optimistic update，失敗 rollback。
- `authorVisible` -> `removed`: 作者刪除文章後，該結果從目前列表移除。
