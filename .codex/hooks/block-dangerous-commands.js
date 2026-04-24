#!/usr/bin/env node

const fs = require('fs');

const input = fs.readFileSync(0, 'utf-8');
const data = JSON.parse(input);

const command = data.tool_input?.command || '';

const dangerousPatterns = [
  /rm\s+(-[a-zA-Z]+\s+)?(\/|~|\$HOME|\/etc|\/boot|\/var|\/usr|\/bin|\/sbin)/,
  /rm\s+(-[a-zA-Z]+\s+)?(\*|\.\*)/,
  /:\(\)\s*\{\s*:\|:\s*&\s*\};:/,
  /(curl|wget).+?\|\s*(sh|bash|zsh)/,
  /git\s+push\s+.*(-f|--force)/,
  /git\s+reset\s+--hard/,
  /git\s+clean\s+[\s\S]*(-[a-zA-Z]*[xX])/,
  /chmod\s+(-R\s+)?(777|666)/,
  /chown\s+(-R\s+)?root/,
  /\b(mkfs|dd|fdisk|parted|reboot|shutdown|halt|poweroff)\b/,
  />\s*\/dev\/(sd[a-z]|nvme|hd[a-z])/,
];

for (const pattern of dangerousPatterns) {
  if (pattern.test(command)) {
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
