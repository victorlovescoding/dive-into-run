#!/usr/bin/env node

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const CLOSEOUT_PHASE_PATTERN = /closeout|complete|completed|ready[-_ ]for[-_ ]pr|ready[-_ ]for[-_ ]merge|post[-_ ]rebase|release/i;
const CLOSED_INCIDENT_STATES = new Set(['closed', 'resolved']);
const RULES_FILES = new Set(['firestore.rules', 'storage.rules']);
const WORKFLOW_EVIDENCE_FILES = new Set([
  '.github/workflows/ci.yml',
  '.github/workflows/firestore-rules-gate.yml',
  '.github/workflows/quality-budgets.yml',
  'AGENTS.md',
  'docs/superpowers/status.schema.json',
  'scripts/validate-workflow-state.js',
  'scripts/check-superpowers-state.js',
]);
const WORKFLOW_EVIDENCE_PREFIXES = [
  'specs/',
  'docs/superpowers/',
  '.codex/',
  '.agents/skills/',
];

/**
 * Prints command usage.
 * @returns {void} No return value.
 */
function printHelp() {
  process.stdout.write(`Usage: node scripts/check-superpowers-state.js [status.json ...] [--owned-files [path ...]] [--owned-files-file <file>] [--base <ref>]

Runs schema validation, checks workflow companion files, and performs
conservative semantic sync checks for specs/*/status.json.

Options:
  --owned-files [path ...]
                  Enforce git diff + untracked files against explicit owned paths.
                  With no paths, uses the single active task ownedFiles.
  --owned-files-file <file>
                  Read explicit owned paths from a JSON array or newline file.
  --base <ref>    Base ref for owned-file diff. Defaults to HEAD.
  --status <file> Add an explicit status.json path when --owned-files uses paths.\n`);
}

/**
 * Checks for a plain object.
 * @param {unknown} value - Value to inspect.
 * @returns {boolean} Whether value is a plain object.
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks for a string with non-whitespace content.
 * @param {unknown} value - Value to inspect.
 * @returns {boolean} Whether value is a non-blank string.
 */
function isNonBlankString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Reads a UTF-8 file.
 * @param {string} filePath - File path.
 * @returns {string} File contents.
 */
function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Runs a git command and returns trimmed stdout.
 * @param {string[]} args - Git arguments.
 * @returns {string} Trimmed stdout.
 */
function readGit(args) {
  return childProcess.execFileSync('git', args, { encoding: 'utf8' }).trim();
}

/**
 * Gets the current git worktree root.
 * @returns {string|null} Absolute worktree root, or null when unavailable.
 */
function getCurrentWorktree() {
  try {
    const worktree = readGit(['rev-parse', '--show-toplevel']);
    return isNonBlankString(worktree) ? path.resolve(worktree.trim()) : null;
  } catch {
    return null;
  }
}

/**
 * Checks whether a git ref resolves to a commit.
 * @param {string} ref - Git ref.
 * @returns {boolean} Whether the ref resolves.
 */
