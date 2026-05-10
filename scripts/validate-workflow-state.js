#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const REQUIRED_FIELDS = [
  'schemaVersion',
  'feature',
  'branch',
  'worktree',
  'phase',
  'activeTask',
  'completedTasks',
  'blocked',
  'blockedReason',
  'lastVerification',
  'lastVerifiedCommit',
  'updatedAt',
];

const ACTIVE_TASK_FIELDS = [
  'id',
  'state',
  'engineer',
  'reviewer',
  'attempt',
  'ownedFiles',
  'startedAt',
];

const VERIFICATION_FIELDS = ['command', 'exitCode', 'summary', 'verifiedAt'];

/**
 * Prints command usage.
 * @returns {void}
 */
function printHelp() {
  process.stdout.write(`Usage: node scripts/validate-workflow-state.js [status.json ...]

Validates Superpowers workflow status files under specs/*/status.json.
With explicit paths, validates only those files.\n`);
}

/**
 * Checks whether a value is a non-array object.
 * @param {unknown} value - Value to inspect.
 * @returns {boolean} Whether the value is a plain object.
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks whether a value is a non-empty string.
 * @param {unknown} value - Value to inspect.
 * @returns {boolean} Whether the value is a non-empty string.
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Validates an array of non-empty strings.
 * @param {unknown} value - Candidate array.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void}
 */
function assertStringArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }

  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      errors.push(`${label}[${index}] must be a non-empty string`);
    }
  });
}

/**
 * Validates the activeTask object when a task is in flight.
 * @param {unknown} value - Candidate active task.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void}
 */
function validateActiveTask(value, errors) {
  if (value === null) {
    return;
  }

  if (!isPlainObject(value)) {
    errors.push('activeTask must be null or an object');
    return;
  }

  ACTIVE_TASK_FIELDS.forEach((field) => {
    if (!(field in value)) {
      errors.push(`activeTask.${field} is required`);
    }
  });

  ['id', 'state', 'engineer', 'reviewer', 'startedAt'].forEach((field) => {
    if (field in value && !isNonEmptyString(value[field])) {
      errors.push(`activeTask.${field} must be a non-empty string`);
    }
  });

  if ('attempt' in value && (!Number.isInteger(value.attempt) || value.attempt < 1)) {
    errors.push('activeTask.attempt must be a positive integer');
  }

  if ('ownedFiles' in value) {
    assertStringArray(value.ownedFiles, 'activeTask.ownedFiles', errors);
  }
}

/**
 * Validates lastVerification entries.
 * @param {unknown} value - Candidate verification list.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void}
 */
function validateVerificationList(value, errors) {
  if (!Array.isArray(value)) {
    errors.push('lastVerification must be an array');
    return;
  }

  value.forEach((verification, index) => {
    const label = `lastVerification[${index}]`;
    if (!isPlainObject(verification)) {
      errors.push(`${label} must be an object`);
      return;
    }

    VERIFICATION_FIELDS.forEach((field) => {
      if (!(field in verification)) {
        errors.push(`${label}.${field} is required`);
      }
    });

    ['command', 'summary', 'verifiedAt'].forEach((field) => {
      if (field in verification && !isNonEmptyString(verification[field])) {
        errors.push(`${label}.${field} must be a non-empty string`);
      }
    });

    if (
      'exitCode' in verification &&
      (!Number.isInteger(verification.exitCode) || verification.exitCode < 0)
    ) {
      errors.push(`${label}.exitCode must be a non-negative integer`);
    }
  });
}

/**
 * Validates one workflow status file.
 * @param {string} filePath - Path to a status.json file.
 * @returns {string[]} Validation errors.
 */
function validateStatusFile(filePath) {
  const errors = [];
  let parsed;

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return [`invalid JSON: ${error.message}`];
  }

  if (!isPlainObject(parsed)) {
    return ['top-level value must be an object'];
  }

  if ('latestVerifiedCommit' in parsed) {
    errors.push('latestVerifiedCommit is forbidden; use lastVerifiedCommit');
  }

  REQUIRED_FIELDS.forEach((field) => {
    if (!(field in parsed)) {
      errors.push(`${field} is required`);
    }
  });

  if ('schemaVersion' in parsed && parsed.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }

  ['feature', 'branch', 'worktree', 'phase'].forEach((field) => {
    if (field in parsed && !isNonEmptyString(parsed[field])) {
      errors.push(`${field} must be a non-empty string`);
    }
  });

  if ('activeTask' in parsed) {
    validateActiveTask(parsed.activeTask, errors);
  }

  if ('completedTasks' in parsed) {
    assertStringArray(parsed.completedTasks, 'completedTasks', errors);
  }

  if ('blocked' in parsed && typeof parsed.blocked !== 'boolean') {
    errors.push('blocked must be a boolean');
  }

  if ('blockedReason' in parsed) {
    if (parsed.blockedReason !== null && typeof parsed.blockedReason !== 'string') {
      errors.push('blockedReason must be null or a string');
    }
    if (parsed.blocked === true && !isNonEmptyString(parsed.blockedReason)) {
      errors.push('blockedReason must be a non-empty string when blocked is true');
    }
  }

  if ('lastVerification' in parsed) {
    validateVerificationList(parsed.lastVerification, errors);
  }

  if (
    'lastVerifiedCommit' in parsed &&
    parsed.lastVerifiedCommit !== null &&
    !isNonEmptyString(parsed.lastVerifiedCommit)
  ) {
    errors.push('lastVerifiedCommit must be null or a non-empty string');
  }

  if ('updatedAt' in parsed && parsed.updatedAt !== null && !isNonEmptyString(parsed.updatedAt)) {
    errors.push('updatedAt must be null or a non-empty string');
  }

  return errors;
}

/**
 * Finds first-level specs status files.
 * @returns {string[]} Existing status file paths.
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

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printHelp();
  process.exit(0);
}

const statusFiles = args.length > 0 ? args : discoverStatusFiles();

if (statusFiles.length === 0) {
  process.stdout.write('WORKFLOW STATE: 0 status files found\n');
  process.exit(0);
}

let failureCount = 0;
for (const statusFile of statusFiles) {
  const errors = validateStatusFile(statusFile);
  if (errors.length === 0) {
    process.stdout.write(`${statusFile}: ok\n`);
    continue;
  }

  failureCount += 1;
  console.error(`${statusFile}: invalid`);
  errors.forEach((error) => {
    console.error(`  - ${error}`);
  });
}

if (failureCount > 0) {
  console.error(`WORKFLOW STATE: ${failureCount} invalid status file(s)`);
  process.exit(1);
}

process.stdout.write(`WORKFLOW STATE: ${statusFiles.length} status file(s) valid\n`);
