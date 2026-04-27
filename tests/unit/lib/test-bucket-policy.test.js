// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  TEST_BUCKET_DEPCRUISE_ARTIFACTS,
  classifyTestBucket,
  evaluateBucketImport,
  scanRepoTestImportGraph,
  summarizeBucketViolations,
  testBucketPolicy,
} from '../../../specs/021-layered-dependency-architecture/test-bucket-policy.js';

describe('S014 test bucket policy', () => {
  it('classifies the four bucket paths', () => {
    expect(
      classifyTestBucket('specs/021-layered-dependency-architecture/tests/unit/foo.test.js'),
    ).toBe('unit');
    expect(
      classifyTestBucket(
        'specs/021-layered-dependency-architecture/tests/integration/foo.test.jsx',
      ),
    ).toBe('integration');
    expect(
      classifyTestBucket('specs/014-notification-system/tests/e2e/notification-flow.spec.js'),
    ).toBe('e2e');
    expect(classifyTestBucket('specs/test-utils/e2e-helpers.js')).toBe('specs-test-utils');
    expect(
      classifyTestBucket('specs/021-layered-dependency-architecture/test-buckets/policy.js'),
    ).toBe(null);
  });

  it('allows and denies representative imports for each bucket', () => {
    expect(
      evaluateBucketImport(
        'specs/021-layered-dependency-architecture/tests/unit/post-use-cases.test.js',
        '@/runtime/client/use-cases/post-use-cases',
      ),
    ).toMatchObject({
      verdict: 'allow',
      kind: 'src-runtime',
    });

    expect(
      evaluateBucketImport(
        'specs/g8-server-coverage/tests/unit/firebase-admin.test.js',
        '@/config/server/firebase-admin-app',
      ),
    ).toMatchObject({
      verdict: 'allow',
      kind: 'src-config-server',
    });

    expect(
      evaluateBucketImport(
        'specs/009-global-toast/tests/unit/toast-context.test.jsx',
        '@/runtime/providers/ToastProvider',
      ),
    ).toMatchObject({
      verdict: 'deny',
      kind: 'src-runtime-provider',
    });

    expect(
      evaluateBucketImport(
        'specs/006-strava-running-records/tests/integration/useStravaConnection.test.jsx',
        '@/config/client/firebase-client',
      ),
    ).toMatchObject({
      verdict: 'allow',
      kind: 'src-config-client',
    });

    expect(
      evaluateBucketImport(
        'specs/014-notification-system/tests/integration/notification-triggers.test.jsx',
        '@/repo/client/firebase-notifications-repo',
      ),
    ).toMatchObject({
      verdict: 'deny',
      kind: 'src-repo',
    });

    expect(
      evaluateBucketImport(
        'specs/005-event-comments/tests/e2e/event-comments.spec.js',
        '../../../test-utils/e2e-helpers.js',
      ),
    ).toMatchObject({
      verdict: 'allow',
      kind: 'specs-test-utils-helper',
      resolvedPath: 'specs/test-utils/e2e-helpers.js',
    });

    expect(
      evaluateBucketImport(
        'specs/014-notification-system/tests/e2e/comment-notification-flow.spec.js',
        '@/app/events/page',
      ),
    ).toMatchObject({
      verdict: 'deny',
      kind: 'src-app-non-api',
    });

    expect(
      evaluateBucketImport('specs/test-utils/mock-helpers.js', './e2e-helpers.js'),
    ).toMatchObject({
      verdict: 'allow',
      kind: 'specs-test-utils-helper',
      resolvedPath: 'specs/test-utils/e2e-helpers.js',
    });

    expect(
      evaluateBucketImport('specs/test-utils/e2e-helpers.js', '@/lib/firebase-events'),
    ).toMatchObject({
      verdict: 'deny',
      kind: 'src-lib',
    });
  });

  it('exports the future S016 dep-cruise registry from the canonical artifact', () => {
    expect(testBucketPolicy.artifactPath).toBe(
      'specs/021-layered-dependency-architecture/test-bucket-policy.js',
    );
    expect(TEST_BUCKET_DEPCRUISE_ARTIFACTS.map((artifact) => artifact.bucket)).toEqual([
      'unit',
      'integration',
      'e2e',
      'specs-test-utils',
      'unit-tests-root',
      'integration-tests-root',
      'e2e-tests-root',
      'tests-helpers',
    ]);
    expect(
      TEST_BUCKET_DEPCRUISE_ARTIFACTS.find((artifact) => artifact.bucket === 'unit'),
    ).toMatchObject({
      allow: {
        resolvedPathPatterns: expect.arrayContaining(['^src/runtime/(?!providers(?:/|$))']),
      },
      deny: {
        resolvedPathPatterns: expect.arrayContaining([
          '^src/runtime/providers(?:/|$)',
          '^src/components(?:/|$)',
          '^src/app/(?!api(?:/|$))',
        ]),
      },
    });
    expect(testBucketPolicy.depCruise.integration.allowedPathPatterns).toContain(
      '^src/config/(?:client|geo)(?:/|$)',
    );
  });

  it('pins the repo-wide import graph to zero violations across all four buckets after S015', () => {
    const graph = scanRepoTestImportGraph();

    expect(graph.files.length).toBeGreaterThan(0);

    const unitSummary = summarizeBucketViolations(graph, 'unit');
    expect(unitSummary).toMatchObject({
      fileCount: 0,
      edgeCount: 0,
      files: [],
    });

    expect(summarizeBucketViolations(graph, 'integration')).toMatchObject({
      fileCount: 0,
      edgeCount: 0,
      files: [],
    });
    expect(summarizeBucketViolations(graph, 'e2e')).toMatchObject({
      fileCount: 0,
      edgeCount: 0,
      files: [],
    });
    expect(summarizeBucketViolations(graph, 'specs-test-utils')).toMatchObject({
      fileCount: 0,
      edgeCount: 0,
      files: [],
    });
  });
});