function commitExists(ref) {
  try {
    childProcess.execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether a git ref is an ancestor of HEAD.
 * @param {string} ref - Git ref.
 * @returns {boolean} Whether ref is a HEAD ancestor.
 */
function isHeadAncestor(ref) {
  try {
    childProcess.execFileSync('git', ['merge-base', '--is-ancestor', ref, 'HEAD'], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets a git diff name list. Missing refs return an empty list for optional sensors.
 * @param {string[]} args - Git diff arguments.
 * @returns {string[]} Changed files.
 */
function readGitDiffNames(args) {
  try {
    return readGit(['diff', '--name-only', ...args])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Gets files changed on this branch relative to origin/main when available.
 * @returns {string[]} Changed files.
 */
function getOriginMainChangedFiles() {
  if (!commitExists('origin/main')) {
    return [];
  }

  try {
    const mergeBase = readGit(['merge-base', 'origin/main', 'HEAD']);
    return readGitDiffNames([`${mergeBase}..HEAD`]);
  } catch {
    return [];
  }
}

/**
 * Checks whether a path is a workflow/evidence-only path.
 * @param {string} filePath - Repo-relative file path.
 * @returns {boolean} Whether the path is workflow/evidence-only.
 */
function isWorkflowEvidencePath(filePath) {
  return WORKFLOW_EVIDENCE_FILES.has(filePath)
    || WORKFLOW_EVIDENCE_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

/**
 * Gets the current branch name from git or CI metadata.
 * @returns {string|null} Current branch name.
 */
function getCurrentBranch() {
  try {
    const branch = readGit(['branch', '--show-current']);
    if (isNonBlankString(branch)) {
      return branch;
    }
  } catch {
    // Detached or non-git contexts can still fall back to CI branch metadata.
  }

  for (const envName of ['GITHUB_HEAD_REF', 'GITHUB_REF_NAME']) {
    if (isNonBlankString(process.env[envName])) {
      return process.env[envName].trim();
    }
  }

  return null;
}

/**
 * Checks whether a status file describes the current branch context.
 * @param {Record<string, unknown>} status - Parsed status object.
 * @returns {boolean} Whether the status belongs to the current branch.
 */
function isCurrentBranchStatus(status) {
  const currentBranch = getCurrentBranch();
  if (!isNonBlankString(currentBranch)) {
    return false;
  }

  if (isNonBlankString(status.branch) && status.branch.trim() === currentBranch) {
    return true;
  }

  return isPlainObject(status.currentHead)
    && isNonBlankString(status.currentHead.branch)
    && status.currentHead.branch.trim() === currentBranch;
}

/**
 * Discovers first-level specs status files.
 * @returns {string[]} Status file paths.
 */
function discoverStatusFiles() {
  const specsDir = path.join(process.cwd(), 'specs');
  if (!fs.existsSync(specsDir)) {
    return [];
  }

  return fs
    .readdirSync(specsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(specsDir, entry.name, 'status.json'))
    .filter((statusPath) => fs.existsSync(statusPath))
    .sort();
}

/**
 * Parses CLI arguments.
 * @param {string[]} argv - Raw CLI arguments.
 * @returns {{baseRef: string, explicitOwnedFiles: string[], ownedFiles: boolean, ownedFilesFile: string|null, statusFiles: string[], help: boolean}} Parsed options.
 */
function parseArgs(argv) {
  const parsed = {
    baseRef: 'HEAD',
    explicitOwnedFiles: [],
    ownedFiles: false,
    ownedFilesFile: null,
    statusFiles: [],
    help: false,
  };
  let collectingOwnedFiles = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--owned-files') {
      parsed.ownedFiles = true;
      collectingOwnedFiles = true;
    } else if (arg === '--owned-files-file') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('--owned-files-file requires a file path');
      }
      parsed.ownedFiles = true;
      parsed.ownedFilesFile = next;
      collectingOwnedFiles = false;
      index += 1;
    } else if (arg === '--base') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('--base requires a ref');
      }
      parsed.baseRef = next;
      collectingOwnedFiles = false;
      index += 1;
    } else if (arg === '--status') {
      const next = argv[index + 1];
      if (!next) {
        throw new Error('--status requires a status.json path');
      }
      parsed.statusFiles.push(next);
      collectingOwnedFiles = false;
      index += 1;
    } else if (collectingOwnedFiles) {
      parsed.explicitOwnedFiles.push(arg);
    } else {
      parsed.statusFiles.push(arg);
    }
  }

  return parsed;
}

/**
 * Reads explicit owned files from a file.
 * @param {string} filePath - JSON array or newline-delimited file path.
 * @returns {string[]} Owned file paths.
 */
function readOwnedFilesFile(filePath) {
  const text = readText(filePath).trim();
  if (text === '') {
    return [];
  }

  if (text.startsWith('[')) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('--owned-files-file JSON must be an array');
    }

    return parsed.filter((entry) => typeof entry === 'string');
  }

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Runs the existing schema validator first.
 * @param {string[]} statusFiles - Status files to validate.
 * @returns {void} No return value.
 */
function runSchemaValidation(statusFiles) {
  const args = ['scripts/validate-workflow-state.js', ...statusFiles];
  childProcess.execFileSync(process.execPath, args, { stdio: 'inherit' });
}

/**
 * Gets the active task id from a status object.
 * @param {Record<string, unknown>} status - Parsed status object.
 * @returns {string|null} Active task id.
 */
function getActiveTaskId(status) {
  if (status.activeTask === null || status.activeTask === undefined) {
    return null;
  }

  if (typeof status.activeTask === 'string') {
    return status.activeTask;
  }

  if (isPlainObject(status.activeTask) && typeof status.activeTask.id === 'string') {
    return status.activeTask.id;
  }

  return null;
}

/**
 * Gets owned files for the active task.
 * @param {Record<string, unknown>} status - Parsed status object.
 * @returns {string[]} Owned files.
 */
function getActiveOwnedFiles(status) {
  const activeTaskId = getActiveTaskId(status);
  if (!activeTaskId) {
    return [];
  }

  if (Array.isArray(status.tasks)) {
    const activeTask = status.tasks.find((task) => isPlainObject(task) && task.id === activeTaskId);
    if (activeTask && Array.isArray(activeTask.ownedFiles)) {
      return activeTask.ownedFiles.filter((ownedFile) => typeof ownedFile === 'string');
    }
  }

  if (isPlainObject(status.activeTask) && Array.isArray(status.activeTask.ownedFiles)) {
    return status.activeTask.ownedFiles.filter((ownedFile) => typeof ownedFile === 'string');
  }

  return [];
}

/**
 * Checks whether a v3 status is in a closeout-like phase.
 * @param {Record<string, unknown>} status - Parsed status object.
 * @returns {boolean} Whether closeout guards apply.
 */
function isCloseoutishV3(status) {
  return status.schemaVersion === 3
    && typeof status.phase === 'string'
    && CLOSEOUT_PHASE_PATTERN.test(status.phase);
}

/**
 * Checks whether branch/worktree-scoped closeout guards apply to this status.
 * @param {Record<string, unknown>} status - Parsed status object.
 * @param {{currentBranch: string|null, currentWorktree: string|null, explicitStatusFiles: boolean}} context - Runtime git context.
 * @returns {boolean} Whether branch/worktree-scoped guards apply.
 */
function isCurrentWorkflowState(status, context) {
  const statusBranch = isNonBlankString(status.branch) ? status.branch.trim() : null;
  const statusWorktree = isNonBlankString(status.worktree)
    ? path.resolve(status.worktree.trim())
    : null;

  if (statusBranch && context.currentBranch && statusBranch === context.currentBranch) {
    return true;
  }

  if (statusWorktree && context.currentWorktree && statusWorktree === context.currentWorktree) {
    return true;
  }

  if (!context.currentBranch && context.explicitStatusFiles) {
    return true;
  }

  return !statusBranch && !statusWorktree;
}

/**
 * Gets a commit ref from a phase commit entry.
 * @param {unknown} entry - Phase commit entry.
 * @returns {string|null} Commit ref.
 */
function getPhaseCommitRef(entry) {
  if (typeof entry === 'string' && entry.length > 0) {
    return entry;
  }

  if (!isPlainObject(entry)) {
    return null;
  }

  for (const field of ['commit', 'commitRef', 'ref', 'sha']) {
    if (typeof entry[field] === 'string' && entry[field].length > 0) {
      return entry[field];
    }
  }

  return null;
}

/**
 * Gets the deployed rules commit ref when present.
 * @param {Record<string, unknown>} status - Parsed status object.
 * @returns {string|null} Deployed commit ref.
 */
function getRulesDeployedCommit(status) {
  if (!isPlainObject(status.rulesDeployStatus)) {
    return null;
  }

  for (const field of ['deployedCommit', 'deployedRef', 'commit']) {
    if (typeof status.rulesDeployStatus[field] === 'string' && status.rulesDeployStatus[field].length > 0) {
      return status.rulesDeployStatus[field];
    }
  }

  return null;
}

/**
 * Collects non-null v3 commit refs that must resolve and be HEAD ancestors.
 * @param {Record<string, unknown>} status - Parsed status object.
 * @returns {{label: string, ref: string}[]} Commit refs.
 */
function collectV3CommitRefs(status) {
  const refs = [];

  if (typeof status.lastVerifiedCommit === 'string' && status.lastVerifiedCommit.length > 0) {
    refs.push({ label: 'lastVerifiedCommit', ref: status.lastVerifiedCommit });
  }

  if (Array.isArray(status.phaseCommits)) {
    status.phaseCommits.forEach((entry, index) => {
      const ref = getPhaseCommitRef(entry);
      if (ref) {
        refs.push({ label: `phaseCommits[${index}]`, ref });
      }
    });
  }

  const deployedCommit = getRulesDeployedCommit(status);
  if (deployedCommit) {
    refs.push({ label: 'rulesDeployStatus.deployedCommit', ref: deployedCommit });
  }

  return refs;
}

/**
 * Checks whether an incident is still open.
 * @param {unknown} incident - Incident object.
 * @returns {boolean} Whether the incident is open.
 */
function isOpenIncident(incident) {
  if (!isPlainObject(incident)) {
    return true;
  }

  if (typeof incident.open === 'boolean') {
    return incident.open;
  }

  if (typeof incident.state === 'string') {
    return !CLOSED_INCIDENT_STATES.has(incident.state);
  }

  return true;
}

/**
 * Gets changed files from git diff plus untracked files.
 * @param {string} baseRef - Base ref.
 * @returns {string[]} Changed file paths.
 */
function getChangedFiles(baseRef) {
  const trackedOutput = childProcess.execFileSync('git', ['diff', '--name-only', baseRef], {
    encoding: 'utf8',
  });
  const untrackedOutput = childProcess.execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  });

  return [...new Set(`${trackedOutput}\n${untrackedOutput}`
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean))]
    .sort();
}

