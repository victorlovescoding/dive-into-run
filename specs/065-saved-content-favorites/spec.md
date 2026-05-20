# 收藏文章與活動 Spec

## Summary

新增私人內容收藏功能，讓登入會員可以收藏文章與活動，並從會員頁進入獨立收藏頁管理自己的收藏清單。

此功能只服務「自己稍後回來看」的使用情境，不建立公開收藏數、他人可見收藏清單、熱門收藏或推薦機制。

## User Scenarios

- 使用者在文章列表看到想稍後閱讀的文章，按下 bookmark 後看到成功 toast，之後可在會員收藏頁找到該文章。
- 使用者在活動列表看到感興趣的活動，按下 bookmark 後看到成功 toast，之後可在會員收藏頁找到該活動。
- 使用者進入文章或活動詳情頁時，可以看到該內容是否已收藏，並可在詳情頁收藏或取消收藏。
- 未登入訪客按收藏按鈕時，不會寫入資料，畫面顯示請先登入的 toast。
- 使用者在 `/member` 點「我的收藏」入口後進入 `/member/favorites`，用「收藏文章」與「收藏活動」兩個 tab 分別瀏覽。
- 使用者在收藏頁點一張已收藏文章或活動卡片時，會進入對應 `/posts/[id]` 或 `/events/[id]` 詳情頁。
- 使用者在收藏頁取消收藏時，該項目先從列表消失，toast 提供復原操作。
- 收藏目標已被刪除時，收藏頁顯示內容已不存在，並允許使用者移除該收藏紀錄。

## Requirements

- FR-001: 收藏資料必須是私人資料，只有收藏者本人可以讀取、建立與刪除。
- FR-002: 收藏資料必須分別儲存在 `users/{uid}/favoritePosts/{postId}` 與 `users/{uid}/favoriteEvents/{eventId}`。
- FR-003: 每筆收藏文件只保存目標 id 與收藏時間，不複製文章或活動的 title、summary、作者或活動資訊。
- FR-004: 收藏文件必須使用目標內容 id 作為 document id，以避免同一使用者重複收藏同一內容。
- FR-005: 收藏頁必須以收藏文件的 `createdAt` 由新到舊排序。
- FR-006: 收藏頁顯示內容時，必須用收藏文件的目標 id 讀取最新 `posts/{postId}` 或 `events/{eventId}` 資料。
- FR-007: 文章列表、文章詳情、活動列表、活動詳情都必須提供收藏按鈕。
- FR-008: 收藏按鈕必須使用 IG-style bookmark 外觀；未收藏為空心，已收藏為填滿。
- FR-009: 收藏按鈕必須是可鍵盤操作的 button，並提供清楚的 `aria-label` 與 pressed 狀態。
- FR-010: 未登入使用者按收藏時，必須顯示「請先登入才能收藏」toast。
- FR-011: 收藏成功時，必須顯示「已加入收藏」toast。
- FR-012: 收藏失敗時，必須顯示「收藏失敗，請稍後再試」toast，並回復 UI 狀態。
- FR-013: 取消收藏成功時，必須顯示「已取消收藏」toast。
- FR-014: 取消收藏失敗時，必須顯示「取消收藏失敗，請稍後再試」toast，並回復 UI 狀態。
- FR-015: `/member` 必須提供「我的收藏」入口，連到 `/member/favorites`。
- FR-016: `/member/favorites` 必須有「收藏文章」與「收藏活動」兩個 tab。
- FR-017: 收藏頁的文章與活動卡片必須可以導到對應詳情頁。
- FR-018: 收藏頁取消收藏後必須支援 toast 復原，復原成功後項目回到收藏清單。
- FR-019: 收藏目標不存在時，收藏頁不得整頁錯誤；該項目必須顯示為已不存在並允許取消收藏。
- FR-020: Firestore rules 必須限制 `favoritePosts` 與 `favoriteEvents` 只能由本人讀寫，且不允許 update。
- FR-021: 文章河道的每篇文章都必須有收藏按鈕，使用者不需點進詳文頁才能收藏。
- FR-022: 文章河道收藏按鈕必須放在每篇文章底部互動列的最右側，而且是該互動列容器的最右側；不得只接在按讚與留言 icon group 旁。
- FR-023: 文章詳文頁收藏按鈕必須放在文章本文下方的互動列最右側。
- FR-024: 活動河道的每張活動卡都必須有收藏按鈕；位置必須在卡片右上角 action cluster，靠近三點操作選單，但收藏按鈕必須是獨立 button，不得放進作者或主揪操作選單。
- FR-025: 活動詳情頁收藏按鈕必須放在卡片標題區右上角 action cluster，靠近分享按鈕、狀態 pill、三點操作選單那組操作區，且必須是獨立 button。

## Success Criteria

- 已登入使用者能從文章列表與詳情頁收藏、取消收藏文章，並看到對應 toast 與 icon 狀態。
- 文章河道每篇文章的 bookmark button 位於底部互動列容器的最右側；文章詳文頁 bookmark button 位於本文下方互動列最右側。
- 已登入使用者能從活動列表與詳情頁收藏、取消收藏活動，並看到對應 toast 與 icon 狀態。
- 活動河道每張活動卡的 bookmark button 位於右上角 action cluster，靠近但不併入三點操作選單；活動詳情頁 bookmark button 位於標題區右上角操作區。
- 未登入使用者按任一收藏按鈕不會寫入 Firestore，並看到請先登入 toast。
- `/member/favorites` 能分 tab 顯示收藏文章與收藏活動，排序為最新收藏在上。
- 收藏頁卡片點擊後能導到對應文章或活動詳情頁。
- 收藏頁取消收藏後能透過 toast 復原。
- 被刪除的收藏目標在收藏頁呈現缺失狀態，不阻斷其他收藏項目。
- Rules 測試證明使用者不能讀寫其他人的 `favoritePosts` 或 `favoriteEvents`。

## Out Of Scope

- 公開收藏數。
- 他人可見收藏清單。
- 收藏分類、標籤、備註。
- 手動排序。
- 收藏通知。
- 推薦內容、熱門收藏或排行榜。
- 新增 icon dependency。
- 複製 title、summary 或其他內容 snapshot 到收藏文件。

## User Authorization

- Draft preservation and artifact repair approved by: user, 2026-05-19.
- Written spec approved by: user, 2026-05-19.
- Repo doc persistence: long-term repo doc.
- One-time automated execution authorization: no; implementation, commit, push, pull request, merge, and local main sync each still require explicit authorization.
