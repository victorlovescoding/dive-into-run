# Quickstart: 響應式導覽列 (RWD Navbar)

**Branch**: `010-responsive-navbar`

---

## 開發環境

```bash
npm run dev          # localhost:3000 — Hot reload
```

---

## 關鍵檔案

| File                                      | Purpose                                 |
| ----------------------------------------- | --------------------------------------- |
| `src/components/Navbar/Navbar.jsx`        | 主元件（新建）                          |
| `src/components/Navbar/Navbar.module.css` | 樣式（新建）                            |
| `src/lib/firebase-auth-helpers.js`        | Auth 服務層函式（新建）                 |
| `src/app/layout.jsx`                      | 引入 Navbar、更新 metadata/lang（修改） |
| `src/app/globals.css`                     | 移除舊 .main-nav 樣式（修改）           |
| `src/contexts/AuthContext.jsx`            | 認證 Context（唯讀參考）                |

---

## 測試

```bash
# Unit tests
npx vitest run specs/010-responsive-navbar/tests/unit/

# Integration tests
npx vitest run specs/010-responsive-navbar/tests/integration/

# E2E tests (需先啟動 dev server)
npx playwright test specs/010-responsive-navbar/tests/e2e/

# 單一測試檔案
npx vitest run specs/010-responsive-navbar/tests/integration/Navbar.test.jsx
```

---

## 驗證

```bash
npm run lint              # ESLint 全專案
npm run lint:changed      # 只 lint changed files
npm run type-check        # JSDoc type checking
npm run type-check:changed  # 只檢查 changed files
```

---

## 瀏覽器測試斷點

| 尺寸   | 用途                     |
| ------ | ------------------------ |
| 320px  | 最小手機（iPhone SE）    |
| 375px  | 標準手機（iPhone）       |
| 768px  | **斷點** — 切換手機/桌面 |
| 1024px | 平板/小桌面              |
| 1920px | 標準桌面                 |

---

## 相依圖

```text
layout.jsx
  └── <Navbar />
        ├── AuthContext (useContext)
        ├── usePathname() (next/navigation)
        ├── Link (next/link)
        └── firebase-auth-helpers.js
              ├── signInWithGoogle()
              └── signOutUser()
                    └── firebase-client.js (auth instance)
```