/**
 * Gets files touched by commits and the current worktree.
 * @param {Record<string, unknown>} status - Parsed status object.
 * @returns {string[]} Repo-relative touched files.
 */
function getTouchedFiles(status) {
  const files = new Set([
    ...getChangedFiles('HEAD'),
    ...getOriginMainChangedFiles(),
  ]);

  if (isNonBlankString(status.lastVerifiedCommit)) {
    readGitDiffNames([`${status.lastVerifiedCommit.trim()}..HEAD`]).forEach((filePath) => {
      files.add(filePath);
    });
  }

  return [...files].sort();
}

/**
 * Runs v3 semantic workflow guards.
 * @param {string} statusFile - Status file path.
 * @param {Record<string, unknown>} status - Parsed status object.
 * @param {{currentBranch: string|null, currentWorktree: string|null, explicitStatusFiles: boolean}} context - Runtime git context.
 * @returns {string[]} Semantic errors.
 */
function checkV3Semantics(statusFile, status, context) {
  if (status.schemaVersion !== 3) {
    return [];
  }

  const errors = [];
  const closeoutish = isCloseoutishV3(status);
  const currentWorkflowState = isCurrentWorkflowState(status, context);

  if (closeoutish && !isNonBlankString(status.lastVerifiedCommit)) {
    errors.push('v3 closeout-ish phase requires non-blank lastVerifiedCommit');
  }

  collectV3CommitRefs(status).forEach(({ label, ref }) => {
    if (!isNonBlankString(ref)) {
      errors.push(`${label} must be a non-blank commit ref`);
      return;
    }

    const normalizedRef = ref.trim();

    if (!commitExists(normalizedRef)) {
      errors.push(`${label} (${ref}) must resolve to a commit`);
      return;
    }

    if (!isHeadAncestor(normalizedRef)) {
      errors.push(`${label} (${ref}) must be an ancestor of HEAD`);
    }
  });

  if (
    closeoutish
    && currentWorkflowState
    && isNonBlankString(status.lastVerifiedCommit)
    && commitExists(status.lastVerifiedCommit.trim())
  ) {
    const rangeFiles = readGitDiffNames([`${status.lastVerifiedCommit.trim()}..HEAD`]);
    const outOfEvidenceRange = rangeFiles.filter((filePath) => !isWorkflowEvidencePath(filePath));
    if (outOfEvidenceRange.length > 0) {
      errors.push(
        `v3 closeout-ish phase has non-workflow/evidence changes after lastVerifiedCommit: ${outOfEvidenceRange.join(', ')}`
      );
    }
  }

  const touchedRulesFiles = getTouchedFiles(status).filter((filePath) => RULES_FILES.has(filePath));
  if (touchedRulesFiles.length > 0) {
    if (!isPlainObject(status.rulesDeployStatus)) {
      errors.push(`v3 rules changes require rulesDeployStatus for: ${touchedRulesFiles.join(', ')}`);
    } else {
      if (status.rulesDeployStatus.state === 'not_applicable') {
        errors.push(`v3 rules changes cannot have rulesDeployStatus.state=not_applicable for: ${touchedRulesFiles.join(', ')}`);
      }

      if (status.rulesDeployStatus.required !== true && status.rulesDeployStatus.changed !== true) {
        errors.push('v3 rules changes require rulesDeployStatus.required=true or changed=true');
      }
    }
  }

  if (isPlainObject(status.rulesDeployStatus) && status.rulesDeployStatus.state === 'deployed') {
    if (!Array.isArray(status.rulesDeployStatus.evidence) || status.rulesDeployStatus.evidence.length === 0) {
      errors.push('rulesDeployStatus.state=deployed requires deploy evidence');
    }

    if (!isPlainObject(status.authorizationBoundary) || status.authorizationBoundary.deployFirestoreRules !== true) {
      errors.push('rulesDeployStatus.state=deployed requires authorizationBoundary.deployFirestoreRules=true');
    }
  }

  if (closeoutish && Array.isArray(status.incidents)) {
    const openIncidents = status.incidents.filter(isOpenIncident);
    if (openIncidents.length > 0) {
      errors.push(`${statusFile} has ${openIncidents.length} open incident(s); closeout-ish v3 state is blocked`);
    }
  }

  return errors;
}

