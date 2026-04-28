#!/usr/bin/env bash

input=$(cat)

echo "--- Permission Request Received ---" >&2
echo "$input" >&2

# 防禦性檢查：來自 subagent 的觸發不發聲。Codex 目前 PermissionRequest payload 沒有
# agent_id 欄位（codex-rs/hooks/src/events/permission_request.rs build_command_input），
# 所以這段現在是 noop；保留語意跟 .claude/hooks/notify-permission.sh 一致，未來
# Codex 若加 subagent 機制可自動防呆。
if command -v jq >/dev/null 2>&1 && echo "$input" | jq -e '.agent_id' >/dev/null 2>&1; then
  agent_type=$(echo "$input" | jq -r '.agent_type // "unknown"')
  echo "--- Skipped: triggered by subagent ($agent_type) ---" >&2
  echo "{}"
  exit 0
fi

(
    sleep 1.5

    LOCAL_NAME=$(cat .codex/.username 2>/dev/null || cat .claude/.username 2>/dev/null || echo "嘿")
    if command -v say >/dev/null 2>&1; then
        say -r 180 "$LOCAL_NAME 請你處理權限確認" &
    fi

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

    webhook_url="${DISCORD_WEBHOOK_URL:-}"
    if [ -z "$webhook_url" ] && [ -f "$HOME/.codex/discord-webhook-url" ]; then
        webhook_url=$(tr -d '\r\n' < "$HOME/.codex/discord-webhook-url")
    fi

    if [ -n "$webhook_url" ] && command -v curl >/dev/null 2>&1; then
        curl -s -X POST "$webhook_url" \
            -H 'Content-Type: application/json' \
            -d '{"content":"⚠️ Codex 需要權限確認，快去 App 看！"}'
    fi
) >/dev/null 2>&1 &

echo "{}"
exit 0
