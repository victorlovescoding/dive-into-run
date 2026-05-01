#!/usr/bin/env bash
# Flaky-pattern prevention gate for executable test/spec files.
# Blocks exact async call-count assertions and fixed sleep waits without
# flagging comments that document the forbidden patterns.
set -euo pipefail

node <<'NODE'
const fs = require('fs');
const path = require('path');

const TEST_ROOT = 'tests';
const TEST_FILE_RE = /\.(test|spec)\.(js|jsx|mjs)$/;
const MAX_CONTEXT_CHARS = 1200;

const checks = [
  {
    id: 'toHaveBeenCalledTimes',
    pattern: /toHaveBeenCalledTimes\s*\(/g,
    message:
      'Use behavior/payload assertions instead of toHaveBeenCalledTimes(N); exact async call counts are flaky.',
  },
  {
    id: 'new Promise + setTimeout',
    pattern: new RegExp(
      String.raw`new\s+Promise\s*\((?:[\s\S]{0,${MAX_CONTEXT_CHARS}}?)setTimeout\s*\(`,
      'g',
    ),
    message:
      'Use waitFor/findBy/fake timers instead of a fixed new Promise(...setTimeout...) sleep.',
  },
  {
    id: 'setTimeout + Promise',
    pattern: new RegExp(
      String.raw`setTimeout\s*\((?:[^;]{0,${MAX_CONTEXT_CHARS}}?)\bPromise\b`,
      'g',
    ),
    message:
      'Use waitFor/findBy/fake timers instead of a fixed setTimeout(...Promise...) sleep.',
  },
  {
    id: 'page.waitForTimeout',
    pattern: /page\s*\.\s*waitForTimeout\s*\(/g,
    message: 'Use Playwright auto-waiting or web-first assertions instead of page.waitForTimeout().',
  },
];

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(fullPath));
    } else if (entry.isFile() && TEST_FILE_RE.test(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function maskCommentsAndStrings(source) {
  const chars = source.split('');
  let state = 'code';
  let quote = '';
  let escaped = false;

  for (let i = 0; i < chars.length; i += 1) {
    const current = chars[i];
    const next = chars[i + 1];

    if (state === 'lineComment') {
      if (current === '\n') {
        state = 'code';
      } else {
        chars[i] = ' ';
      }
      continue;
    }

    if (state === 'blockComment') {
      if (current === '*' && next === '/') {
        chars[i] = ' ';
        chars[i + 1] = ' ';
        i += 1;
        state = 'code';
      } else if (current !== '\n') {
        chars[i] = ' ';
      }
      continue;
    }

    if (state === 'string') {
      if (current !== '\n') {
        chars[i] = ' ';
      }
      if (escaped) {
        escaped = false;
      } else if (current === '\\') {
        escaped = true;
      } else if (current === quote) {
        state = 'code';
        quote = '';
      }
      continue;
    }

    if (current === '/' && next === '/') {
      chars[i] = ' ';
      chars[i + 1] = ' ';
      i += 1;
      state = 'lineComment';
      continue;
    }

    if (current === '/' && next === '*') {
      chars[i] = ' ';
      chars[i + 1] = ' ';
      i += 1;
      state = 'blockComment';
      continue;
    }

    if (current === '\'' || current === '"' || current === '`') {
      chars[i] = ' ';
      state = 'string';
      quote = current;
      escaped = false;
    }
  }

  return chars.join('');
}

function lineForIndex(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

function sourceLine(source, line) {
  return source.split(/\r?\n/)[line - 1]?.trim() ?? '';
}

const findings = [];

for (const file of listFiles(TEST_ROOT).sort()) {
  const source = fs.readFileSync(file, 'utf8');
  const searchable = maskCommentsAndStrings(source);

  for (const check of checks) {
    check.pattern.lastIndex = 0;
    let match = check.pattern.exec(searchable);
    while (match !== null) {
      const line = lineForIndex(searchable, match.index);
      findings.push({
        file,
        line,
        id: check.id,
        message: check.message,
        source: sourceLine(source, line),
      });
      match = check.pattern.exec(searchable);
    }
  }
}

if (findings.length === 0) {
  console.log('AUDIT FLAKY-PATTERN: 0 findings');
  process.exit(0);
}

console.error(`AUDIT FLAKY-PATTERN: ${findings.length} finding(s)`);
for (const finding of findings) {
  console.error(`${finding.file}:${finding.line}: ${finding.id}`);
  console.error(`  ${finding.message}`);
  console.error(`  ${finding.source}`);
}
process.exit(1);
NODE
