/* eslint-disable jsdoc/require-param-description, jsdoc/require-returns-description, jsdoc/valid-types */
import fs from 'node:fs';
import path from 'node:path';

import { parse } from '../../../node_modules/@babel/parser/lib/index.js';

const { posix } = path;
const TEST_FILE_PATTERN = String.raw`\.(js|jsx|mjs)$`;
const TEST_FILE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs']);

const TEST_BUCKET_FILE_PATTERNS = Object.freeze({
  unit: `^specs/.+/tests/unit/.+${TEST_FILE_PATTERN}$`,
  integration: `^specs/.+/tests/integration/.+${TEST_FILE_PATTERN}$`,
  e2e: `^specs/.+/tests/e2e/.+${TEST_FILE_PATTERN}$`,
  'specs-test-utils': '^specs/test-utils/.+\\.js$',
  'unit-tests-root': `^tests/unit/.+${TEST_FILE_PATTERN}$`,
  'integration-tests-root': `^tests/integration/.+${TEST_FILE_PATTERN}$`,
  'e2e-tests-root': `^tests/e2e/.+${TEST_FILE_PATTERN}$`,
  'tests-helpers': `^tests/_helpers/.+${TEST_FILE_PATTERN}$`,
});

const DEPCRUISE_DENY_PATTERNS = Object.freeze({
  unit: Object.freeze([
    '^src/runtime/providers(?:/|$)',
    '^src/components(?:/|$)',
    '^src/contexts(?:/|$)',
    '^src/hooks(?:/|$)',
    '^src/app/(?!api(?:/|$))',
  ]),
  integration: Object.freeze([
    '^src/repo(?:/|$)',
    '^src/service(?:/|$)',
    '^src/config/server(?:/|$)',
  ]),
  e2e: Object.freeze(['^src/']),
  'specs-test-utils': Object.freeze(['^src/']),
  'unit-tests-root': Object.freeze([
    '^src/runtime/providers(?:/|$)',
    '^src/components(?:/|$)',
    '^src/contexts(?:/|$)',
    '^src/hooks(?:/|$)',
    '^src/app/(?!api(?:/|$))',
  ]),
  'integration-tests-root': Object.freeze([
    '^src/repo(?:/|$)',
    '^src/service(?:/|$)',
    '^src/config/server(?:/|$)',
  ]),
  'e2e-tests-root': Object.freeze(['^src/']),
  'tests-helpers': Object.freeze(['^src/']),
});

export const TEST_BUCKET_POLICY_ARTIFACT_PATH =
  'specs/021-layered-dependency-architecture/test-bucket-policy.js';

export const TEST_BUCKET_MATCHERS = Object.freeze(
  Object.fromEntries(
    Object.entries(TEST_BUCKET_FILE_PATTERNS).map(([bucketId, pattern]) => [
      bucketId,
      new RegExp(pattern),
    ]),
  ),
);

