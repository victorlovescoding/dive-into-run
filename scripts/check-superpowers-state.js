#!/usr/bin/env node

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

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
 * Reads a UTF-8 file.
 * @param {string} filePath - File path.
 * @returns {string} File contents.
 */
function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
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
 * @returns {{errors: string[], activeTaskId: string|null, ownedFiles: string[]}} Check result.
 */
function checkStatusSync(statusFile) {
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

  return { errors, activeTaskId, ownedFiles };
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

  const statusFiles = options.statusFiles.length > 0 ? options.statusFiles : discoverStatusFiles();
  runSchemaValidation(statusFiles);

  if (statusFiles.length === 0) {
    process.stdout.write('SUPERPOWERS CHECK: 0 status files found\n');
    return;
  }

  const results = statusFiles.map((statusFile) => {
    const result = checkStatusSync(statusFile);
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