/**
 * Checks whether text mentions a task id.
 * @param {string} text - File contents.
 * @param {string} taskId - Task id.
 * @returns {boolean} Whether the task id is present.
 */
function mentionsTask(text, taskId) {
  return text.includes(taskId);
}

/**
 * Validates companion files and conservative semantic sync.
 * @param {string} statusFile - Status file path.
 * @param {{currentBranch: string|null, currentWorktree: string|null, explicitStatusFiles: boolean}} context - Runtime git context.
 * @returns {{errors: string[], activeTaskId: string|null, ownedFiles: string[]}} Check result.
 */
function checkStatusSync(statusFile, context) {
  const errors = [];
  const status = JSON.parse(readText(statusFile));
  const featureDir = path.dirname(statusFile);
  const handoffPath = path.join(featureDir, 'handoff.md');
  const tasksPath = path.join(featureDir, 'tasks.md');
  const activeTaskId = getActiveTaskId(status);
  const ownedFiles = getActiveOwnedFiles(status);

  if (!fs.existsSync(handoffPath)) {
    errors.push('handoff.md is required next to status.json');
  }

  if (!fs.existsSync(tasksPath)) {
    errors.push('tasks.md is required next to status.json');
  }

  const handoffText = fs.existsSync(handoffPath) ? readText(handoffPath) : '';
  const tasksText = fs.existsSync(tasksPath) ? readText(tasksPath) : '';

  if (activeTaskId) {
    if (handoffText && !mentionsTask(handoffText, activeTaskId)) {
      errors.push(`handoff.md should mention activeTask ${activeTaskId}`);
    }

    if (tasksText && !mentionsTask(tasksText, activeTaskId)) {
      errors.push(`tasks.md should mention activeTask ${activeTaskId}`);
    }
  }

  if (Array.isArray(status.completedTasks) && tasksText) {
    status.completedTasks.forEach((taskId) => {
      if (typeof taskId === 'string' && !mentionsTask(tasksText, taskId)) {
        errors.push(`tasks.md should mention completed task ${taskId}`);
      }
    });
  }

  checkV3Semantics(statusFile, status, context).forEach((error) => {
    errors.push(error);
  });

  return { errors, activeTaskId, ownedFiles };
}