export const TEST_DEPENDENCY_SURFACES = Object.freeze({
  external: Object.freeze({
    description: 'package imports such as vitest, react, next/navigation, firebase/*',
    depCruisePathPattern: null,
  }),
  relative: Object.freeze({
    description: 'relative imports resolved from the current test file',
    depCruisePathPattern: null,
  }),
  'src-lib': Object.freeze({
    description: 'src/lib/**',
    depCruisePathPattern: '^src/lib(?:/|$)',
  }),
  'src-config-client-facing': Object.freeze({
    description: 'src/config/client/** or src/config/geo/**',
    depCruisePathPattern: '^src/config/(?:client|geo)(?:/|$)',
  }),
  'src-config-server': Object.freeze({
    description: 'src/config/server/**',
    depCruisePathPattern: '^src/config/server(?:/|$)',
  }),
  'src-config': Object.freeze({
    description: 'other src/config/**',
    depCruisePathPattern: '^src/config(?:/|$)',
  }),
  'src-repo': Object.freeze({
    description: 'src/repo/**',
    depCruisePathPattern: '^src/repo(?:/|$)',
  }),
  'src-service': Object.freeze({
    description: 'src/service/**',
    depCruisePathPattern: '^src/service(?:/|$)',
  }),
  'src-runtime-providers': Object.freeze({
    description: 'src/runtime/providers/**',
    depCruisePathPattern: '^src/runtime/providers(?:/|$)',
  }),
  'src-runtime': Object.freeze({
    description: 'src/runtime/** excluding providers',
    depCruisePathPattern: '^src/runtime/(?!providers(?:/|$))',
  }),
  'src-app-api': Object.freeze({
    description: 'src/app/api/**',
    depCruisePathPattern: '^src/app/api(?:/|$)',
  }),
  'src-app-non-api': Object.freeze({
    description: 'src/app/** excluding api routes',
    depCruisePathPattern: '^src/app/(?!api(?:/|$))',
  }),
  'src-components': Object.freeze({
    description: 'src/components/**',
    depCruisePathPattern: '^src/components(?:/|$)',
  }),
  'src-contexts': Object.freeze({
    description: 'src/contexts/**',
    depCruisePathPattern: '^src/contexts(?:/|$)',
  }),
  'src-hooks': Object.freeze({
    description: 'src/hooks/**',
    depCruisePathPattern: '^src/hooks(?:/|$)',
  }),
  'src-data': Object.freeze({
    description: 'src/data/**',
    depCruisePathPattern: '^src/data(?:/|$)',
  }),
  'src-other': Object.freeze({
    description: 'any other src/** surface not covered above',
    depCruisePathPattern: '^src/',
  }),
  other: Object.freeze({
    description: 'non-src, non-relative, non-external specifiers',
    depCruisePathPattern: null,
  }),
});

const UNIT_ALLOWED_SURFACES = Object.freeze([
  'external',
  'relative',
  'src-lib',
  'src-config-client-facing',
  'src-config-server',
  'src-config',
  'src-repo',
  'src-service',
  'src-runtime',
  'src-app-api',
]);

const INTEGRATION_ALLOWED_SURFACES = Object.freeze([
  'external',
  'relative',
  'src-app-api',
  'src-app-non-api',
  'src-components',
  'src-contexts',
  'src-hooks',
  'src-runtime-providers',
  'src-runtime',
  'src-lib',
  'src-config-client-facing',
  'src-data',
]);

export const TEST_BUCKET_RULES = Object.freeze({
  unit: Object.freeze({
    filePattern: TEST_BUCKET_FILE_PATTERNS.unit,
    description:
      'Unit tests may target lib/config/repo/service/runtime modules and API routes, but not runtime providers or non-API app/UI entry surfaces.',
    allowedSurfaceIds: UNIT_ALLOWED_SURFACES,
    relativePolicy: 'any-relative',
  }),
  integration: Object.freeze({
    filePattern: TEST_BUCKET_FILE_PATTERNS.integration,
    description:
      'Integration tests may target app/components/contexts/hooks/runtime/lib plus client-facing config/data surfaces.',
    allowedSurfaceIds: INTEGRATION_ALLOWED_SURFACES,
    relativePolicy: 'any-relative',
  }),
  e2e: Object.freeze({
    filePattern: TEST_BUCKET_FILE_PATTERNS.e2e,
    description:
      'E2E files may only use external packages, same-feature e2e relatives, or specs/test-utils/e2e-helpers.js.',
    allowedSurfaceIds: Object.freeze(['external', 'relative']),
    relativePolicy: 'same-feature-e2e-or-shared-helper',
  }),
  'specs-test-utils': Object.freeze({
    filePattern: TEST_BUCKET_FILE_PATTERNS['specs-test-utils'],
    description:
      'specs/test-utils may only use external packages or relative imports that stay inside specs/test-utils.',
    allowedSurfaceIds: Object.freeze(['external', 'relative']),
    relativePolicy: 'inside-specs-test-utils-only',
  }),
  'unit-tests-root': Object.freeze({
    filePattern: TEST_BUCKET_FILE_PATTERNS['unit-tests-root'],
    description:
      'Top-level unit tests follow same surface allowlist as legacy specs/<feature>/tests/unit/**.',
    allowedSurfaceIds: UNIT_ALLOWED_SURFACES,
    relativePolicy: 'any-relative',
  }),
  'integration-tests-root': Object.freeze({
    filePattern: TEST_BUCKET_FILE_PATTERNS['integration-tests-root'],
    description:
      'Top-level integration tests follow same surface allowlist as legacy specs/<feature>/tests/integration/**.',
    allowedSurfaceIds: INTEGRATION_ALLOWED_SURFACES,
    relativePolicy: 'any-relative',
  }),
  'e2e-tests-root': Object.freeze({
    filePattern: TEST_BUCKET_FILE_PATTERNS['e2e-tests-root'],
    description:
      'Top-level E2E tests may only use external packages, same-feature e2e relatives, or tests/_helpers/e2e-helpers.js.',
    allowedSurfaceIds: Object.freeze(['external', 'relative']),
    relativePolicy: 'same-feature-e2e-or-shared-helper',
  }),
  'tests-helpers': Object.freeze({
    filePattern: TEST_BUCKET_FILE_PATTERNS['tests-helpers'],
    description:
      'tests/_helpers/** may only use external packages or relatives staying inside tests/_helpers.',
    allowedSurfaceIds: Object.freeze(['external', 'relative']),
    relativePolicy: 'inside-tests-helpers-only',
  }),
});

