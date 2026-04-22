#!/usr/bin/env bash

# 1. 讀取輸入 (不要印出任何非 JSON 到 stdout)
input=$(cat)

# 2. 將輸入紀錄到 stderr (方便 debug)
echo "--- Permission Request Received ---" >&2
echo "$input" >&2

# 3. 執行通知與語音 (PermissionRequest event 本身就代表需要確認，不需額外判斷 type)
(
    # 增加延遲時間，確保 Terminal 已先印出提示
    sleep 1.5

    PROJECT_DIR="${CODEX_PROJECT_DIR:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"

    # 1. 語音播報 (優先讀取本地名字檔，否則用預設稱呼)
    LOCAL_NAME=$(
        cat "$PROJECT_DIR/.codex/.username" 2>/dev/null \
            || cat "$PROJECT_DIR/.claude/.username" 2>/dev/null \
            || echo "嘿"
    )
    if command -v say >/dev/null 2>&1; then
        say -r 180 "$LOCAL_NAME 請你處理權限確認" &
    fi

    # 2. 發送 Click-to-Focus 通知 (使用 terminal-notifier)
    # 偵測目前使用的終端機 App Bundle ID
    term_id="com.apple.Terminal"
    if [ "$TERM_PROGRAM" = "iTerm.app" ]; then
        term_id="com.googlecode.iterm2"
    elif [ "$TERM_PROGRAM" = "vscode" ]; then
        term_id="com.microsoft.VSCode"
    fi

    if command -v terminal-notifier >/dev/null 2>&1; then
        terminal-notifier \
            -title "⚠️ Codex Action Required" \
            -message "需要確認權限，點擊此處回到終端機" \
            -sound default \
            -activate "$term_id"
    fi
) >/dev/null 2>&1 &

# 4. 回傳空 JSON，不干預權限決定（讓使用者自行確認）
echo "{}"
exit 0
