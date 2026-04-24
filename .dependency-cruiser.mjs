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
 * @param {readonly string[]} patterns - Canonical dependency-cruiser path patterns.
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

  return layerOrder.slice(0, -1).map((layerName, index) => {
    const higherLayers = layerOrder.slice(index + 1).join(', ');
    return {
      name: `${layerName}-no-higher-layer-imports`,
      comment: `${layerName} layer imports a higher layer (${higherLayers}). Move the needed function down to src/${layerName}/ or src/types/, or accept the value as a parameter from a higher-layer caller. If this is a type-only reference, switch to a JSDoc @typedef import which is exempt from this rule.`,
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
    };
  });
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
        comment: `${artifact.bucket} test imports a denied src/** surface. ${TEST_BUCKET_POLICY_ARTIFACT_PATH} forbids this import for the ${artifact.bucket} bucket. Move the import to an allowed surface or restructure the test to use a higher-level API. Run: grep '${artifact.bucket}' ${TEST_BUCKET_POLICY_ARTIFACT_PATH} to see allowed/denied surfaces.`,
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
        comment: `${artifact.bucket} test imports an unknown src/** surface not listed in the policy. ${TEST_BUCKET_POLICY_ARTIFACT_PATH} only allows explicitly registered surfaces for the ${artifact.bucket} bucket. Register the new surface in the policy file or change the import to an already-allowed surface. Run: grep '${artifact.bucket}' ${TEST_BUCKET_POLICY_ARTIFACT_PATH} to see the current allowlist.`,
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
    name: 'canonical-no-import-lib',
    comment:
      'Canonical layer runtime-imports src/lib/**. Import from the canonical home instead (e.g. @/lib/firebase-events → @/repo/client/firebase-events-repo). Type-only imports via JSDoc are exempt. To find the canonical target: grep the src/lib/ facade file for its re-export source.',
    severity: 'error',
    from: {
      path: combinePathPatterns(Object.values(CANONICAL_LAYER_PATTERNS)),
    },
    to: withDependencyTypeFilter({
      path: '^src/lib(?:/|$)',
    }),
  },
  {
    name: 'provider-no-repo',
    comment:
      'Runtime provider imports a repo adapter directly. Route through a use-case in src/service/ or src/runtime/ instead (e.g. src/runtime/providers/EventProvider.js should call a use-case from src/service/event-service.js, not import @/repo/client/firebase-events-repo directly).',
    severity: 'error',
    from: {
      path: '^src/runtime/providers(?:/|$)',
    },
    to: withDependencyTypeFilter({
      path: '^src/repo(?:/|$)',
    }),
  },
  {
    name: 'provider-no-service',
    comment:
      'Provider imports a service-layer module directly. Providers inject cross-cutting ' +
      'context only (auth, notifications, toast). Business logic belongs in use-cases ' +
      'under src/runtime/client/use-cases/. If a provider needs service-layer data, ' +
      'route it through a use-case.',
    severity: 'error',
    from: {
      path: '^src/runtime/providers(?:/|$)',
    },
    to: withDependencyTypeFilter({
      path: '^src/service(?:/|$)',
    }),
  },
  {
    name: 'entry-no-config-repo-direct-import',
    comment:
      'App-router file imports config or repo directly. Use a service-layer or runtime-layer module instead (e.g. src/app/events/page.jsx should import from @/service/event-service or @/runtime/events/, not from @/config/ or @/repo/ directly).',
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
    comment:
      'Client-side or non-api app-router file imports a server-only module (src/**/server/** or *.server.js). Move the server logic behind an API route (src/app/api/) or a Server Component, then fetch from the client. Example: replace `import { db } from "@/config/server/firebase-admin-app"` with a fetch call to an API route that uses it.',
    severity: 'error',
    from: {
      path: `(?:${CLIENTISH_IMPORTER_PATTERN})`,
    },
    to: withDependencyTypeFilter({
      path: SERVER_ONLY_PATTERN,
    }),
  },
  {
    name: 'server-deps-require-server-path',
    comment:
      'File importing firebase-admin or firebase-admin-app is not in a server path ' +
      '(src/*/server/ or *.server.js). Move this file to src/{layer}/server/ or rename ' +
      'to *.server.js. If you only need a type, use a JSDoc @typedef import instead.',
    severity: 'error',
    from: {
      path: '^src/',
      pathNot: SERVER_ONLY_PATTERN,
    },
    to: withDependencyTypeFilter({
      path: '^(?:node_modules/firebase-admin|src/config/server/firebase-admin-app)',
    }),
  },
  {
    name: 'production-no-specs-import',
    comment:
      'Production code under src/** imports from specs/**. Move the needed utility into src/ (e.g. src/lib/ or src/types/) so it is available without a test-tree dependency. If this is test-only setup code, it belongs in specs/ and must not be imported by src/.',
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