export const KNOWN_S015_UNIT_CONFLICTS = Object.freeze([]);

export const KNOWN_S015_CONFLICTS = KNOWN_S015_UNIT_CONFLICTS;

const UNIT_ALLOWED_PATH_PATTERNS = Object.freeze([
  '^src/lib(?:/|$)',
  '^src/config(?:/|$)',
  '^src/repo(?:/|$)',
  '^src/service(?:/|$)',
  '^src/runtime/(?!providers(?:/|$))',
  '^src/app/api(?:/|$)',
]);

const INTEGRATION_ALLOWED_PATH_PATTERNS = Object.freeze([
  '^src/app(?:/|$)',
  '^src/components(?:/|$)',
  '^src/contexts(?:/|$)',
  '^src/hooks(?:/|$)',
  '^src/runtime(?:/|$)',
  '^src/lib(?:/|$)',
  '^src/config/(?:client|geo)(?:/|$)',
  '^src/data(?:/|$)',
]);

export const depCruiseTestBucketRules = Object.freeze({
  unit: Object.freeze({
    sourcePattern: TEST_BUCKET_FILE_PATTERNS.unit,
    allowedKinds: Object.freeze(['external', 'relative']),
    allowedPathPatterns: UNIT_ALLOWED_PATH_PATTERNS,
    deniedPathPatterns: DEPCRUISE_DENY_PATTERNS.unit,
  }),
  integration: Object.freeze({
    sourcePattern: TEST_BUCKET_FILE_PATTERNS.integration,
    allowedKinds: Object.freeze(['external', 'relative']),
    allowedPathPatterns: INTEGRATION_ALLOWED_PATH_PATTERNS,
    deniedPathPatterns: DEPCRUISE_DENY_PATTERNS.integration,
  }),
  e2e: Object.freeze({
    sourcePattern: TEST_BUCKET_FILE_PATTERNS.e2e,
    allowedKinds: Object.freeze(['external', 'relative']),
    allowedPathPatterns: Object.freeze([]),
    deniedPathPatterns: DEPCRUISE_DENY_PATTERNS.e2e,
    relativePolicy: 'same-feature-e2e-or-shared-helper',
  }),
  'specs-test-utils': Object.freeze({
    sourcePattern: TEST_BUCKET_FILE_PATTERNS['specs-test-utils'],
    allowedKinds: Object.freeze(['external', 'relative']),
    allowedPathPatterns: Object.freeze([]),
    deniedPathPatterns: DEPCRUISE_DENY_PATTERNS['specs-test-utils'],
    relativePolicy: 'inside-specs-test-utils-only',
  }),
  'unit-tests-root': Object.freeze({
    sourcePattern: TEST_BUCKET_FILE_PATTERNS['unit-tests-root'],
    allowedKinds: Object.freeze(['external', 'relative']),
    allowedPathPatterns: UNIT_ALLOWED_PATH_PATTERNS,
    deniedPathPatterns: DEPCRUISE_DENY_PATTERNS['unit-tests-root'],
  }),
  'integration-tests-root': Object.freeze({
    sourcePattern: TEST_BUCKET_FILE_PATTERNS['integration-tests-root'],
    allowedKinds: Object.freeze(['external', 'relative']),
    allowedPathPatterns: INTEGRATION_ALLOWED_PATH_PATTERNS,
    deniedPathPatterns: DEPCRUISE_DENY_PATTERNS['integration-tests-root'],
  }),
  'e2e-tests-root': Object.freeze({
    sourcePattern: TEST_BUCKET_FILE_PATTERNS['e2e-tests-root'],
    allowedKinds: Object.freeze(['external', 'relative']),
    allowedPathPatterns: Object.freeze([]),
    deniedPathPatterns: DEPCRUISE_DENY_PATTERNS['e2e-tests-root'],
    relativePolicy: 'same-feature-e2e-or-shared-helper',
  }),
  'tests-helpers': Object.freeze({
    sourcePattern: TEST_BUCKET_FILE_PATTERNS['tests-helpers'],
    allowedKinds: Object.freeze(['external', 'relative']),
    allowedPathPatterns: Object.freeze([]),
    deniedPathPatterns: DEPCRUISE_DENY_PATTERNS['tests-helpers'],
    relativePolicy: 'inside-tests-helpers-only',
  }),
});

