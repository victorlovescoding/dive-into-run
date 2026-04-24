#!/usr/bin/env node

/**
 * 阻擋危險指令 Hook
 * 用途：防止 AI 執行可能導致資料遺失或系統損壞的 Shell 指令
 */

const fs = require('fs');

// 讀取 stdin 輸入
const input = fs.readFileSync(0, 'utf-8');
const data = JSON.parse(input);

// 只檢查 PreToolUse 事件且工具為 Bash (Claude Code 的 shell 工具名稱)
if (data.hook_event_name !== 'PreToolUse' || data.tool_name !== 'Bash') {
  console.log(JSON.stringify({})); // 不是目標事件，放行
  process.exit(0);
}

// 取得欲執行的指令
const command = data.tool_input?.command || '';

// 剝掉 git commit -m 的 message 內容，避免 commit message 文字觸發 false positive
// 只剝 -m 參數，其餘 flags（如 --no-verify）仍會被掃描
function stripCommitMessage(cmd) {
  return cmd
    .replace(/(-m\s+)"(?:[^"\\]|\\.)*"/g, '$1""')
    .replace(/(-m\s+)'[^']*'/g, "$1''")
    .replace(/(-m\s+)\$\(cat\s+<<'?EOF'?[\s\S]*?EOF\s*\)/g, '$1""');
}

const commandToCheck = stripCommitMessage(command);

// 定義危險指令的正則表達式 (Regex)
// 策略：以爆炸半徑分層 — 批次/遞迴操作硬擋，單檔操作靠 permission prompt
const dangerousPatterns = [
  // 1. 刪除根目錄、家目錄或敏感目錄
  /rm\s+(-[a-zA-Z]+\s+)?(\/|~|\$HOME|\/etc|\/boot|\/var|\/usr|\/bin|\/sbin)/,

  // 2. 刪除所有內容 (rm -rf * 或 .*)
  /rm\s+(-[a-zA-Z]+\s+)?(\*|\.\*)/,

  // 3. Fork Bombs
  /:\(\)\s*\{\s*:\|:\s*&\s*\};:/,

  // 4. 盲目執行網路腳本
  /(curl|wget).+?\|\s*(sh|bash|zsh)/,

  // 5. 強制操作 (Git)
  /git\s+push\s+.*(-f|--force)/,
  /git\s+reset\s+--hard/,
  /git\s+clean\b/,

  // 6. 權限與所有權變更
  /chmod\s+(-R\s+)?(777|666)/,
  /chown\s+(-R\s+)?root/,

  // 7. 系統級破壞指令
  /\b(mkfs|dd|fdisk|parted|reboot|shutdown|halt|poweroff)\b/,

  // 8. 寫入硬體裝置
  />\s*\/dev\/(sd[a-z]|nvme|hd[a-z])/,

  // --- 繞過防線 (bypass prevention) ---

  // 9. git commit --no-verify (繞過 pre-commit hook)
  /git\s+commit\s+.*--no-verify/,

  // 10. git commit -n (--no-verify 短寫，含 -nm 等組合)
  /git\s+commit\s+(-[a-zA-Z]*n|.*\s-[a-zA-Z]*n)/,

  // 11. git add -A / --all (意外 stage .env、secrets)
  /git\s+add\s+(-A|--all)\b/,

  // 12. git add . (意外 stage 所有檔案)
  /git\s+add\s+\.(\s|$)/,

  // 13. git commit -a (auto-stage 所有修改，含 -am 等組合)
  /git\s+commit\s+(-[a-zA-Z]*a|.*\s-[a-zA-Z]*a)/,

  // --- 不可逆改動 (irreversible changes) ---

  // 14. git branch -D (強制刪分支，不檢查 merge 狀態)
  /git\s+branch\s+.*-D\b/,

  // 15. git checkout -- (丟棄未 commit 改動)
  /git\s+checkout\s+--\s/,

  // 16. git restore (丟棄改動)
  /git\s+restore\b/,

  // 17. git rm -r (遞迴刪除檔案)
  /git\s+rm\s+.*-r/,

  // 18. find -delete (批次刪除)
  /find\s+.*-delete/,

  // --- 權限與洩漏 (privilege & leak) ---

  // 19. sudo (提權)
  /\bsudo\b/,

  // 20. env / printenv (洩漏環境變數含 secrets)
  /(?:^|[\s;|&])(?:env|printenv)(?:\s|$)/,
];

// 檢查是否匹配任何危險模式（用剝掉 message 的版本比對）
for (const pattern of dangerousPatterns) {
  if (pattern.test(commandToCheck)) {
    console.error(`[Security Hook] Blocked command: ${command}`);

    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `🚫 安全性攔截：此指令被標記為高風險 (${pattern})，已自動阻擋。`,
        },
      }),
    );
    process.exit(0);
  }
}

// 安全，放行
console.log(JSON.stringify({}));
process.exit(0);
