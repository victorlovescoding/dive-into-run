import {
  depCruiseTestBucketRules,
  TEST_BUCKET_DEPCRUISE_ARTIFACTS,
  TEST_BUCKET_POLICY_ARTIFACT_PATH,
} from './specs/021-layered-dependency-architecture/test-bucket-policy.js';

const JS_MODULE_EXTENSIONS = ['.js', '.jsx', '.mjs'];
const NON_RUNTIME_DEPENDENCY_TYPES = [
  'type-only',
  'type-import',
  'jsdoc',
  'jsdoc-bracket-import',
  'jsdoc-import-tag',
  'triple-slash-type-reference',
  'triple-slash-file-reference',
  'triple-slash-directive',
];

const CANONICAL_LAYER_PATTERNS = Object.freeze({
  types: '^src/types(?:/|$)',
  config: '^src/config(?:/|$)',
  repo: '^src/repo(?:/|$)',
  service: '^src/service(?:/|$)',
  runtime: '^src/runtime(?:/|$)',
  ui: '^src/ui(?:/|$)',
});

const SERVER_ONLY_PATTERN =
  '^(?:src/(?:config|repo|runtime)/server(?:/|$)|src/.+\\.server\\.(?:js|jsx|mjs)$)';
const CLIENTISH_IMPORTER_PATTERN = [
  '^src/ui(?:/|$)',
  '^src/components(?:/|$)',
  '^src/contexts(?:/|$)',
  '^src/hooks(?:/|$)',
  '^src/runtime/(?!server(?:/|$))',
  '^src/repo/client(?:/|$)',
  '^src/config/(?:client|geo)(?:/|$)',
  '^src/app/(?!api(?:/|$))',
].join('|');

/**
 * Removes start/end anchors so individual regex fragments can be merged.
 * @param {string} pattern - Anchored dependency-cruiser regex fragment.
 * @returns {string} The fragment without leading/trailing anchors.
 */
function stripRegexAnchors(pattern) {
  return pattern.replace(/^\^/, '').replace(/\$$/, '');
}

/**
 * Combines multiple anchored path regexes into one anchored alternation.
 * @param {string[]} patterns - Canonical dependency-cruiser path patterns.
 * @returns {string} One merged path alternation.
 */
function combinePathPatterns(patterns) {
  return `^(?:${patterns.map(stripRegexAnchors).join('|')})`;
}

/**
 * Appends the non-runtime dependency-type filter shared by all production rules.
 * @param {Record<string, unknown>} [matcher] - Base dependency-cruiser matcher.
 * @returns {Record<string, unknown>} Matcher guarded against type-only/jsdoc edges.
 */
function withDependencyTypeFilter(matcher = {}) {
  return {
    ...matcher,
    dependencyTypesNot: NON_RUNTIME_DEPENDENCY_TYPES,
  };
}

/**
 * Builds the forward-only canonical layer rules by forbidding higher-layer imports.
 * @returns {object[]} dependency-cruiser forbidden rules.
 */
function createLayerDirectionRules() {
  const layerOrder = ['types', 'config', 'repo', 'service', 'runtime', 'ui'];

  return layerOrder.slice(0, -1).map((layerName, index) => ({
    name: `${layerName}-no-higher-layer-imports`,
    comment: `${layerName} may not depend on canonical layers above it in the forward-only architecture.`,
    severity: 'error',
    from: {
      path: CANONICAL_LAYER_PATTERNS[layerName],
    },
    to: withDependencyTypeFilter({
      path: combinePathPatterns(
        layerOrder
          .slice(index + 1)
          .map((otherLayerName) => CANONICAL_LAYER_PATTERNS[otherLayerName]),
      ),
    }),
  }));
}

/**
 * Materializes the S014 test bucket artifact into dependency-cruiser rules.
 * @returns {object[]} dependency-cruiser forbidden rules.
 */
function createTestBucketRules() {
  return TEST_BUCKET_DEPCRUISE_ARTIFACTS.flatMap((artifact) => {
    const bucketRule = depCruiseTestBucketRules[artifact.bucket];
    const explicitDeniedPatterns = artifact.deny.resolvedPathPatterns;
    const knownInternalPatterns = [
      ...artifact.allow.resolvedPathPatterns,
      ...artifact.deny.resolvedPathPatterns,
    ];
    const rules = [];

    if (explicitDeniedPatterns.length > 0) {
      rules.push({
        name: `tests-${artifact.bucket}-deny-known-internal-surfaces`,
        comment: `${TEST_BUCKET_POLICY_ARTIFACT_PATH} forbids these resolved src/** surfaces for the ${artifact.bucket} bucket.`,
        severity: 'error',
        from: {
          path: bucketRule.sourcePattern,
        },
        to: withDependencyTypeFilter({
          path: combinePathPatterns(explicitDeniedPatterns),
        }),
      });
    }

    if (artifact.allow.resolvedPathPatterns.length > 0) {
      rules.push({
        name: `tests-${artifact.bucket}-reject-unknown-internal-surfaces`,
        comment: `${TEST_BUCKET_POLICY_ARTIFACT_PATH} only allows the canonical resolved src/** surfaces for the ${artifact.bucket} bucket.`,
        severity: 'error',
        from: {
          path: bucketRule.sourcePattern,
        },
        to: withDependencyTypeFilter({
          path: '^src/',
          pathNot: combinePathPatterns(knownInternalPatterns),
        }),
      });
    }

    return rules;
  });
}

const forbidden = [
  ...createLayerDirectionRules(),
  {
    name: 'provider-no-repo',
    comment: 'Runtime providers must not import repo adapters directly.',
    severity: 'error',
    from: {
      path: '^src/runtime/providers(?:/|$)',
    },
    to: withDependencyTypeFilter({
      path: '^src/repo(?:/|$)',
    }),
  },
  {
    name: 'entry-no-config-repo-direct-import',
    comment: 'App-router files under src/app/** may not import config or repo directly.',
    severity: 'error',
    from: {
      path: '^src/app(?:/|$)',
    },
    to: withDependencyTypeFilter({
      path: '^src/(?:config|repo)(?:/|$)',
    }),
  },
  {
    name: 'server-only-no-client-import',
    comment: 'Client/runtime/ui surfaces and non-api app-router files may not import server-only modules.',
    severity: 'error',
    from: {
      path: `(?:${CLIENTISH_IMPORTER_PATTERN})`,
    },
    to: withDependencyTypeFilter({
      path: SERVER_ONLY_PATTERN,
    }),
  },
  {
    name: 'production-no-specs-import',
    comment: 'Production code under src/** may not depend on specs/**.',
    severity: 'error',
    from: {
      path: '^src/',
    },
    to: withDependencyTypeFilter({
      path: '^specs/',
    }),
  },
  ...createTestBucketRules(),
];

export default {
  forbidden,
  options: {
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: JS_MODULE_EXTENSIONS,
      mainFields: ['browser', 'module', 'main', 'types'],
    },
    skipAnalysisNotInRules: true,
  },
};
