# Quickstart: 全域 Toast 通知系統

**Branch**: `009-global-toast` | **Date**: 2026-04-08

## 使用方式

### 1. 在任何 Client Component 中顯示 Toast

```js
import { useToast } from '@/contexts/ToastContext';

function MyComponent() {
  const { showToast } = useToast();

  async function handleAction() {
    try {
      await doSomething();
      showToast('操作成功！'); // 預設 success
    } catch (err) {
      showToast('操作失敗，請稍後再試', 'error'); // error 不自動消失
    }
  }

  return <button onClick={handleAction}>執行</button>;
}
```

### 2. 三種 Toast 類型

```js
showToast('儲存成功', 'success'); // 綠色，3 秒自動消失
showToast('發生錯誤', 'error'); // 紅色，需手動關閉
showToast('已複製連結', 'info'); // 藍色，3 秒自動消失
```

### 3. 不需要的事

- **不需要** import Toast 元件 — `ToastContainer` 已在 `layout.jsx` 全域掛載
- **不需要** 管理 Toast state — Context 處理一切
- **不需要** 手動設定 timer — success/info 自動消失
- **不需要** 處理動畫 — CSS transition 自動處理

## 遷移指南（取代舊模式）

### 舊：actionMessage state

```diff
- const [actionMessage, setActionMessage] = useState(null);
+ const { showToast } = useToast();

- setActionMessage({ type: 'success', message: '報名成功' });
+ showToast('報名成功');

- setActionMessage({ type: 'error', message: '報名失敗' });
+ showToast('報名失敗', 'error');

  // 移除 actionMessage JSX 區塊和對應的 CSS classes
```

### 舊：window.alert()

```diff
+ const { showToast } = useToast();

- window.alert('刪除失敗，請稍後再試');
+ showToast('刪除失敗，請稍後再試', 'error');
  // 同時移除 eslint-disable 註解
```

### 舊：console.error only（靜默失敗）

```diff
+ const { showToast } = useToast();

  } catch (err) {
    console.error(err);
+   showToast('操作失敗，請稍後再試', 'error');
  }
```

### 舊：disconnectError inline

```diff
- const [disconnectError, setDisconnectError] = useState(null);
+ const { showToast } = useToast();

- setDisconnectError('取消連結失敗，請稍後再試');
+ showToast('取消連結失敗，請稍後再試', 'error');

  // 移除 disconnectError JSX 區塊
```
