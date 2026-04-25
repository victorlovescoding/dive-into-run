#!/usr/bin/env node

const fs = require('fs');

const input = fs.readFileSync(0, 'utf-8');
const data = JSON.parse(input);

const command = data.tool_input?.command || '';

function stripCommitMessage(cmd) {
  return cmd
    .replace(/(-m\s+)"(?:[^"\\]|\\.)*"/g, '$1""')
    .replace(/(-m\s+)'[^']*'/g, "$1''")
    .replace(/(-m\s+)\$\(cat\s+<<'?EOF'?[\s\S]*?EOF\s*\)/g, '$1""');
}

const commandToCheck = stripCommitMessage(command);

const dangerousPatterns = [
  // 1–2. rm 系統目錄 / rm *
  /rm\s+(-[a-zA-Z]+\s+)?(\/|~|\$HOME|\/etc|\/boot|\/var|\/usr|\/bin|\/sbin)/,
  /rm\s+(-[a-zA-Z]+\s+)?(\*|\.\*)/,
  // 3. Fork Bombs
  /:\(\)\s*\{\s*:\|:\s*&\s*\};:/,
  // 4. 盲目執行網路腳本
  /(curl|wget).+?\|\s*(sh|bash|zsh)/,
  // 5. 強制操作 (Git)
  /git\s+push\b[^\n]*?(?:(?:^|\s)-[a-zA-Z]*f[a-zA-Z]*(?=\s|$)|--force|\s\+\S+)/,
  /git\s+push\s+.*--delete\b/,
  /git\s+push\s+\S+\s+:\S+/,
  /git\s+reset\s+--hard/,
  /git\s+clean\b/,
  // 6. 權限與所有權變更
  /chmod\s+(-R\s+)?(777|666)/,
  /chown\s+(-R\s+)?root/,
  // 7. 系統級破壞指令
  /\b(mkfs|dd|fdisk|parted|reboot|shutdown|halt|poweroff)\b/,
  // 8. 寫入硬體裝置
  />\s*\/dev\/(sd[a-z]|nvme|hd[a-z])/,

  // --- 繞過防線 ---
  // 9–10. git commit --no-verify / -n
  /git\s+commit\s+.*--no-verify/,
  /git\s+commit\s+(-[a-zA-Z]*n|.*\s-[a-zA-Z]*n)/,
  // 11–12. git add -A / --all / .
  /git\s+add\s+(-A|--all)\b/,
  /git\s+add\s+\.(\s|$)/,
  // 13. git commit -a
  /git\s+commit\s+(-[a-zA-Z]*a|.*\s-[a-zA-Z]*a)/,

  // --- 不可逆改動 ---
  // 14. git branch -D
  /git\s+branch\s+.*-D\b/,
  // 15. git checkout --
  /git\s+checkout\s+--\s/,
  // 16. git restore
  /git\s+restore\b/,
  // 17. git rm -r
  /git\s+rm\s+.*-r/,
  // 18. find -delete
  /find\s+.*-delete/,

  // --- 權限與洩漏 ---
  // 19. sudo
  /\bsudo\b/,
  // 20. env / printenv
  /(?:^|[\s;|&])(?:env|printenv)(?:\s|$)/,
];

for (const pattern of dangerousPatterns) {
  if (pattern.test(commandToCheck)) {
    process.stderr.write(`[Security Hook] Blocked: ${command}\n`);
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `安全性攔截：此指令被標記為高風險 (${pattern})`,
        },
      }) + '\n',
    );
    process.exit(0);
  }
}

process.stdout.write('{}\n');