export const TEST_BUCKET_DEPCRUISE_ARTIFACTS = Object.freeze([
  Object.freeze({
    bucket: 'unit',
    allow: Object.freeze({
      kinds: depCruiseTestBucketRules.unit.allowedKinds,
      resolvedPathPatterns: depCruiseTestBucketRules.unit.allowedPathPatterns,
    }),
    deny: Object.freeze({
      resolvedPathPatterns: depCruiseTestBucketRules.unit.deniedPathPatterns,
    }),
  }),
  Object.freeze({
    bucket: 'integration',
    allow: Object.freeze({
      kinds: depCruiseTestBucketRules.integration.allowedKinds,
      resolvedPathPatterns: depCruiseTestBucketRules.integration.allowedPathPatterns,
    }),
    deny: Object.freeze({
      resolvedPathPatterns: depCruiseTestBucketRules.integration.deniedPathPatterns,
    }),
  }),
  Object.freeze({
    bucket: 'e2e',
    allow: Object.freeze({
      kinds: depCruiseTestBucketRules.e2e.allowedKinds,
      resolvedPathPatterns: depCruiseTestBucketRules.e2e.allowedPathPatterns,
    }),
    deny: Object.freeze({
      resolvedPathPatterns: depCruiseTestBucketRules.e2e.deniedPathPatterns,
    }),
  }),
  Object.freeze({
    bucket: 'specs-test-utils',
    allow: Object.freeze({
      kinds: depCruiseTestBucketRules['specs-test-utils'].allowedKinds,
      resolvedPathPatterns: depCruiseTestBucketRules['specs-test-utils'].allowedPathPatterns,
    }),
    deny: Object.freeze({
      resolvedPathPatterns: depCruiseTestBucketRules['specs-test-utils'].deniedPathPatterns,
    }),
  }),
  Object.freeze({
    bucket: 'unit-tests-root',
    allow: Object.freeze({
      kinds: depCruiseTestBucketRules['unit-tests-root'].allowedKinds,
      resolvedPathPatterns: depCruiseTestBucketRules['unit-tests-root'].allowedPathPatterns,
    }),
    deny: Object.freeze({
      resolvedPathPatterns: depCruiseTestBucketRules['unit-tests-root'].deniedPathPatterns,
    }),
  }),
  Object.freeze({
    bucket: 'integration-tests-root',
    allow: Object.freeze({
      kinds: depCruiseTestBucketRules['integration-tests-root'].allowedKinds,
      resolvedPathPatterns: depCruiseTestBucketRules['integration-tests-root'].allowedPathPatterns,
    }),
    deny: Object.freeze({
      resolvedPathPatterns: depCruiseTestBucketRules['integration-tests-root'].deniedPathPatterns,
    }),
  }),
  Object.freeze({
    bucket: 'e2e-tests-root',
    allow: Object.freeze({
      kinds: depCruiseTestBucketRules['e2e-tests-root'].allowedKinds,
      resolvedPathPatterns: depCruiseTestBucketRules['e2e-tests-root'].allowedPathPatterns,
    }),
    deny: Object.freeze({
      resolvedPathPatterns: depCruiseTestBucketRules['e2e-tests-root'].deniedPathPatterns,
    }),
  }),
  Object.freeze({
    bucket: 'tests-helpers',
    allow: Object.freeze({
      kinds: depCruiseTestBucketRules['tests-helpers'].allowedKinds,
      resolvedPathPatterns: depCruiseTestBucketRules['tests-helpers'].allowedPathPatterns,
    }),
    deny: Object.freeze({
      resolvedPathPatterns: depCruiseTestBucketRules['tests-helpers'].deniedPathPatterns,
    }),
  }),
]);