/**
 * Checks whether changed file is allowed by owned files.
 * @param {string} changedFile - Changed file path.
 * @param {string[]} ownedFiles - Owned files.
 * @returns {boolean} Whether changed file is owned.
 */
function isOwnedFile(changedFile, ownedFiles) {
  return ownedFiles.some((ownedFile) => {
    const normalized = ownedFile.replace(/^\.\//, '').replace(/\/?\*\*$/, '');
    return changedFile === normalized || changedFile.startsWith(`${normalized.replace(/\/$/, '')}/`);
  });
}

/**
 * Runs owned-file diff check.
 * @param {{statusFile: string, activeTaskId: string|null, ownedFiles: string[]}[]} results - Sync results.
 * @param {string} baseRef - Base ref.
 * @param {string[]} explicitOwnedFiles - Explicit owned-file allowlist.
 * @returns {string[]} Errors.
 */
function checkOwnedFiles(results, baseRef, explicitOwnedFiles) {
  const activeResults = results.filter((result) => result.activeTaskId);
  let label = 'explicit owned files';
  let ownedFiles = explicitOwnedFiles;

  if (ownedFiles.length === 0) {
    if (activeResults.length === 0) {
      return [
        'OWNED FILES: cannot enforce boundaries because no active task exists; pass explicit paths after --owned-files or use --owned-files-file',
      ];
    }

    if (activeResults.length > 1) {
      return ['OWNED FILES: multiple active tasks found; pass explicit paths after --owned-files'];
    }

    label = `${activeResults[0].statusFile} activeTask ${activeResults[0].activeTaskId}`;
    ownedFiles = activeResults[0].ownedFiles;
  }

  if (ownedFiles.length === 0) {
    return [`OWNED FILES: ${label} has no owned files to enforce`];
  }

  const changedFiles = getChangedFiles(baseRef);
  const outOfScope = changedFiles.filter(
    (changedFile) => !isOwnedFile(changedFile, ownedFiles)
  );

  if (outOfScope.length === 0) {
    process.stdout.write(`OWNED FILES: ${changedFiles.length} changed file(s) within ${label}\n`);
    return [];
  }

  return [`OWNED FILES: ${label} does not own: ${outOfScope.join(', ')}`];
}

/**
 * Runs the workflow state checks.
 * @returns {void} No return value.
 */
function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const explicitStatusFiles = options.statusFiles.length > 0;
  const statusFiles = explicitStatusFiles ? options.statusFiles : discoverStatusFiles();
  const context = {
    currentBranch: getCurrentBranch(),
    currentWorktree: getCurrentWorktree(),
    explicitStatusFiles,
  };
  runSchemaValidation(statusFiles);

  if (statusFiles.length === 0) {
    process.stdout.write('SUPERPOWERS CHECK: 0 status files found\n');
    return;
  }

  const results = statusFiles.map((statusFile) => {
    const result = checkStatusSync(statusFile, context);
    if (result.errors.length === 0) {
      process.stdout.write(`${statusFile}: sync ok\n`);
    } else {
      console.error(`${statusFile}: sync invalid`);
      result.errors.forEach((error) => {
        console.error(`  - ${error}`);
      });
    }
    return { statusFile, ...result };
  });

  const syncErrors = results.flatMap((result) => result.errors);
  const fileOwnedFiles = options.ownedFilesFile ? readOwnedFilesFile(options.ownedFilesFile) : [];
  const explicitOwnedFiles = [...new Set([...options.explicitOwnedFiles, ...fileOwnedFiles])];
  const ownedErrors = options.ownedFiles
    ? checkOwnedFiles(results, options.baseRef, explicitOwnedFiles)
    : [];
  const errors = [...syncErrors, ...ownedErrors];

  if (errors.length > 0) {
    ownedErrors.forEach((error) => {
      console.error(error);
    });
    console.error(`SUPERPOWERS CHECK: ${errors.length} error(s)`);
    process.exit(1);
  }

  process.stdout.write(`SUPERPOWERS CHECK: ${statusFiles.length} status file(s) synced\n`);
}

try {
  main();
} catch (error) {
  console.error(`SUPERPOWERS CHECK: ${error.message}`);
  process.exit(1);
}
