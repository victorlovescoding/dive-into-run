#!/usr/bin/env node

const fs = require('fs');
const { execFileSync } = require('child_process');

const input = fs.readFileSync(0, 'utf-8');
const data = JSON.parse(input);
const toolInput = data.tool_input || {};

const paths = new Set();

if (typeof toolInput.path === 'string') paths.add(toolInput.path);
if (typeof toolInput.file_path === 'string') paths.add(toolInput.file_path);

const patch = toolInput.patch || toolInput.diff || '';
if (typeof patch === 'string') {
  for (const m of patch.matchAll(/^\+\+\+ b\/(.+)$/gm)) {
    paths.add(m[1]);
  }
}

for (const p of paths) {
  if (!/\.(jsx?|tsx?|css|json|md|html)$/.test(p)) continue;
  try {
    execFileSync('npx', ['prettier', '--write', p], {
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 10000,
    });
  } catch {
    process.stderr.write(`[Prettier Hook] Failed to format: ${p}\n`);
  }
}

process.stdout.write('{}\n');