export const testBucketPolicy = Object.freeze({
  artifactPath: TEST_BUCKET_POLICY_ARTIFACT_PATH,
  fileExtensions: Object.freeze([...TEST_FILE_EXTENSIONS]),
  surfaces: TEST_DEPENDENCY_SURFACES,
  bucketMatchers: TEST_BUCKET_MATCHERS,
  buckets: TEST_BUCKET_RULES,
  depCruise: depCruiseTestBucketRules,
  depCruiseArtifacts: TEST_BUCKET_DEPCRUISE_ARTIFACTS,
  knownS015UnitConflicts: KNOWN_S015_UNIT_CONFLICTS,
});

/**
 * @param {string} filePath
 * @returns {string}
 */
export function normalizeRepoPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * @param {string} filePath
 * @returns {{ bucketId: string, filePath: string, rule: (typeof TEST_BUCKET_RULES)[keyof typeof TEST_BUCKET_RULES] } | null}
 */
export function matchTestBucket(filePath) {
  const normalizedPath = normalizeRepoPath(filePath);

  for (const [bucketId, matcher] of Object.entries(TEST_BUCKET_MATCHERS)) {
    if (matcher.test(normalizedPath)) {
      return Object.freeze({
        bucketId,
        filePath: normalizedPath,
        rule: TEST_BUCKET_RULES[bucketId],
      });
    }
  }

  return null;
}

/**
 * @param {string} filePath
 * @returns {string | null}
 */
export function classifyTestBucket(filePath) {
  return matchTestBucket(filePath)?.bucketId ?? null;
}

/**
 * @param {string} importerPath
 * @param {string} specifier
 * @returns {{ importerPath: string, kind: string, resolvedPath: string | null, specifier: string }}
 */
export function resolveImportSpecifier(importerPath, specifier) {
  const normalizedImporter = normalizeRepoPath(importerPath);
  let kind = 'external';
  let resolvedPath = null;

  if (specifier.startsWith('@/')) {
    kind = 'alias';
    resolvedPath = posix.normalize(`src/${specifier.slice(2)}`);
  } else if (specifier.startsWith('src/')) {
    kind = 'source-absolute';
    resolvedPath = posix.normalize(specifier);
  } else if (specifier.startsWith('.')) {
    kind = 'relative';
    resolvedPath = posix.normalize(posix.join(posix.dirname(normalizedImporter), specifier));
  }

  return Object.freeze({
    importerPath: normalizedImporter,
    specifier,
    kind,
    resolvedPath,
  });
}

/**
 * @param {{ kind: string, resolvedPath: string | null }} reference
 * @returns {string}
 */
