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
    (
        # 增加延遲時間，確保 Terminal 已先印出 [y/N] 提示
        sleep 1.5
        # 1. 語音播報 (優先讀取本地名字檔，否則用預設稱呼)
        LOCAL_NAME=$(cat "$GEMINI_PROJECT_DIR/.gemini/.username" 2>/dev/null || echo "嘿")
        say -r 180 "$LOCAL_NAME 請你處理權限確認" &

        # 2. 發送 Click-to-Focus 通知 (使用 terminal-notifier)
        # 偵測目前使用的終端機 App Bundle ID (預設為 com.apple.Terminal)
        term_id="com.apple.Terminal"
        if [ "$TERM_PROGRAM" == "iTerm.app" ]; then
            term_id="com.googlecode.iterm2"
        elif [ "$TERM_PROGRAM" == "vscode" ]; then
            term_id="com.microsoft.VSCode"
        fi

        terminal-notifier \
            -title "⚠️ Gemini Action Required" \
            -message "需要確認權限，點擊此處回到終端機" \
            -sound default \
            -activate "$term_id"
    ) >/dev/null 2>&1 &
fi

# 5. 必須回傳一個有效的 JSON
echo "{}"
exit 0
