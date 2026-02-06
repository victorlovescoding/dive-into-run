#!/usr/bin/env node

/**
 * 阻擋危險指令 Hook
 * 用途：防止 AI 執行可能導致資料遺失或系統損壞的 Shell 指令
 */

const fs = require('fs');

// 讀取 stdin 輸入
const input = fs.readFileSync(0, 'utf-8');
const data = JSON.parse(input);

// 只檢查 PreToolUse 事件且工具為 run_shell_command (或類似名稱)
// 注意：Gemini CLI 的 shell 工具名稱通常是 "run_shell_command" 或 "run_command"
// 我們這裡檢查所有 shell 相關的工具
const targetTools = ['run_shell_command', 'run_command', 'bash', 'sh'];
if (data.hook_event_name !== 'PreToolUse' || !targetTools.includes(data.tool_name)) {
  console.log(JSON.stringify({})); // 不是目標事件，放行
  process.exit(0);
}

// 取得欲執行的指令
const command = data.tool_input?.command || data.tool_input?.CommandLine || '';

// 定義危險指令的正則表達式 (Regex)
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

  // 6. 權限與所有權變更
  /chmod\s+(-R\s+)?(777|666)/,
  /chown\s+(-R\s+)?root/,

  // 7. 系統級破壞指令
  /\b(mkfs|dd|fdisk|parted|reboot|shutdown|halt|poweroff)\b/,

  // 8. 寫入硬體裝置
  />\s*\/dev\/(sd[a-z]|nvme|hd[a-z])/
];

// 檢查是否匹配任何危險模式
for (const pattern of dangerousPatterns) {
  if (pattern.test(command)) {
    // 發現危險指令，回傳 Deny
    const response = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `🚫 安全性攔截：此指令被標記為高風險 (${pattern})，已自動阻擋。`
      }
    };
    
    // 也可以同時發送一個系統通知
    // 這裡簡單用 console.error 紀錄一下 (會出現在 debug log)
    console.error(`[Security Hook] Blocked command: ${command}`);
    
    console.log(JSON.stringify(response));
    process.exit(0);
  }
}

// 安全，放行
console.log(JSON.stringify({}));
process.exit(0);
