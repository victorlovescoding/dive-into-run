#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { builtinModules } from 'module';

const TEST_ROOT = 'tests/e2e';
const TEST_FILE_RE = /\.(js|jsx|mjs)$/;
const MAX_CONTEXT_CHARS = 1200;
const MAX_IMPORT_CHARS = 2000;

const builtinSpecifiers = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

const sourceChecks = [
  {
    id: 'playwright-focused-test',
    pattern: /\b(?:test|describe|it)\s*\.\s*only\s*\(/g,
    message: 'Remove focused Playwright test/describe/it .only() before committing.',
  },
  {
    id: 'playwright-wait-for-timeout',
    pattern: /\bpage\s*\.\s*waitForTimeout\s*\(/g,
    message: 'Use Playwright auto-waiting or web-first assertions instead of page.waitForTimeout().',
  },
  {
    id: 'playwright-page-alias-wait-for-timeout',
    pattern:
      /\b(?:async\s*)?\(\s*\{\s*page\s*:\s*([A-Za-z_$][\w$]*)[\s\S]{0,200}?\}\s*\)\s*=>[\s\S]{0,1200}?\b\1\s*\.\s*waitForTimeout\s*\(/g,
    indexForMatch: (match) => match.index + match[0].lastIndexOf(match[1]),
    message: 'Use Playwright auto-waiting or web-first assertions instead of page.waitForTimeout() aliases.',
  },
  {
    id: 'fixed-sleep-new-promise',
    pattern: new RegExp(
      String.raw`\bnew\s+Promise\s*\((?:[\s\S]{0,${MAX_CONTEXT_CHARS}}?)\bsetTimeout\s*\(`,
      'g',
    ),
    message: 'Use Playwright assertions, locators, or fake timers instead of fixed new Promise(...setTimeout...) sleeps.',
  },
  {
    id: 'fixed-sleep-set-timeout-promise',
    pattern: new RegExp(
      String.raw`\bsetTimeout\s*\((?:[\s\S]{0,${MAX_CONTEXT_CHARS}}?)\bPromise\b`,
      'g',
    ),
    message: 'Use Playwright assertions, locators, or fake timers instead of fixed setTimeout(...Promise...) sleeps.',
  },
  {
    id: 'fixed-sleep-helper',
    pattern: /\b(?:sleep|delay|wait|pause)\s*\(\s*(?:\d{2,}|[A-Z_]*(?:MS|TIMEOUT|DELAY|SLEEP)[A-Z_]*)/g,
    message: 'Use Playwright assertions or app-observable conditions instead of obvious fixed sleep helpers.',
  },
];

/**
 * @param {string} dir - Directory to recursively scan.
 * @returns {string[]} Matching E2E JavaScript files.
 */
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

/**
 * @param {string} source - JavaScript source.
 * @param {object} options - Masking options.
 * @param {boolean} options.maskStrings - Whether string/template contents should be hidden.
 * @returns {string} Source with comments, and optionally strings, replaced by spaces.
 */
function maskSource(source, { maskStrings }) {
  const chars = source.split('');
  let state = 'code';
  let quote = '';
  let escaped = false;
  let templateExpressionDepth = 0;

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
      if (maskStrings && current !== '\n') {
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

    if (state === 'template') {
      if (maskStrings && current !== '\n') {
        chars[i] = ' ';
      }

      if (escaped) {
        escaped = false;
      } else if (current === '\\') {
        escaped = true;
      } else if (current === '`') {
        state = 'code';
      } else if (current === '$' && next === '{') {
        if (maskStrings) {
          chars[i + 1] = ' ';
        }
        i += 1;
        state = 'templateExpression';
        templateExpressionDepth = 1;
      }
      continue;
    }

    if (state === 'templateExpression') {
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

      if (current === '\'' || current === '"') {
        if (maskStrings) {
          chars[i] = ' ';
        }
        state = 'string';
        quote = current;
        escaped = false;
        continue;
      }

      if (current === '`') {
        if (maskStrings) {
          chars[i] = ' ';
        }
        state = 'template';
        escaped = false;
        continue;
      }

      if (current === '{') {
        templateExpressionDepth += 1;
      } else if (current === '}') {
        templateExpressionDepth -= 1;
        if (templateExpressionDepth === 0) {
          if (maskStrings) {
            chars[i] = ' ';
          }
          state = 'template';
        }
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

    if (current === '\'' || current === '"') {
      if (maskStrings) {
        chars[i] = ' ';
      }
      state = 'string';
      quote = current;
      escaped = false;
      continue;
    }

    if (current === '`') {
      if (maskStrings) {
        chars[i] = ' ';
      }
      state = 'template';
      escaped = false;
    }
  }

  return chars.join('');
}

/**
 * @param {string} source - Source text.
 * @param {number} index - Character index.
 * @returns {number} 1-based source line.
 */
function lineForIndex(source, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source[i] === '\n') {
      line += 1;
    }
  }
  return line;
}

/**
 * @param {string} source - Source text.
 * @param {number} line - 1-based source line.
 * @returns {string} Trimmed source line.
 */
function sourceLine(source, line) {
  const lineText = source.split(/\r?\n/)[line - 1];
  return lineText ? lineText.trim() : '';
}

/**
 * @param {string} value - User-defined identifier for use in a regular expression.
 * @returns {string} Escaped regular expression fragment.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string | undefined} char - Character to test.
 * @returns {boolean} Whether the character can be part of a JS identifier.
 */
function isIdentifierChar(char) {
  return Boolean(char && /[A-Za-z0-9_$]/.test(char));
}

/**
 * @param {string} source - Source text.
 * @param {string} keyword - Keyword to test.
 * @param {number} index - Candidate keyword index.
 * @returns {boolean} Whether keyword appears at index with identifier boundaries.
 */
function isKeywordAt(source, keyword, index) {
  return source.startsWith(keyword, index)
    && !isIdentifierChar(source[index - 1])
    && !isIdentifierChar(source[index + keyword.length]);
}

/**
 * @param {string} source - Source text.
 * @param {number} index - Start index.
 * @returns {number} Index after whitespace and comments.
 */
function skipWhitespaceAndComments(source, index) {
  let currentIndex = index;

  while (currentIndex < source.length) {
    if (/\s/.test(source[currentIndex])) {
      currentIndex += 1;
      continue;
    }

    if (source[currentIndex] === '/' && source[currentIndex + 1] === '/') {
      currentIndex += 2;
      while (currentIndex < source.length && source[currentIndex] !== '\n') {
        currentIndex += 1;
      }
      continue;
    }

    if (source[currentIndex] === '/' && source[currentIndex + 1] === '*') {
      currentIndex += 2;
      while (
        currentIndex < source.length
        && !(source[currentIndex] === '*' && source[currentIndex + 1] === '/')
      ) {
        currentIndex += 1;
      }
      currentIndex += 2;
      continue;
    }

    break;
  }

  return currentIndex;
}

/**
 * @param {string} source - Source text.
 * @param {number} index - Candidate string literal index.
 * @returns {{ end: number, value: string } | null} Parsed string literal.
 */
function parseStringLiteral(source, index) {
  const quote = source[index];
  if (quote !== '\'' && quote !== '"') {
    return null;
  }

  let value = '';
  let escaped = false;
  for (let currentIndex = index + 1; currentIndex < source.length; currentIndex += 1) {
    const current = source[currentIndex];
    if (escaped) {
      value += current;
      escaped = false;
      continue;
    }

    if (current === '\\') {
      escaped = true;
      continue;
    }

    if (current === quote) {
      return {
        end: currentIndex + 1,
        value,
      };
    }

    value += current;
  }

  return null;
}

/**
 * @param {string} source - Source text.
 * @param {string} keyword - Keyword to find.
 * @param {number} start - Inclusive start index.
 * @param {number} end - Exclusive end index.
 * @returns {number} Keyword index, or -1.
 */
function findKeyword(source, keyword, start, end) {
  for (let index = start; index < end; index += 1) {
    if (isKeywordAt(source, keyword, index)) {
      return index;
    }
  }

  return -1;
}

/**
 * @param {string} specifier - Import specifier.
 * @returns {boolean} Whether the specifier is allowed in E2E files.
 */
function isAllowedImportSpecifier(specifier) {
  return specifier === '@playwright/test'
    || specifier.startsWith('.')
    || builtinSpecifiers.has(specifier);
}

/**
 * @param {string} specifier - Import specifier.
 * @returns {boolean} Whether this is a forbidden Playwright package import.
 */
function isForbiddenPlaywrightImport(specifier) {
  return specifier !== '@playwright/test'
    && (specifier === 'playwright'
      || specifier.startsWith('playwright/')
      || specifier.startsWith('@playwright/'));
}

/**
 * @param {string} source - JavaScript source.
 * @returns {{ index: number, specifier: string }[]} Import specifiers with source indexes.
 */
function findImportSpecifiers(source) {
  const searchable = maskSource(source, { maskStrings: true });
  const imports = [];

  for (let index = 0; index < searchable.length; index += 1) {
    if (!isKeywordAt(searchable, 'import', index)) {
      continue;
    }

    const afterImport = skipWhitespaceAndComments(source, index + 'import'.length);
    if (source[afterImport] === '.') {
      continue;
    }

    if (source[afterImport] === '(') {
      const specifierStart = skipWhitespaceAndComments(source, afterImport + 1);
      const parsed = parseStringLiteral(source, specifierStart);
      if (parsed) {
        imports.push({
          index: specifierStart + 1,
          specifier: parsed.value,
        });
      }
      continue;
    }

    const sideEffectImport = parseStringLiteral(source, afterImport);
    if (sideEffectImport) {
      imports.push({
        index: afterImport + 1,
        specifier: sideEffectImport.value,
      });
      continue;
    }

    let fromSearchStart = afterImport;
    const searchEnd = Math.min(source.length, index + MAX_IMPORT_CHARS);

    while (fromSearchStart < searchEnd) {
      const fromIndex = findKeyword(searchable, 'from', fromSearchStart, searchEnd);
      if (fromIndex === -1) {
        break;
      }

      const specifierStart = skipWhitespaceAndComments(source, fromIndex + 'from'.length);
      const parsed = parseStringLiteral(source, specifierStart);
      if (parsed) {
        imports.push({
          index: specifierStart + 1,
          specifier: parsed.value,
        });
        break;
      }

      fromSearchStart = fromIndex + 'from'.length;
    }
  }

  return imports;
}

/**
 * @param {string} searchable - Source with comments and strings masked.
 * @param {string} source - Original source text.
 * @returns {{ line: number, id: string, message: string, source: string }[]} Alias findings.
 */
function findPageAliasWaits(searchable, source) {
  const findingsForFile = [];
  const aliasPattern = /\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*page\s*;?/g;
  let aliasMatch = aliasPattern.exec(searchable);

  while (aliasMatch !== null) {
    const alias = aliasMatch[1];
    if (alias === 'page') {
      aliasMatch = aliasPattern.exec(searchable);
      continue;
    }

    const waitPattern = new RegExp(
      String.raw`\b${escapeRegExp(alias)}\s*\.\s*waitForTimeout\s*\(`,
      'g',
    );
    waitPattern.lastIndex = aliasMatch.index + aliasMatch[0].length;

    let waitMatch = waitPattern.exec(searchable);
    while (waitMatch !== null) {
      const line = lineForIndex(searchable, waitMatch.index);
      findingsForFile.push({
        line,
        id: 'playwright-page-const-alias-wait-for-timeout',
        message: 'Use Playwright auto-waiting or web-first assertions instead of page.waitForTimeout() aliases.',
        source: sourceLine(source, line),
      });
      waitMatch = waitPattern.exec(searchable);
    }

    aliasMatch = aliasPattern.exec(searchable);
  }

  return findingsForFile;
}

const findings = [];

for (const file of listFiles(TEST_ROOT).sort()) {
  const source = fs.readFileSync(file, 'utf8');
  const searchable = maskSource(source, { maskStrings: true });

  for (const check of sourceChecks) {
    check.pattern.lastIndex = 0;
    let match = check.pattern.exec(searchable);
    while (match !== null) {
      const findingIndex = check.indexForMatch ? check.indexForMatch(match) : match.index;
      const line = lineForIndex(searchable, findingIndex);
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

  for (const finding of findPageAliasWaits(searchable, source)) {
    findings.push({
      file,
      ...finding,
    });
  }

  for (const { index, specifier } of findImportSpecifiers(source)) {
    if (isForbiddenPlaywrightImport(specifier)) {
      const line = lineForIndex(source, index);
      findings.push({
        file,
        line,
        id: 'playwright-import-source',
        message: 'Import Playwright test APIs only from @playwright/test.',
        source: sourceLine(source, line),
      });
      continue;
    }

    if (!isAllowedImportSpecifier(specifier)) {
      const line = lineForIndex(source, index);
      findings.push({
        file,
        line,
        id: 'e2e-non-relative-import',
        message: 'E2E files may import only @playwright/test, Node builtins, or relative helpers.',
        source: sourceLine(source, line),
      });
    }
  }
}

if (findings.length === 0) {
  console.log('AUDIT PLAYWRIGHT-OFFICIAL-ONLY: 0 findings');
  process.exit(0);
}

console.error(`AUDIT PLAYWRIGHT-OFFICIAL-ONLY: ${findings.length} finding(s)`);
for (const finding of findings) {
  console.error(`${finding.file}:${finding.line}: ${finding.id}`);
  console.error(`  ${finding.message}`);
  console.error(`  ${finding.source}`);
}
process.exit(1);
