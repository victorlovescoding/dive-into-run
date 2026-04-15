# Research: Posts 頁面 UI 重新設計

**Branch**: `019-posts-ui-refactor` | **Date**: 2026-04-15

## R1: 內容展開動畫方案

**Decision**: CSS `max-height` transition + JS `scrollHeight` 量測

**Rationale**:

- `max-height` transition 是最廣泛支援的 CSS 高度動畫方案（所有現代瀏覽器）
- 搭配 `ref.current.scrollHeight` 精確量測目標高度，避免 `max-height: 9999px` 的計時偏差問題
- `transitionend` 事件後移除 `max-height` 限制，確保後續視窗 resize 時內容正確自適應
- 動畫時長 250ms（spec 指定 200-300ms 範圍）搭配 `ease` timing function

**Alternatives considered**:

1. **CSS Grid `0fr→1fr`**: 適用於「完全隱藏→完全顯示」場景，不適用於本案的「部分可見（截斷）→全部可見」需求
2. **Web Animations API**: 可精確控制動畫，但增加 JS 複雜度，且 `max-height` transition 已足夠
3. **純文字切換（無動畫）**: 不滿足 FR-007 平滑過渡要求

**Implementation sketch**:

```jsx
// PostCard 內部
const contentRef = useRef(null);
const [isExpanded, setIsExpanded] = useState(false);

function handleExpand() {
  const el = contentRef.current;
  // 先設定為當前 scrollHeight 觸發 transition
  el.style.maxHeight = `${el.scrollHeight}px`;
  setIsExpanded(true);
}

// transitionend 後移除 max-height 限制
function handleTransitionEnd() {
  if (isExpanded) {
    contentRef.current.style.maxHeight = 'none';
  }
}
```

## R2: 骨架屏動畫方案

**Decision**: CSS Modules shimmer 動畫（`linear-gradient` + `background-size` + `@keyframes`）

**Rationale**:

- 純 CSS 實作，無 JS runtime 成本
- shimmer 是社群平台業界標準（Facebook, LinkedIn, Twitter）
- CSS Modules 確保樣式隔離，不污染全域命名空間
- 使用 `background-size: 200% 100%` + `translateX` 動畫，GPU 加速

**Alternatives considered**:

1. **Pulse（opacity 閃爍）**: 視覺效果弱於 shimmer，無方向性
2. **Skeleton library（react-loading-skeleton）**: 引入額外依賴，違反 MVP 思維
3. **Lottie 動畫**: 過度設計

**Implementation sketch**:

```css
.skeleton {
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

## R3: `<dialog>` Modal 最佳實踐

**Decision**: 使用 HTML `<dialog>` 元素的 `showModal()` API

**Rationale**:

- 原生 focus trap：`showModal()` 自動將 focus 限制在 dialog 內
- 原生 backdrop：`::backdrop` pseudo-element，可自定義樣式
- 原生 Escape 關閉：`cancel` event
- 原生 inert：開啟時背景元素自動不可互動
- 瀏覽器支援：Chrome 37+, Safari 15.4+, Firefox 98+ — 覆蓋所有目標使用者

**Safari 注意事項**:

- `::backdrop` 點擊事件：Safari 15.4–16.3 需要在 `<dialog>` 本身加 `onClick` 並檢查 `e.target === dialogRef.current`，因為 `::backdrop` 不是真正的 DOM 元素，不會觸發事件
- 解法：dialog click handler 中判斷點擊位置是否在 dialog bounding rect 外

**Alternatives considered**:

1. **Portal + overlay 自建 modal**: 需手工處理 focus trap、scroll lock、`aria-modal`、inert — 大量 a11y 工作
2. **Headless UI / Radix Dialog**: 引入額外依賴、增加 bundle size
3. **Inline form（現有方式）**: 不滿足 FR-012 Modal 彈窗要求

**Implementation sketch**:

```jsx
const dialogRef = useRef(null);

function openModal() {
  dialogRef.current?.showModal();
}

function handleBackdropClick(e) {
  // 點擊 backdrop（dialog 外部）時關閉
  const rect = dialogRef.current.getBoundingClientRect();
  if (
    e.clientX < rect.left ||
    e.clientX > rect.right ||
    e.clientY < rect.top ||
    e.clientY > rect.bottom
  ) {
    dialogRef.current.close();
  }
}
```

## R4: 相對時間格式化

**Decision**: 複用既有 `src/lib/notification-helpers.js` 的 `formatRelativeTime()`

**Rationale**:

- 已實作完整格式：「剛剛 / N 分鐘前 / N 小時前 / N 天前 / M/D」
- 接受 `Date` 或 Firestore `Timestamp` 物件
- spec Assumptions 明確指出「沿用現有實作邏輯」
- 不需新增依賴或自行實作

**Alternatives considered**:

1. **`date-fns/formatDistanceToNow`**: 引入新依賴，且中文化需額外設定
2. **Intl.RelativeTimeFormat**: 原生 API 但需手動計算 diff 與選擇 unit，與現有函式重複
3. **新建 helper**: 違反 DRY 原則

## R5: 150 字截斷邏輯

**Decision**: 使用 JavaScript `String.prototype.slice(0, 150)` 搭配展開狀態切換

**Rationale**:

- spec Assumptions 明確指出「150 字指 Unicode 字元數（含中文字），非 byte 數」
- JS 字串的 `.length` 和 `.slice()` 以 UTF-16 code unit 計算，對 BMP 字元（含所有 CJK 基本漢字）等同於 Unicode 字元數
- Edge case：emoji（surrogate pairs）在 UTF-16 會算 2 個 code unit，但 spec 未特別提及 emoji 處理，以一般文字為主

**邊界條件**:

- 剛好 150 字：不截斷，直接顯示完整內容（spec Edge Cases）
- 151 字：截斷至 150 字 + 「......」 + 「查看更多」（spec Edge Cases）
- 無內容（僅標題）：內容區域不顯示截斷機制

**Alternatives considered**:

1. **`Intl.Segmenter`**: 更精確的 grapheme cluster 計算，但 spec 以「字」為單位，UTF-16 已足夠
2. **CSS `line-clamp`**: 以行數而非字數截斷，不符合 spec 的 150 字要求
3. **Server-side truncation**: 增加 service layer 變更，違反 FR-024

## R6: Feed 置中窄欄佈局

**Decision**: `max-width: 680px; margin: 0 auto; padding: 0 1rem` 搭配響應式

**Rationale**:

- FR-004a 指定 max-width 約 640-680px，取 680px 留給內容更多呼吸空間
- `margin: 0 auto` 水平置中
- 行動裝置（<680px）時 padding 提供邊距，避免貼邊
- 與社群平台慣例一致（Twitter/X feed 寬度約 598px，Facebook 約 680px）

**Alternatives considered**:

1. **640px**: spec 範圍下限，略窄但可接受
2. **100% width**: 違反 FR-004a
3. **CSS container queries**: 過度設計，`max-width` + `margin: auto` 已足夠
