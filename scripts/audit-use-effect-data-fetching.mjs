#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Linter } from 'eslint';

const AUDIT_NAME = 'AUDIT USE-EFFECT-DATA-FETCHING';
const FILE_RE = /\.(js|jsx)$/u;
const DATA_FETCH_ROOTS = ['src/ui', 'src/components'];
const SUPPRESS_ROOTS = ['src/ui', 'src/components', 'src/runtime/hooks'];

const auditRoot = path.resolve(process.argv[2] || process.cwd());
const linter = new Linter({ configType: 'flat' });
const FINDING_SEPARATOR = '::';

/**
 * @param {string} importSource - Module source from an import declaration.
 * @returns {string | null} Finding id when the source is forbidden.
 */
function forbiddenImportId(importSource) {
  if (importSource === 'firebase-admin' || importSource.startsWith('firebase/')) {
    return 'use-effect-firebase-import';
  }

  if (importSource === '@/repo' || importSource.startsWith('@/repo/')) {
    return 'use-effect-repo-import';
  }

  if (importSource === '@/service' || importSource.startsWith('@/service/')) {
    return 'use-effect-service-import';
  }

  if (importSource.startsWith('@/lib/firebase-')) {
    return 'use-effect-firebase-lib-import';
  }

  return null;
}

/**
 * @param {string} commentValue - Raw ESLint comment value.
 * @returns {{ id: string, message: string } | null} Disable finding metadata.
 */
function disableDirectiveFinding(commentValue) {
  const directive = commentValue.trim().split(/\s--\s/u)[0].trim();
  const match = /^(eslint-disable(?:-next-line|-line)?)(?:\s+([\s\S]*))?$/u
    .exec(directive);
  if (!match) {
    return null;
  }

  const rulesText = match[2] ? match[2].trim() : '';
  if (rulesText === '') {
    return {
      id: 'broad-eslint-disable',
      message:
        'Do not use broad eslint-disable directives; they can suppress react-hooks/exhaustive-deps.',
    };
  }

  const disabledRules = rulesText.split(/[,\s]+/u).filter(Boolean);
  if (!disabledRules.includes('react-hooks/exhaustive-deps')) {
    return null;
  }

  return {
    id: 'exhaustive-deps-disable',
    message:
      'Do not suppress react-hooks/exhaustive-deps; fix the dependencies or move logic out.',
  };
}

/**
 * @param {string} relativePath - POSIX-ish repository-relative path.
 * @param {string[]} roots - Root paths that activate a check.
 * @returns {boolean} Whether the file is under one of the roots.
 */
function isUnderAnyRoot(relativePath, roots) {
  return roots.some((root) => (
    relativePath === root || relativePath.startsWith(`${root}/`)
  ));
}

/**
 * @param {string} dir - Directory to scan.
 * @returns {string[]} JS and JSX files under the directory.
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
    } else if (entry.isFile() && FILE_RE.test(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * @param {string} file - Absolute path.
 * @returns {string} Path relative to the audit root, using POSIX separators.
 */
function relativeFile(file) {
  return path.relative(auditRoot, file).split(path.sep).join('/');
}

/**
 * @param {string} source - File source.
 * @param {number} line - One-based line number.
 * @returns {string} Trimmed source line.
 */
function sourceLine(source, line) {
  const rawLine = source.split(/\r?\n/u)[line - 1];
  return typeof rawLine === 'string' ? rawLine.trim() : '';
}

/**
 * @param {import('eslint').Rule.RuleContext} context - ESLint rule context.
 * @param {import('estree').Identifier} node - Identifier node.
 * @returns {import('eslint').Scope.Variable | null} Resolved variable, if any.
 */
function findVariable(context, node) {
  let scope = context.sourceCode.getScope(node);
  while (scope) {
    const variable = scope.variables.find(({ name }) => name === node.name);
    if (variable) {
      return variable;
    }
    scope = scope.upper;
  }
  return null;
}

/**
 * @param {import('eslint').Rule.RuleContext} context - ESLint rule context.
 * @param {import('estree').Identifier} node - Identifier node.
 * @returns {boolean} Whether the identifier resolves to the global fetch.
 */
function isGlobalFetch(context, node) {
  return node.name === 'fetch' && findVariable(context, node) === null;
}

/**
 * @param {import('estree').Node} node - AST node.
 * @param {Set<string>} useEffectNames - Local identifiers that refer to React useEffect.
 * @returns {boolean} Whether the call target is useEffect.
 */
function isUseEffectCallee(node, useEffectNames) {
  if (node.type === 'Identifier') {
    return useEffectNames.has(node.name);
  }

  return node.type === 'MemberExpression'
    && !node.computed
    && node.property.type === 'Identifier'
    && node.property.name === 'useEffect';
}

/**
 * @param {import('estree').ImportDeclaration} node - Import declaration node.
 * @param {Set<string>} useEffectNames - Local identifiers that refer to React useEffect.
 * @returns {void}
 */
