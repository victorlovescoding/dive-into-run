# 服務合約：活動篩選

**模組**: `src/lib/firebase-events.js`

## 函式 (Functions)

### `queryEvents(filters)`

執行混合式查詢以取得符合指定標準的活動。

**簽署 (Signature)**:

```javascript
export async function queryEvents(filters: FilterOptions): Promise<Event[]>
```

**型別 (Types)**:

```typescript
type FilterOptions = {
  // Firestore 層級 (相等比對 Equality)
  city?: string; // 例如："臺北市"
  district?: string; // 例如："信義區"

  // Firestore 層級 (範圍比對 - 主要 Primary)
  startTime?: Date; // 篩選在此時間之後開始的活動
  endTime?: Date; // 篩選在此時間之前開始的活動

  // 記憶體層級 (範圍比對 - 次要 Secondary)
  minDistance?: number; // 公里 (包含)
  maxDistance?: number; // 公里 (包含)

  // 記憶體層級 (布林值 Boolean)
  hasSeatsOnly?: boolean; // 若為 true，過濾掉 remainingSeats <= 0 的活動
};

type Event = {
  id: string;
  title: string;
  city: string;
  district: string;
  time: Timestamp;
  distanceKm: number;
  remainingSeats: number;
  // ... 其他現有欄位
};
```

**行為 (Behavior)**:

1.  根據 `city`, `district`, `startTime`, `endTime` 構建 Firestore `Query`。
    - 一律按 `time` 排序 (降冪/由新到舊)。
    - 限制結果集為 10 筆 (未來視需求增加分頁游標支援，但 MVP 先載入 10 筆)。
2.  獲取資料 (`getDocs`)。
3.  在記憶體中過濾結果集：
    - `distanceKm`: 套用 `[min - 0.5, max + 0.5]` 的寬容度 (對應 US2 測試)。
    - `remainingSeats`: 若 `hasSeatsOnly` 為 true，檢查是否 `> 0` (對應 US3 測試)。
4.  回傳過濾後的 `Event` 物件陣列 (確保包含 `id` 以供前端導航使用 - 對應 FR-007)。

**錯誤處理 (Error Handling)**:

- 若 Firestore 網路請求失敗，拋出錯誤。
- 若無匹配文件，回傳空陣列 `[]`。