export function classifyDependencySurface(reference) {
  if (reference.kind === 'external') {
    return 'external';
  }

  if (reference.kind === 'relative') {
    return 'relative';
  }

  const resolvedPath = reference.resolvedPath ?? '';

  if (resolvedPath.startsWith('src/runtime/providers/')) {
    return 'src-runtime-providers';
  }
  if (resolvedPath.startsWith('src/runtime/')) {
    return 'src-runtime';
  }
  if (resolvedPath.startsWith('src/app/api/')) {
    return 'src-app-api';
  }
  if (resolvedPath.startsWith('src/app/')) {
    return 'src-app-non-api';
  }
  if (resolvedPath.startsWith('src/components/')) {
    return 'src-components';
  }
  if (resolvedPath.startsWith('src/contexts/')) {
    return 'src-contexts';
  }
  if (resolvedPath.startsWith('src/hooks/')) {
    return 'src-hooks';
  }
  if (resolvedPath.startsWith('src/config/client/') || resolvedPath.startsWith('src/config/geo/')) {
    return 'src-config-client-facing';
  }
  if (resolvedPath.startsWith('src/config/server/')) {
    return 'src-config-server';
  }
  if (resolvedPath.startsWith('src/config/')) {
    return 'src-config';
  }
  if (resolvedPath.startsWith('src/repo/')) {
    return 'src-repo';
  }
  if (resolvedPath.startsWith('src/service/')) {
    return 'src-service';
  }
  if (resolvedPath.startsWith('src/lib/')) {
    return 'src-lib';
  }
  if (resolvedPath.startsWith('src/data/')) {
    return 'src-data';
  }
  if (resolvedPath.startsWith('src/')) {
    return 'src-other';
  }

  return 'other';
}

/**
 * @param {string} bucketId
 * @param {{ importerPath: string, resolvedPath: string | null }} reference
 * @returns {boolean}
 */
function isAllowedRelativeDependency(bucketId, reference) {
  if (
    bucketId === 'unit' ||
    bucketId === 'integration' ||
    bucketId === 'unit-tests-root' ||
    bucketId === 'integration-tests-root'
  ) {
    return true;
  }

  if (!reference.resolvedPath) {
    return false;
  }

  if (bucketId === 'specs-test-utils') {
    return (
      reference.resolvedPath === 'specs/test-utils' ||
      reference.resolvedPath.startsWith('specs/test-utils/')
    );
  }

  if (bucketId === 'tests-helpers') {
    return (
      reference.resolvedPath === 'tests/_helpers' ||
      reference.resolvedPath.startsWith('tests/_helpers/')
    );
  }

  if (bucketId === 'e2e' || bucketId === 'e2e-tests-root') {
    const featureRootMatch = reference.importerPath.match(
      /^(specs\/.+\/tests\/e2e|tests\/e2e(?:\/[^/]+)?)(?:\/|$)/,
    );
    if (!featureRootMatch) {
      return false;
    }

    const featureRoot = featureRootMatch[1];
    return (
      reference.resolvedPath === 'specs/test-utils/e2e-helpers.js' ||
      reference.resolvedPath === 'tests/_helpers/e2e-helpers.js' ||
      reference.resolvedPath === featureRoot ||
      reference.resolvedPath.startsWith(`${featureRoot}/`)
    );
  }

  return false;
}

/**
 * @param {string} bucketId
 * @param {string} surfaceId
 * @returns {string}
 */
function buildViolationReason(bucketId, surfaceId) {
  const surface = TEST_DEPENDENCY_SURFACES[surfaceId];
  const bucketLabel = `${bucketId} bucket`;

  if (surfaceId === 'relative' && bucketId === 'e2e') {
    return 'e2e bucket only allows same-feature relatives or specs/test-utils/e2e-helpers.js';
  }

  if (surfaceId === 'relative' && bucketId === 'specs-test-utils') {
    return 'specs-test-utils bucket only allows relatives that stay inside specs/test-utils';
  }

  return `${bucketLabel} does not allow ${surface.description}`;
}

/**
 * @param {string} importerPath
 * @param {string} specifier
 * @returns {{
 *   allowed: boolean,
 *   bucketId: string | null,
 *   importerPath: string,
 *   reason: string | null,
 *   resolvedPath: string | null,
 *   specifier: string,
 *   surfaceId: string,
 * }}
 */
