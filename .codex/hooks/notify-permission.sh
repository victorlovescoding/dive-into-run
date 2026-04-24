#!/usr/bin/env bash

input=$(cat)

echo "--- Permission Request Received ---" >&2
echo "$input" >&2

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
) >/dev/null 2>&1 &

echo "{}"
exit 0
