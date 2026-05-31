import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const checkerScript = resolve(process.cwd(), 'scripts/check-superpowers-state.js');
const validatorScript = resolve(process.cwd(), 'scripts/validate-workflow-state.js');

/**
 * Runs a git command in the fixture repository.
 * @param {string} cwd - Fixture repository path.
 * @param {string[]} args - Git arguments.
 * @returns {string} Trimmed stdout.
 */
function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/**
 * Writes a text file inside the fixture repository, creating parent dirs.
 * @param {string} repoPath - Fixture repository path.
 * @param {string} filePath - Repo-relative file path.
 * @param {string} text - File contents.
 * @returns {void} No return value.
 */
function writeRepoFile(repoPath, filePath, text) {
  const absolutePath = join(repoPath, filePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, text);
}

/**
 * Creates the minimal v3 status shape accepted by the workflow validator.
 * @param {{branch: string, lastVerifiedCommit: string}} options - Status inputs.
 * @returns {Record<string, unknown>} Status object.
 */
function createCloseoutStatus({ branch, lastVerifiedCommit }) {
  return {
    schemaVersion: 3,
    feature: 'Historical workflow',
    branch,
    worktree: '/tmp/historical-workflow',
    phase: 'ready_for_pr',
    activeTask: null,
    activeWave: null,
    authorizationBoundary: {
      edit: false,
      commit: false,
      push: false,
      pullRequest: false,
      ciWatch: false,
      merge: false,
      localMainSync: false,
      deployFirestoreRules: false,
    },
    currentHead: {
      branch,
      commit: lastVerifiedCommit,
      capturedAt: '2026-05-31T00:00:00Z',
      summary: 'Historical closeout head.',
    },
    remoteHead: null,
    completedTasks: [],
    tasks: [],
    blocked: false,
    blockedReason: null,
    lastVerification: [
      {
        command: 'npm run workflow:check',
        exitCode: 0,
        summary: 'Historical closeout verification passed.',
        verifiedAt: '2026-05-31T00:00:00Z',
      },
    ],
    lastVerifiedCommit,
    phaseCommits: [],
    rulesDeployStatus: {
      state: 'not_applicable',
      required: false,
      changed: false,
      evidence: [],
      deployedCommit: null,
    },
    incidents: [],
    updatedAt: '2026-05-31T00:00:00Z',
  };
}

/**
 * Creates a temp git repository where an old closeout status predates an unrelated current product commit.
 * @returns {{repoPath: string, statusPath: string}} Fixture paths.
 */
function createHistoricalCloseoutFixture() {
  const repoPath = mkdtempSync(join(tmpdir(), 'workflow-check-'));
  const scriptsPath = join(repoPath, 'scripts');
  mkdirSync(scriptsPath, { recursive: true });
  cpSync(validatorScript, join(scriptsPath, 'validate-workflow-state.js'));

  git(repoPath, ['init', '--initial-branch=current-feature']);
  git(repoPath, ['config', 'user.email', 'workflow-check@example.test']);
  git(repoPath, ['config', 'user.name', 'Workflow Check Test']);

  writeRepoFile(repoPath, 'src/baseline.js', 'export const baseline = true;\n');
  git(repoPath, ['add', '.']);
  git(repoPath, ['commit', '-m', 'Initial verified state']);
  const verifiedCommit = git(repoPath, ['rev-parse', 'HEAD']);

  const statusPath = 'specs/historical/status.json';
  writeRepoFile(repoPath, statusPath, `${JSON.stringify(createCloseoutStatus({
    branch: 'historical-feature',
    lastVerifiedCommit: verifiedCommit,
  }), null, 2)}\n`);
  writeRepoFile(repoPath, 'specs/historical/handoff.md', '# Historical\n');
  writeRepoFile(repoPath, 'specs/historical/tasks.md', '# Historical Tasks\n');
  git(repoPath, ['add', '.']);
  git(repoPath, ['commit', '-m', 'Record historical closeout']);

  writeRepoFile(repoPath, 'src/current-feature.js', 'export const currentFeature = true;\n');
  git(repoPath, ['add', '.']);
  git(repoPath, ['commit', '-m', 'Implement unrelated current feature']);

  return { repoPath, statusPath };
}

describe('check-superpowers-state', () => {
  it('does not apply the closeout product-change guard to historical statuses from another branch', () => {
    const { repoPath, statusPath } = createHistoricalCloseoutFixture();

    const result = spawnSync(process.execPath, [checkerScript, statusPath], {
      cwd: repoPath,
      encoding: 'utf8',
    });

    expect(result.stderr).not.toContain('src/current-feature.js');
    expect(result.stderr).not.toContain('non-workflow/evidence changes after lastVerifiedCommit');
    expect(result.status).toBe(0);
  });
});