function collectReactUseEffectNames(node, useEffectNames) {
  if (node.source.value !== 'react') {
    return;
  }

  for (const specifier of node.specifiers) {
    if (
      specifier.type === 'ImportSpecifier'
      && specifier.imported.type === 'Identifier'
      && specifier.imported.name === 'useEffect'
    ) {
      useEffectNames.add(specifier.local.name);
    }
  }
}

/**
 * @param {import('estree').Node} node - AST node.
 * @returns {boolean} Whether the node is a function expression usable as a callback.
 */
function isFunctionCallback(node) {
  if (!node) {
    return false;
  }

  return node.type === 'ArrowFunctionExpression'
    || node.type === 'FunctionExpression';
}

/**
 * @param {import('eslint').Rule.RuleContext} context - ESLint rule context.
 * @param {import('estree').Identifier} node - Identifier node.
 * @returns {import('estree').Function | null} Same-file callback declaration, if resolved.
 */
function resolveReferencedCallback(context, node) {
  const variable = findVariable(context, node);
  if (!variable) {
    return null;
  }

  for (const def of variable.defs) {
    if (def.type === 'FunctionName' && def.node.type === 'FunctionDeclaration') {
      return def.node;
    }

    if (
      def.type === 'Variable'
      && def.node.type === 'VariableDeclarator'
      && isFunctionCallback(def.node.init)
    ) {
      return def.node.init;
    }
  }

  return null;
}

/**
 * @param {import('estree').Node} node - AST node to traverse.
 * @param {(node: import('estree').Node) => void} visit - Visitor callback.
 * @returns {void}
 */
function traverseNode(node, visit) {
  if (!node || typeof node.type !== 'string') {
    return;
  }

  visit(node);

  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') {
      continue;
    }

    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        traverseNode(child, visit);
      }
    } else if (value && typeof value.type === 'string') {
      traverseNode(value, visit);
    }
  }
}

/**
 * @param {import('eslint').Rule.RuleContext} context - ESLint rule context.
 * @param {Map<string, { id: string, source: string }>} forbiddenImports - Forbidden import bindings.
 * @param {import('estree').Identifier} node - Identifier node.
 * @returns {{ id: string, source: string } | null} Forbidden import metadata, if matched.
 */
function resolveForbiddenImport(context, forbiddenImports, node) {
  const forbiddenImport = forbiddenImports.get(node.name);
  if (!forbiddenImport) {
    return null;
  }

  const variable = findVariable(context, node);
  if (!variable) {
    return null;
  }

  const isImportedBinding = variable.defs.some((def) => (
    def.type === 'ImportBinding'
    && def.parent
    && def.parent.source
    && def.parent.source.value === forbiddenImport.source
  ));

  return isImportedBinding ? forbiddenImport : null;
}

