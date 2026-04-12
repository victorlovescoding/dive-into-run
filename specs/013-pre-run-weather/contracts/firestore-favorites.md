# Firestore Contract: Weather Favorites

**Collection**: `users/{uid}/weatherFavorites`
**Service**: `src/lib/firebase-weather-favorites.js`

---

## Document Schema

```js
{
  countyCode: "63000",          // string, required
  countyName: "臺北市",         // string, required
  townshipCode: "63000060",     // string | null (null = 縣市級收藏)
  townshipName: "大安區",       // string | null
  displaySuffix: null,          // string | null (僅龜山島有 "（含龜山島）")
  createdAt: Timestamp          // serverTimestamp()
}
```

---

## Service Functions

### `addFavorite(uid, location)`

新增收藏。先檢查重複（同 countyCode + townshipCode），已存在則 no-op。

```js
/**
 * 新增天氣收藏地點���
 * @param {string} uid - 使用者 UID。
 * @param {object} location - 收藏地點。
 * @param {string} location.countyCode - 縣市代碼。
 * @param {string} location.countyName - 縣市名。
 * @param {string | null} location.townshipCode - 鄉鎮代碼。
 * @param {string | null} location.townshipName - 鄉鎮名。
 * @param {string | null} [location.displaySuffix] - 龜山島��綴。
 * @returns {Promise<string>} 新文件 ID，或已存在文件 ID。
 */
```

### `removeFavorite(uid, docId)`

移除收藏。

```js
/**
 * 移除天氣收藏地點。
 * @param {string} uid - 使用者 UID。
 * @param {string} docId - Firestore 文件 ID。
 * @returns {Promise<void>}
 */
```

### `getFavorites(uid)`

取得使用者所有收藏，按 createdAt 降序。

```js
/**
 * 取得使用者所有天氣收藏地點。
 * @param {string} uid - 使用者 UID。
 * @returns {Promise<Array<import('../specs/013-pre-run-weather/data-model').FavoriteLocation>>}
 */
```

### `isFavorited(uid, countyCode, townshipCode)`

檢查特定地點是否已收藏。

```js
/**
 * 檢查地點是否已收藏。
 * @param {string} uid - 使用者 UID。
 * @param {string} countyCode - 縣市代碼。
 * @param {string | null} townshipCode - 鄉鎮代碼。
 * @returns {Promise<{favorited: boolean, docId: string | null}>}
 */
```

---

## Security Rules

```
match /users/{uid}/weatherFavorites/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

---

## Indexes

無需自訂 composite index。`orderBy('createdAt', 'desc')` 只需單欄位索引（Firestore 自動建立）。

---

## Optimistic Update Pattern

```
1. UI immediately updates (add/remove favorite)
2. Firestore write in background
3. On success: no-op (UI already correct)
4. On failure: rollback UI state + toast "操作失敗，請稍後再試"
```

Ref: FR-035