export function evaluateTestDependency(importerPath, specifier) {
  const normalizedImporter = normalizeRepoPath(importerPath);
  const bucketId = classifyTestBucket(normalizedImporter);

  if (!bucketId) {
    return Object.freeze({
      importerPath: normalizedImporter,
      specifier,
      bucketId: null,
      surfaceId: 'other',
      resolvedPath: null,
      allowed: false,
      reason: 'file does not belong to a supported test bucket',
    });
  }

  const reference = resolveImportSpecifier(normalizedImporter, specifier);
  const surfaceId = classifyDependencySurface(reference);
  const bucketRule = TEST_BUCKET_RULES[bucketId];

  let allowed = bucketRule.allowedSurfaceIds.includes(surfaceId);
  if (allowed && surfaceId === 'relative') {
    allowed = isAllowedRelativeDependency(bucketId, reference);
  }

  return Object.freeze({
    importerPath: reference.importerPath,
    specifier,
    bucketId,
    surfaceId,
    resolvedPath: reference.resolvedPath,
    allowed,
    reason: allowed ? null : buildViolationReason(bucketId, surfaceId),
  });
}

/**
 * @param {string} importerPath
 * @param {string} specifier
 * @returns {boolean}
 */
export function isAllowedTestDependency(importerPath, specifier) {
  return evaluateTestDependency(importerPath, specifier).allowed;
}

/**
 * @param {string} filePath
 * @returns {(typeof KNOWN_S015_UNIT_CONFLICTS)[number] | null}
 */
export function getKnownS015Conflict(filePath) {
  const normalizedPath = normalizeRepoPath(filePath);
  return KNOWN_S015_UNIT_CONFLICTS.find((entry) => entry.filePath === normalizedPath) ?? null;
}

/**
 * @param {unknown} node
 * @returns {node is { type: 'StringLiteral', value: string }}
 */
function isStringLiteralNode(node) {
  const typedNode = /** @type {{ type?: unknown }} */ (node);
  return Boolean(typedNode && typeof typedNode === 'object' && typedNode.type === 'StringLiteral');
}

/**
 * @param {unknown} node
 * @param {(node: Record<string, unknown>) => void} visitor
 * @returns {void}
 */
function walkAstNode(node, visitor) {
  if (!node || typeof node !== 'object') {
    return;
  }

  const typedNode = /** @type {Record<string, unknown>} */ (node);
  visitor(typedNode);

  for (const value of Object.values(typedNode)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        walkAstNode(item, visitor);
      }
      continue;
    }

    const typedValue = /** @type {{ type?: unknown }} */ (value);
    if (value && typeof value === 'object' && typeof typedValue.type === 'string') {
      walkAstNode(value, visitor);
    }
  }
}

/**
 * @typedef {{
 *   arguments?: unknown[],
 *   callee?: {
 *     object?: { name?: unknown, type?: unknown },
 *     property?: { name?: unknown, type?: unknown },
 *     type?: unknown,
 *   },
 *   source?: unknown,
 *   type?: string,
 * }} ParsedModuleNode
 */

/**
 * @param {string} sourceText
 * @param {string} [sourceFilePath]
 * @returns {string[]}
 */
export function extractModuleSpecifiers(sourceText, sourceFilePath = 'unknown.js') {
  const ast = parse(sourceText, {
    sourceType: 'module',
    sourceFilename: sourceFilePath,
    createImportExpressions: true,
    plugins: ['jsx', 'topLevelAwait'],
  });

  const specifiers = new Set();

  walkAstNode(ast, (rawNode) => {
    const node = /** @type {ParsedModuleNode} */ (rawNode);

    if (
      (node.type === 'ImportDeclaration' ||
        node.type === 'ExportAllDeclaration' ||
        node.type === 'ExportNamedDeclaration') &&
      isStringLiteralNode(node.source)
    ) {
      specifiers.add(node.source.value);
      return;
    }

    if (node.type === 'ImportExpression' && isStringLiteralNode(node.source)) {
      specifiers.add(node.source.value);
      return;
    }

    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Import' &&
      isStringLiteralNode(node.arguments?.[0])
    ) {
      specifiers.add(node.arguments[0].value);
      return;
    }

    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'MemberExpression' &&
      node.callee.object?.type === 'Identifier' &&
      node.callee.object.name === 'vi' &&
      node.callee.property?.type === 'Identifier' &&
      node.callee.property.name === 'mock' &&
      isStringLiteralNode(node.arguments?.[0])
    ) {
      specifiers.add(node.arguments[0].value);
    }
  });

  return [...specifiers].sort((left, right) => left.localeCompare(right));
}

