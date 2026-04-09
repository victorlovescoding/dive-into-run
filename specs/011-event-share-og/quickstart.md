# Quickstart: 活動分享 + Open Graph

**Feature**: 011-event-share-og

---

## 開發環境

```bash
npm run dev          # 啟動 dev server on localhost:3000
```

## 本地測試 OG Metadata

OG metadata 在 server-side 產生，可直接檢視 HTML source：

```bash
# 檢視活動頁 OG tags
curl -s http://localhost:3000/events/{eventId} | grep -E 'og:|twitter:'

# 或在瀏覽器 DevTools > Elements > <head> 搜尋 "og:"
```

## 社群平台 OG 驗證工具

部署後可用以下工具驗證預覽卡片：

- **Facebook**: https://developers.facebook.com/tools/debug/
- **X (Twitter)**: https://cards-dev.twitter.com/validator
- **LINE**: 直接分享連結到 LINE 聊天室即可預覽

## 測試分享按鈕

### Mobile（手機）

1. 開啟活動或文章詳情頁
2. 點擊分享按鈕（share icon）
3. 預期：系統原生分享面板跳出

### Desktop（桌面）

1. 開啟活動或文章詳情頁
2. 點擊分享按鈕
3. 預期：顯示「已複製連結」toast 提示
4. 貼上剪貼簿內容，確認是正確的頁面 URL

## 跑測試

```bash
# Unit tests（og-helpers）
npx vitest run specs/011-event-share-og/tests/unit/

# Integration tests（ShareButton）
npx vitest run specs/011-event-share-og/tests/integration/

# All tests
npm run test
```

## 相關檔案

| 檔案                                    | 用途                            |
| --------------------------------------- | ------------------------------- |
| `src/lib/og-helpers.js`                 | OG description 格式化、文字處理 |
| `src/components/ShareButton.jsx`        | 共用分享按鈕元件                |
| `src/components/ShareButton.module.css` | 分享按鈕樣式                    |
| `src/app/events/[id]/page.jsx`          | 活動頁 generateMetadata         |
| `src/app/posts/[id]/page.jsx`           | 文章頁 generateMetadata         |
| `src/app/layout.jsx`                    | metadataBase 設定               |
| `public/og-default.png`                 | 品牌預設 OG 圖片                |
