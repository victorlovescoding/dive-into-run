# Data Model: Posts Input Validation

**Branch**: `018-posts-input-validation` | **Date**: 2026-04-15

---

## Entities

### Post (existing — Firestore `posts` collection)

本次不修改 Firestore schema，僅在寫入前增加驗證。

| Field           | Type             | Required | Validation Rule                     |
| --------------- | ---------------- | -------- | ----------------------------------- |
| `title`         | `string`         | ✅       | trim 後非空、`length ≤ 50`          |
| `content`       | `string`         | ✅       | trim 後非空、`length ≤ 10,000`      |
| `authorUid`     | `string`         | ✅       | (既有，不在本次驗證範圍)            |
| `authorImgURL`  | `string \| null` | ❌       | (既有，不在本次驗證範圍)            |
| `postAt`        | `Timestamp`      | ✅       | (serverTimestamp，不在本次驗證範圍) |
| `likesCount`    | `number`         | ✅       | (init 0，不在本次驗證範圍)          |
| `commentsCount` | `number`         | ✅       | (init 0，不在本次驗證範圍)          |

### Validation Constants (new exports)

| Constant                  | Value   | Source |
| ------------------------- | ------- | ------ |
| `POST_TITLE_MAX_LENGTH`   | `50`    | FR-003 |
| `POST_CONTENT_MAX_LENGTH` | `10000` | FR-004 |

---

## Validation Rules

### 驗證順序（priority order）

依 spec clarification：多重錯誤只顯示第一個，順序為 title → content。

```text
1. title trim 後為空 AND content trim 後為空 → '請輸入標題和內容'  (US1-AC3)
2. title trim 後為空                          → '請輸入標題'        (US1-AC1)
3. content trim 後為空                        → '請輸入內容'        (US1-AC2)
4. title trim 後 length > 50                  → '標題不可超過 50 字' (US2-AC1)
5. content trim 後 length > 10,000            → '內容不可超過 10,000 字' (US2-AC2)
```

### 共用行為

- **Trim**: 所有驗證在 `(value ?? '').trim()` 後的值上運作（FR-009）
- **字數計算**: `string.length`（與 event comments 一致，spec assumption）
- **套用時機**: create 和 update 皆適用（FR-008）

---

## State Transitions

本次 feature 不涉及狀態機。Post 的生命週期（create → read → update → delete）不受影響，僅在 create/update 入口增加 guard。

```text
[User submits form]
    │
    ▼
[validatePostInput]──error──▶ [showToast + early return] (UI layer)
    │                         [throw Error]              (service layer)
    │ pass
    ▼
[Firestore write] (unchanged)
```
