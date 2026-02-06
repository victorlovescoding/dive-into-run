#!/usr/bin/env bash

# 1. 讀取輸入 (不要印出任何非 JSON 到 stdout)
input=$(cat)

# 2. 將輸入紀錄到 stderr (這會出現在 CLI 的 debug 資訊中，方便我們看發生什麼事)
echo "--- Notification Received ---" >&2
echo "$input" >&2

# 3. 解析通知類型
# 使用 jq 提取 notification_type，如果沒有則為空
type=$(echo "$input" | jq -r '.notification_type // empty')

# 4. 如果是權限請求，執行通知與語音
if [ "$type" == "ToolPermission" ]; then
    # 1. 先語音播報 (加上 & 讓它在背景講，接著馬上彈窗)
    say -r 180 "$(whoami) 請你處理權限確認" &
    
    # 2. 再發送 Mac 系統通知 (這行會等待使用者點擊按鈕才會結束，所以要在語音之後)
    osascript -e 'display alert "⚠️ Gemini Action Required" message "需要確認權限，請回到終端機處理" as critical'
fi

# 5. 必須回傳一個有效的 JSON
echo "{}"
exit 0
