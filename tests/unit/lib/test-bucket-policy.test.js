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
    expect(classifyTestBucket('tests/unit/lib/foo.test.js')).toBe('unit-tests-root');
    expect(classifyTestBucket('tests/integration/events/foo.test.jsx')).toBe(
      'integration-tests-root',
    );
    expect(classifyTestBucket('tests/e2e/notification-flow.spec.js')).toBe('e2e-tests-root');
    expect(classifyTestBucket('tests/_helpers/e2e-helpers.js')).toBe('tests-helpers');
    expect(
      classifyTestBucket('specs/021-layered-dependency-architecture/test-buckets/policy.js'),
    ).toBe(null);
  });

  it('allows and denies representative imports for each bucket', () => {
    expect(
      evaluateBucketImport(
        'tests/unit/runtime/post-use-cases.test.js',
        '@/runtime/client/use-cases/post-use-cases',
      ),
    ).toMatchObject({
      verdict: 'allow',
      kind: 'src-runtime',
    });

    expect(
      evaluateBucketImport(
        'tests/unit/config/firebase-admin.test.js',
        '@/config/server/firebase-admin-app',
      ),
    ).toMatchObject({
      verdict: 'allow',
      kind: 'src-config-server',
    });

    expect(
      evaluateBucketImport(
        'tests/unit/runtime/toast-context.test.jsx',
        '@/runtime/providers/ToastProvider',
      ),
    ).toMatchObject({
      verdict: 'deny',
      kind: 'src-runtime-provider',
    });

    expect(
      evaluateBucketImport(
        'tests/integration/strava/useStravaConnection.test.jsx',
        '@/config/client/firebase-client',
      ),
    ).toMatchObject({
      verdict: 'allow',
      kind: 'src-config-client',
    });

    expect(
      evaluateBucketImport(
        'tests/integration/notifications/notification-triggers.test.jsx',
        '@/repo/client/firebase-notifications-repo',
      ),
    ).toMatchObject({
      verdict: 'deny',
      kind: 'src-repo',
    });

    expect(
      evaluateBucketImport('tests/e2e/event-comments.spec.js', '../_helpers/e2e-helpers.js'),
    ).toMatchObject({
      verdict: 'allow',
      kind: 'tests-helpers-e2e-helper',
      resolvedPath: 'tests/_helpers/e2e-helpers.js',
    });

    expect(
      evaluateBucketImport('tests/e2e/comment-notification-flow.spec.js', '@/app/events/page'),
    ).toMatchObject({
      verdict: 'deny',
      kind: 'src-app-non-api',
    });

    expect(
      evaluateBucketImport('tests/_helpers/mock-helpers.js', './e2e-helpers.js'),
    ).toMatchObject({
      verdict: 'allow',
      kind: 'tests-helpers-e2e-helper',
      resolvedPath: 'tests/_helpers/e2e-helpers.js',
    });

    expect(
      evaluateBucketImport('tests/_helpers/e2e-helpers.js', '@/lib/firebase-events'),
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
      'unit-tests-root',
      'integration-tests-root',
      'e2e-tests-root',
      'tests-helpers',
    ]);
    expect(
      TEST_BUCKET_DEPCRUISE_ARTIFACTS.find((artifact) => artifact.bucket === 'unit-tests-root'),
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
    expect(testBucketPolicy.depCruise['integration-tests-root'].allowedPathPatterns).toContain(
      '^src/config/(?:client|geo)(?:/|$)',
    );
  });

  it('pins the repo-wide import graph to zero violations across all four buckets after S015', () => {
    const graph = scanRepoTestImportGraph();

    expect(graph.files.length).toBeGreaterThan(0);

    expect(summarizeBucketViolations(graph, 'unit-tests-root')).toMatchObject({
      fileCount: 0,
      edgeCount: 0,
      files: [],
    });
    expect(summarizeBucketViolations(graph, 'integration-tests-root')).toMatchObject({
      fileCount: 0,
      edgeCount: 0,
      files: [],
    });
    expect(summarizeBucketViolations(graph, 'e2e-tests-root')).toMatchObject({
      fileCount: 0,
      edgeCount: 0,
      files: [],
    });
    expect(summarizeBucketViolations(graph, 'tests-helpers')).toMatchObject({
      fileCount: 0,
      edgeCount: 0,
      files: [],
    });
  });
});
