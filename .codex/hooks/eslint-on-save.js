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
  if (!/\.(jsx?|mjs)$/.test(p)) continue;
  try {
    execFileSync('npx', ['eslint', '--max-warnings', '0', p], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15000,
    });
  } catch (e) {
    const output = (e.stdout || '').toString() + (e.stderr || '').toString();
    if (output.trim()) {
      process.stderr.write(`[ESLint Hook]\n${output}\n`);
    }
  }
}

process.stdout.write('{}\n');