/**
 * @param {string} dirPath
 * @param {string} rootDir
 * @returns {string[]}
 */
function walkPolicyFiles(dirPath, rootDir) {
  const files = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const nextPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkPolicyFiles(nextPath, rootDir));
      continue;
    }

    if (!TEST_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      continue;
    }

    const repoRelativePath = normalizeRepoPath(path.relative(rootDir, nextPath));
    if (classifyTestBucket(repoRelativePath)) {
      files.push(repoRelativePath);
    }
  }

  return files;
}

/**
 * @param {string} [rootDir]
 * @returns {string[]}
 */
export function collectTestBucketFiles(rootDir = process.cwd()) {
  const specsRoot = path.resolve(rootDir, 'specs');
  if (!fs.existsSync(specsRoot)) {
    return [];
  }

  return walkPolicyFiles(specsRoot, rootDir).sort((left, right) => left.localeCompare(right));
}

/**
 * @param {string} [rootDir]
 * @returns {{
 *   files: readonly string[],
 *   imports: readonly ReturnType<typeof evaluateTestDependency>[],
 *   rootDir: string,
 *   violations: readonly ReturnType<typeof evaluateTestDependency>[],
 * }}
 */
export function scanRepoTestImportGraph(rootDir = process.cwd()) {
  const files = collectTestBucketFiles(rootDir);
  const imports = [];

  for (const filePath of files) {
    const absolutePath = path.resolve(rootDir, filePath);
    const sourceText = fs.readFileSync(absolutePath, 'utf8');

    if (!sourceText) {
      continue;
    }

    const specifiers = extractModuleSpecifiers(sourceText, filePath);
    for (const specifier of specifiers) {
      imports.push(evaluateTestDependency(filePath, specifier));
    }
  }

  const violations = imports.filter((entry) => !entry.allowed);

  return Object.freeze({
    rootDir: normalizeRepoPath(rootDir),
    files: Object.freeze(files),
    imports: Object.freeze(imports),
    violations: Object.freeze(violations),
  });
}

/**
 * @param {{ violations: readonly ReturnType<typeof evaluateTestDependency>[] }} graph
 * @param {string} bucketId
 * @returns {ReturnType<typeof evaluateTestDependency>[]}
 */
export function collectBucketViolations(graph, bucketId) {
  return graph.violations
    .filter((entry) => entry.bucketId === bucketId)
    .sort((left, right) =>
      `${left.importerPath}::${left.specifier}`.localeCompare(
        `${right.importerPath}::${right.specifier}`,
      ),
    );
}

/**
 * @param {ReturnType<typeof evaluateTestDependency>} evaluation
 * @returns {string}
 */
function getVerdictKind(evaluation) {
  if (evaluation.resolvedPath === 'specs/test-utils/e2e-helpers.js') {
    return 'specs-test-utils-helper';
  }
  if (evaluation.surfaceId === 'src-runtime-providers') {
    return 'src-runtime-provider';
  }
  if (evaluation.surfaceId === 'src-config-client-facing') {
    return 'src-config-client';
  }
  return evaluation.surfaceId;
}

/**
 * @param {string} importerPath
 * @param {string} specifier
 * @returns {ReturnType<typeof evaluateTestDependency> & { kind: string, verdict: 'allow' | 'deny' }}
 */
export function evaluateBucketImport(importerPath, specifier) {
  const evaluation = evaluateTestDependency(importerPath, specifier);

  return Object.freeze({
    ...evaluation,
    kind: getVerdictKind(evaluation),
    verdict: evaluation.allowed ? 'allow' : 'deny',
  });
}

/**
 * @param {{ violations: readonly ReturnType<typeof evaluateTestDependency>[] }} graph
 * @param {string} bucketId
 * @returns {{ edgeCount: number, fileCount: number, files: string[] }}
 */
export function summarizeBucketViolations(graph, bucketId) {
  const violations = collectBucketViolations(graph, bucketId);
  const files = [...new Set(violations.map((entry) => entry.importerPath))];

  return Object.freeze({
    fileCount: files.length,
    edgeCount: violations.length,
    files,
  });
}

export const evaluateTestModuleSpecifier = evaluateTestDependency;
