#!/usr/bin/env bash

# 1. 讀取輸入 (不要印出任何非 JSON 到 stdout)
input=$(cat)

# 2. 將輸入紀錄到 stderr (方便 debug)
echo "--- Permission Request Received ---" >&2
echo "$input" >&2

# 3. 來自 subagent 的觸發不發聲：subagent 內部需要權限時，主對話 UI 不會跳 dialog 給用戶，
#    所以通知等於誤響。靠 top-level agent_id 區分（官方文件保證此欄位僅在 subagent context 出現）。
if echo "$input" | jq -e '.agent_id' >/dev/null 2>&1; then
  agent_type=$(echo "$input" | jq -r '.agent_type // "unknown"')
  echo "--- Skipped: triggered by subagent ($agent_type) ---" >&2
  echo "{}"
  exit 0
fi

# 4. 發送 macOS Notification Center 通知（內建 osascript，零依賴）
(
    # 增加延遲時間，確保 Terminal 已先印出提示
    sleep 1.5

    osascript -e 'display notification "需要確認權限" with title "⚠️ Claude Code Action Required" sound name "default"'
) >/dev/null 2>&1 &

# 5. 回傳空 JSON，不干預權限決定（讓使用者自行確認）
echo "{}"
exit 0