const auditRule = {
  meta: {
    type: 'problem',
  },
  create(context) {
    const auditSettings = context.settings.auditUseEffectDataFetching || {};
    const checkDataFetching = auditSettings.checkDataFetching;
    const checkSuppress = auditSettings.checkSuppress;
    const sourceCode = context.sourceCode;
    const forbiddenImports = new Map();
    const effectCallbacks = new WeakSet();
    const referencedCallbacks = [];
    const referencedCallbackSet = new WeakSet();
    const useEffectNames = new Set(['useEffect']);
    let effectDepth = 0;

    /**
     * @param {object} options - Report options.
     * @param {import('estree').Node} [options.node] - Node to report.
     * @param {import('estree').SourceLocation} [options.loc] - Location to report.
     * @param {string} options.id - Finding id.
     * @param {string} options.message - Finding message.
     * @returns {void}
     */
    function reportFinding({ node, loc, id, message }) {
      context.report({
        node,
        loc,
        message: `${id}${FINDING_SEPARATOR}${message}`,
      });
    }

    /**
     * @param {import('estree').Function} callback - Referenced effect callback.
     * @returns {void}
     */
    function queueReferencedCallback(callback) {
      if (referencedCallbackSet.has(callback)) {
        return;
      }

      referencedCallbackSet.add(callback);
      referencedCallbacks.push(callback);
    }

    /**
     * @param {import('estree').Node} node - Node inside a useEffect callback.
     * @returns {void}
     */
    function reportEffectBodyNode(node) {
      if (
        node.type === 'CallExpression'
        && node.callee.type === 'Identifier'
        && isGlobalFetch(context, node.callee)
      ) {
        reportFinding({
          node: node.callee,
          id: 'use-effect-fetch',
          message:
            'Move data fetching out of UI/component useEffect and into runtime/service boundaries.',
        });
        return;
      }

      if (
        node.type === 'ImportExpression'
        && node.source.type === 'Literal'
        && typeof node.source.value === 'string'
      ) {
        const id = forbiddenImportId(node.source.value);
        if (id) {
          reportFinding({
            node,
            id,
            message: `Do not dynamically import ${node.source.value} from inside UI/component useEffect.`,
          });
        }
        return;
      }

      if (node.type === 'Identifier') {
        const forbiddenImport = resolveForbiddenImport(context, forbiddenImports, node);
        if (!forbiddenImport) {
          return;
        }

        reportFinding({
          node,
          id: forbiddenImport.id,
          message:
            `Move ${forbiddenImport.source} usage out of UI/component useEffect and into runtime/service boundaries.`,
        });
      }
    }

    return {
      Program() {
        if (!checkSuppress) {
          return;
        }

        for (const comment of sourceCode.getAllComments()) {
          const finding = disableDirectiveFinding(comment.value);
          if (finding) {
            reportFinding({
              loc: comment.loc,
              id: finding.id,
              message: finding.message,
            });
          }
        }
      },

      'Program:exit'() {
        for (const callback of referencedCallbacks) {
          traverseNode(callback.body, reportEffectBodyNode);
        }
      },

      ImportDeclaration(node) {
        if (!checkDataFetching || typeof node.source.value !== 'string') {
          return;
        }

        collectReactUseEffectNames(node, useEffectNames);

        const id = forbiddenImportId(node.source.value);
        if (!id) {
          return;
        }

        for (const specifier of node.specifiers) {
          forbiddenImports.set(specifier.local.name, {
            id,
            source: node.source.value,
          });
        }
      },

      CallExpression(node) {
        if (!checkDataFetching) {
          return;
        }

        if (isUseEffectCallee(node.callee, useEffectNames)) {
          if (isFunctionCallback(node.arguments[0])) {
            effectCallbacks.add(node.arguments[0]);
          } else if (node.arguments[0] && node.arguments[0].type === 'Identifier') {
            const callback = resolveReferencedCallback(context, node.arguments[0]);
            if (callback) {
              queueReferencedCallback(callback);
            }
          }
          return;
        }

        if (effectDepth === 0) {
          return;
        }

        if (node.callee.type === 'Identifier' && isGlobalFetch(context, node.callee)) {
          reportEffectBodyNode(node);
        }
      },

      ImportExpression(node) {
        if (
          !checkDataFetching
          || effectDepth === 0
          || node.source.type !== 'Literal'
          || typeof node.source.value !== 'string'
        ) {
          return;
        }

        reportEffectBodyNode(node);
      },

      Identifier(node) {
        if (!checkDataFetching || effectDepth === 0) {
          return;
        }

        reportEffectBodyNode(node);
      },

      ':function'(node) {
        if (effectCallbacks.has(node)) {
          effectDepth += 1;
        }
      },

      ':function:exit'(node) {
        if (effectCallbacks.has(node)) {
          effectDepth -= 1;
        }
      },
    };
  },
};

/**
 * @param {string} file - Absolute file path.
 * @returns {Array<{file: string, line: number, id: string, message: string, source: string}>} Findings.
 */
function lintFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const relativePath = relativeFile(file);
  const checkDataFetching = isUnderAnyRoot(relativePath, DATA_FETCH_ROOTS);
  const checkSuppress = isUnderAnyRoot(relativePath, SUPPRESS_ROOTS);

  const messages = linter.verify(
    source,
    [
      {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
          ecmaVersion: 'latest',
          sourceType: 'module',
          parserOptions: {
            ecmaFeatures: {
              jsx: true,
            },
          },
        },
        plugins: {
          audit: {
            rules: {
              'use-effect-data-fetching': auditRule,
            },
          },
        },
        rules: {
          'audit/use-effect-data-fetching': 'error',
        },
        linterOptions: {
          reportUnusedDisableDirectives: 'off',
        },
        settings: {
          auditUseEffectDataFetching: {
            checkDataFetching,
            checkSuppress,
          },
        },
      },
    ],
    {
      allowInlineConfig: false,
      filename: relativePath,
    },
  );

  return messages.map((message) => ({
    file: relativePath,
    line: message.line,
    ...normalizeMessage(message),
    source: sourceLine(source, message.line),
  }));
}

/**
 * @param {import('eslint').Linter.LintMessage} message - ESLint lint message.
 * @returns {{id: string, message: string}} Normalized finding metadata.
 */
function normalizeMessage(message) {
  if (message.ruleId === 'audit/use-effect-data-fetching') {
    const [id, text] = message.message.split(FINDING_SEPARATOR);
    return {
      id,
      message: text,
    };
  }

  return {
    id: 'parse-error',
    message: message.message,
  };
}

const files = Array.from(
  new Set([
    ...DATA_FETCH_ROOTS.flatMap((dir) => listFiles(path.join(auditRoot, dir))),
    ...SUPPRESS_ROOTS.flatMap((dir) => listFiles(path.join(auditRoot, dir))),
  ]),
).sort();

const findings = files.flatMap(lintFile);

if (findings.length === 0) {
  console.log(`${AUDIT_NAME}: 0 findings`);
  process.exit(0);
}

console.error(`${AUDIT_NAME}: ${findings.length} finding(s)`);
for (const finding of findings) {
  console.error(`${finding.file}:${finding.line}: ${finding.id}`);
  console.error(`  ${finding.message}`);
  console.error(`  ${finding.source}`);
}
process.exit(1);
