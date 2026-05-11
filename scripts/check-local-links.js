#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_PREFIXES = [
  'AGENTS.md',
  'docs/',
  'specs/',
  '.codex/',
  '.agents/',
  'scripts/',
  'src/',
  'tests/',
  'package.json',
  'package-lock.json',
  'cspell.json',
  'eslint.config.mjs',
  'tsconfig.json',
  'playwright.config.mjs',
  'playwright.emulator.config.mjs',
];

const SKIP_PREFIXES = [
  '.claude/',
  'project-health/',
  'node_modules/',
  '.next/',
  'coverage/',
  'http://',
  'https://',
  'mailto:',
  '#',
  '@/',
];

const ALLOWED_MISSING_REFERENCES = new Set([
  'specs/feature-auth',
  'src/lib/extra-feature.js',
  'tests/e2e/login.spec.js',
  'tests/integration/auth/login-form.test.jsx',
  'tests/integration/notifications/x.test.jsx',
  'tests/server/auth/firebase-admin.test.js',
  'tests/unit/service/login.test.js',
  'tests/unit/service/x.test.js',
]);

/**
 * Checks for a markdown file.
 * @param {string} filePath - File path.
 * @returns {boolean} Whether file is markdown.
 */
function isMarkdown(filePath) {
  return filePath.endsWith('.md');
}

/**
 * Lists files in a directory recursively.
 * @param {string} dirPath - Directory path.
 * @param {(filePath: string) => boolean} predicate - File filter.
 * @returns {string[]} File paths.
 */
function listFilesRecursive(dirPath, predicate) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  const files = [];
  fs.readdirSync(dirPath, { withFileTypes: true }).forEach((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(entryPath, predicate));
    } else if (entry.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  });

  return files.sort();
}

/**
 * Discovers skill files.
 * @returns {string[]} Skill file paths.
 */
function discoverSkillFiles() {
  const skillsDir = path.join(process.cwd(), '.agents', 'skills');
  if (!fs.existsSync(skillsDir)) {
    return [];
  }

  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(skillsDir, entry.name, 'SKILL.md'))
    .filter((skillPath) => fs.existsSync(skillPath))
    .sort();
}

/**
 * Discovers workflow-critical docs and skill files.
 * @returns {string[]} Files to scan.
 */
function discoverScanFiles() {
  return [
    path.join(process.cwd(), 'AGENTS.md'),
    ...listFilesRecursive(path.join(process.cwd(), 'docs', 'superpowers'), isMarkdown),
    ...listFilesRecursive(path.join(process.cwd(), '.codex', 'rules'), isMarkdown),
    ...listFilesRecursive(path.join(process.cwd(), '.codex', 'references'), isMarkdown),
    ...discoverSkillFiles(),
  ].filter((filePath) => fs.existsSync(filePath));
}

/**
 * Removes fenced code blocks from markdown.
 * @param {string} text - Markdown text.
 * @returns {string} Markdown without fenced code blocks.
 */
function stripFencedCode(text) {
  return text.replace(/```[\s\S]*?```/g, '');
}

/**
 * Strips common punctuation around a path token.
 * @param {string} token - Candidate token.
 * @returns {string} Cleaned token.
 */
function cleanToken(token) {
  return token
    .trim()
    .replace(/^["'(<]+/, '')
    .replace(/[)"':,.;\]]+$/, '');
}

/**
 * Checks whether a token should be skipped.
 * @param {string} token - Candidate token.
 * @returns {boolean} Whether token is intentionally skipped.
 */
function shouldSkipToken(token) {
  return (
    token === '' ||
    token.includes('<') ||
    token.includes('>') ||
    token.includes('*') ||
    token.includes('[') ||
    token.includes(']') ||
    token.includes('|') ||
    token.includes('{') ||
    token.includes('}') ||
    token.includes('$') ||
    token.startsWith('/') ||
    token.startsWith('tests/test-results/') ||
    ALLOWED_MISSING_REFERENCES.has(token) ||
    SKIP_PREFIXES.some((prefix) => token.startsWith(prefix))
  );
}

/**
 * Checks whether a token looks like a local path reference.
 * @param {string} token - Candidate token.
 * @returns {boolean} Whether token should be checked.
 */
function isLocalPathToken(token) {
  if (token.startsWith('./') || token.startsWith('../')) {
    return true;
  }

  return ROOT_PREFIXES.some((prefix) => token === prefix || token.startsWith(prefix));
}

/**
 * Extracts markdown link targets.
 * @param {string} text - Markdown text.
 * @returns {string[]} Candidate link targets.
 */
function extractMarkdownLinks(text) {
  const links = [];
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let match = linkPattern.exec(text);

  while (match) {
    links.push(match[1].split(/\s+/)[0]);
    match = linkPattern.exec(text);
  }

  return links;
}

/**
 * Extracts inline-code path tokens.
 * @param {string} text - Markdown text.
 * @returns {string[]} Candidate path tokens.
 */
function extractInlineCodeTokens(text) {
  const tokens = [];
  const inlineCodePattern = /`([^`\n]+)`/g;
  let match = inlineCodePattern.exec(text);

  while (match) {
    match[1].split(/\s+/).forEach((part) => {
      tokens.push(part);
    });
    match = inlineCodePattern.exec(text);
  }

  return tokens;
}

/**
 * Resolves a local reference from the scanning file.
 * @param {string} sourceFile - Source markdown file.
 * @param {string} reference - Local reference.
 * @returns {string} Absolute candidate path.
 */
function resolveReference(sourceFile, reference) {
  const withoutAnchor = reference.split('#')[0];
  if (withoutAnchor.startsWith('./') || withoutAnchor.startsWith('../')) {
    return path.resolve(path.dirname(sourceFile), withoutAnchor);
  }

  return path.resolve(process.cwd(), withoutAnchor);
}

/**
 * Checks whether a resolved path exists.
 * @param {string} candidatePath - Absolute candidate path.
 * @param {string} rawReference - Original reference.
 * @returns {boolean} Whether the path exists.
 */
function referenceExists(candidatePath, rawReference) {
  if (rawReference.endsWith('/')) {
    return fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory();
  }

  return fs.existsSync(candidatePath);
}

/**
 * Extracts local references from one file.
 * @param {string} filePath - File to scan.
 * @returns {string[]} Local references.
 */
function extractReferences(filePath) {
  const text = stripFencedCode(fs.readFileSync(filePath, 'utf8'));
  const rawTokens = [...extractMarkdownLinks(text), ...extractInlineCodeTokens(text)];
  const references = rawTokens
    .map(cleanToken)
    .filter((token) => !shouldSkipToken(token))
    .filter(isLocalPathToken);

  return [...new Set(references)].sort();
}

/**
 * Runs local link checks.
 * @returns {void} No return value.
 */
function main() {
  const files = discoverScanFiles();
  const failures = [];

  files.forEach((filePath) => {
    extractReferences(filePath).forEach((reference) => {
      const candidatePath = resolveReference(filePath, reference);
      if (!referenceExists(candidatePath, reference)) {
        failures.push(`${path.relative(process.cwd(), filePath)} -> ${reference}`);
      }
    });
  });

  if (failures.length > 0) {
    failures.forEach((failure) => {
      console.error(failure);
    });
    console.error(`LOCAL LINKS: ${failures.length} missing local reference(s)`);
    process.exit(1);
  }

  process.stdout.write(`LOCAL LINKS: ${files.length} file(s) scanned, all local references exist\n`);
}

main();
