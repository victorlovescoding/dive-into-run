# 單元測試：活動篩選純邏輯 (Unit Testing)

**目標模組**: `src/lib/firebase-events.js`
**測試範圍**: 商業邏輯、資料轉換、Firestore 查詢建構。

## 規範
- **禁止使用**: DOM, React Testing Library, user-event。
- **重點**: 測試 `queryEvents` 的過濾邏輯是否正確（如：距離計算、名額過濾）。

## AAA 範例
```javascript
test('計算剩餘名額應正確過濾 (範例)', () => {
  // Arrange (準備)
  const event = { maxParticipants: 10, participantCount: 7 };
  
  // Act (執行)
  // 假設有一個 calculateRemainingSeats 函式
  const remaining = event.maxParticipants - event.participantCount;
  
  // Assert (驗證)
  expect(remaining).toBe(3);
});
```

## 測試情境
1. **單一地點篩選 (US4)**: 驗證縣市過濾邏輯。
2. **距離寬容度 (US2)**: 驗證 ±0.5km 的計算邏輯。
3. **名額狀況 (US3)**: 驗證 `remainingSeats` 過濾。
4. **邊界情況**: 無效輸入、空值處理。