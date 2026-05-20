#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SUPPORTED_SCHEMA_VERSIONS = new Set([1, 2, 3]);

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

const ACTIVE_TASK_V1_FIELDS = [
  'id',
  'state',
  'engineer',
  'reviewer',
  'attempt',
  'ownedFiles',
  'startedAt',
];

const TASK_V2_FIELDS = [
  'id',
  'title',
  'state',
  'attempt',
  'wave',
  'engineer',
  'reviewer',
  'scope',
  'nonScope',
  'ownedFiles',
  'readOnlyContext',
  'dependencies',
  'engineerInstructions',
  'acceptanceCriteria',
  'verification',
  'reviewerPassCriteria',
  'reviewerRejectCriteria',
  'reviewerDecision',
  'evidence',
];

const TASK_STATES = new Set([
  'todo',
  'ready',
  'in_progress',
  'engineer_done',
  'review_passed',
  'review_rejected',
  'completed',
  'blocked',
]);

const TASK_V2_STRING_FIELDS = ['id', 'title', 'state', 'engineer', 'reviewer'];
const TASK_V2_ARRAY_FIELDS = [
  'scope',
  'nonScope',
  'ownedFiles',
  'readOnlyContext',
  'dependencies',
  'engineerInstructions',
  'acceptanceCriteria',
  'reviewerPassCriteria',
  'reviewerRejectCriteria',
];
const VERIFICATION_FIELDS = ['command', 'exitCode', 'summary', 'verifiedAt'];
const VERIFICATION_PLAN_FIELDS = ['command', 'expectedSignal', 'lastRun'];
const REVIEWER_DECISION_FIELDS = ['decision', 'reviewer', 'summary', 'decidedAt'];
const REVIEWER_DECISIONS = new Set(['review_passed', 'review_rejected', 'blocked']);
const SHELL_CHAIN_OPERATOR_PATTERN = /&&|;/;
const TASK_EVIDENCE_FIELDS = [
  'engineerReport',
  'reviewerReport',
  'commandOutputSummary',
  'changedFilesSummary',
];
const AUTHORIZATION_BOUNDARY_FIELDS = [
  'edit',
  'commit',
  'push',
  'pullRequest',
  'ciWatch',
  'merge',
  'localMainSync',
  'deployFirestoreRules',
];
const STATUS_V3_FIELDS = [
  'activeWave',
  'authorizationBoundary',
  'currentHead',
  'remoteHead',
  'tasks',
  'phaseCommits',
  'rulesDeployStatus',
  'incidents',
];
const STATUS_V3_TOP_LEVEL_FIELDS = [...REQUIRED_FIELDS, ...STATUS_V3_FIELDS];
const HEAD_SNAPSHOT_STRING_FIELDS = [
  'ref',
  'commit',
  'sha',
  'branch',
  'remote',
  'source',
  'checkedAt',
  'capturedAt',
  'summary',
];
const PHASE_COMMIT_STRING_FIELDS = [
  'phase',
  'ref',
  'commit',
  'commitRef',
  'sha',
  'summary',
  'committedAt',
];
const COMMIT_REF_FIELDS = ['ref', 'commit', 'commitRef', 'sha'];
const RULES_DEPLOY_STATUS_FIELDS = [
  'state',
  'required',
  'changed',
  'evidence',
  'deployedCommit',
];
const RULES_DEPLOY_STATES = new Set([
  'not_applicable',
  'not_required',
  'required',
  'pending',
  'blocked',
  'deployed',
]);
const INCIDENT_FIELDS = ['id', 'state', 'summary'];
const INCIDENT_OPTIONAL_FIELDS = ['openedAt', 'closedAt'];
const INCIDENT_STATES = new Set(['open', 'mitigated', 'resolved', 'closed']);

/**
 * Prints command usage.
 * @returns {void} No return value.
 */
function printHelp() {
  process.stdout.write(`Usage: node scripts/validate-workflow-state.js [status.json ...]

Validates Superpowers workflow status files under specs/*/status.json.
With explicit paths, validates only those files.\n`);
}

/**
 * Checks for a non-array object.
 * @param {unknown} value - Value to inspect.
 * @returns {boolean} Whether value is a plain object.
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Checks for a non-empty string.
 * @param {unknown} value - Value to inspect.
 * @returns {boolean} Whether value is a non-empty string.
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Builds a dotted validation label.
 * @param {string} parent - Parent label.
 * @param {string} field - Field name.
 * @returns {string} Combined validation label.
 */
function labelFor(parent, field) {
  return parent ? `${parent}.${field}` : field;
}

/**
 * Adds errors for missing required fields.
 * @param {object} value - Object being validated.
 * @param {string[]} fields - Required field names.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function requireFields(value, fields, label, errors) {
  fields.forEach((field) => {
    if (!(field in value)) {
      errors.push(`${labelFor(label, field)} is required`);
    }
  });
}

/**
 * Adds errors for fields outside an allowed set.
 * @param {object} value - Object being validated.
 * @param {string[]} fields - Allowed field names.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function rejectUnknownFields(value, fields, label, errors) {
  const allowed = new Set(fields);
  Object.keys(value).forEach((field) => {
    if (!allowed.has(field)) {
      errors.push(`${labelFor(label, field)} is not allowed`);
    }
  });
}

/**
 * Validates an array of non-empty strings.
 * @param {unknown} value - Candidate array.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateStringArray(value, label, errors) {
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
 * Validates a positive integer.
 * @param {unknown} value - Candidate integer.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validatePositiveInteger(value, label, errors) {
  if (!Number.isInteger(value) || value < 1) {
    errors.push(`${label} must be a positive integer`);
  }
}

/**
 * Validates a wave identifier.
 * @param {unknown} value - Candidate wave value.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateWave(value, label, errors) {
  if (isNonEmptyString(value) || (Number.isInteger(value) && value >= 1)) {
    return;
  }

  errors.push(`${label} must be a non-empty string or positive integer`);
}

/**
 * Validates a nullable string.
 * @param {unknown} value - Candidate value.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateNullableString(value, label, errors) {
  if (value !== null && typeof value !== 'string') {
    errors.push(`${label} must be null or a string`);
  }
}

/**
 * Validates a boolean field.
 * @param {unknown} value - Candidate boolean.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateBoolean(value, label, errors) {
  if (typeof value !== 'boolean') {
    errors.push(`${label} must be a boolean`);
  }
}

/**
 * Validates a nullable string or lightweight git snapshot object.
 * @param {unknown} value - Candidate head snapshot.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateNullableHeadSnapshot(value, label, errors) {
  if (value === null || isNonEmptyString(value)) {
    return;
  }

  if (!isPlainObject(value)) {
    errors.push(`${label} must be null, a non-empty string, or a snapshot object`);
    return;
  }

  rejectUnknownFields(value, HEAD_SNAPSHOT_STRING_FIELDS, label, errors);

  if (!HEAD_SNAPSHOT_STRING_FIELDS.some((field) => field in value)) {
    errors.push(`${label} snapshot must include at least one recognized field`);
  }

  HEAD_SNAPSHOT_STRING_FIELDS.forEach((field) => {
    if (field in value) {
      validateNullableString(value[field], labelFor(label, field), errors);
      if (value[field] === '') {
        errors.push(`${labelFor(label, field)} must be null or a non-empty string`);
      }
    }
  });
}

/**
 * Validates automation authorization boundaries.
 * @param {unknown} value - Candidate authorization boundary object.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateAuthorizationBoundary(value, errors) {
  if (!isPlainObject(value)) {
    errors.push('authorizationBoundary must be an object');
    return;
  }

  rejectUnknownFields(value, AUTHORIZATION_BOUNDARY_FIELDS, 'authorizationBoundary', errors);
  requireFields(value, AUTHORIZATION_BOUNDARY_FIELDS, 'authorizationBoundary', errors);
  AUTHORIZATION_BOUNDARY_FIELDS.forEach((field) => {
    if (field in value) {
      validateBoolean(value[field], labelFor('authorizationBoundary', field), errors);
    }
  });
}

/**
 * Validates a command field as one auditable shell command.
 * @param {unknown} value - Candidate command.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateSingleCommand(value, label, errors) {
  if (!isNonEmptyString(value)) {
    errors.push(`${label} must be a non-empty string`);
    return;
  }

  if (SHELL_CHAIN_OPERATOR_PATTERN.test(value)) {
    errors.push(`${label} must be one command; split shell chains using && or ; into separate entries`);
  }
}

/**
 * Validates a completed verification entry.
 * @param {unknown} value - Candidate verification entry.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @param {{rejectUnknownFields?: boolean}} [options] - Validation options.
 * @returns {void} No return value.
 */
function validateVerificationResult(value, label, errors, options = {}) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object`);
    return;
  }

  if (options.rejectUnknownFields === true) {
    rejectUnknownFields(value, VERIFICATION_FIELDS, label, errors);
  }

  requireFields(value, VERIFICATION_FIELDS, label, errors);

  if ('command' in value) {
    validateSingleCommand(value.command, labelFor(label, 'command'), errors);
  }

  ['summary', 'verifiedAt'].forEach((field) => {
    if (field in value && !isNonEmptyString(value[field])) {
      errors.push(`${labelFor(label, field)} must be a non-empty string`);
    }
  });

  if ('exitCode' in value && (!Number.isInteger(value.exitCode) || value.exitCode < 0)) {
    errors.push(`${labelFor(label, 'exitCode')} must be a non-negative integer`);
  }
}

/**
 * Validates completed verification entries.
 * @param {unknown} value - Candidate verification list.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @param {{rejectUnknownFields?: boolean}} [options] - Validation options.
 * @returns {void} No return value.
 */
function validateVerificationList(value, label, errors, options = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }

  value.forEach((verification, index) => {
    validateVerificationResult(verification, `${label}[${index}]`, errors, options);
  });
}

/**
 * Validates deploy evidence entries.
 * @param {unknown} value - Candidate evidence list.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateDeployEvidenceList(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }

  value.forEach((entry, index) => {
    const itemLabel = `${label}[${index}]`;
    if (isNonEmptyString(entry)) {
      return;
    }

    if (isPlainObject(entry)) {
      validateVerificationResult(entry, itemLabel, errors, { rejectUnknownFields: true });
      return;
    }

    errors.push(`${itemLabel} must be a non-empty string or verification result`);
  });
}

/**
 * Validates the schemaVersion 1 active task.
 * @param {unknown} value - Candidate active task.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateActiveTaskV1(value, errors) {
  if (value === null) {
    return;
  }

  if (!isPlainObject(value)) {
    errors.push('activeTask must be null or an object');
    return;
  }

  requireFields(value, ACTIVE_TASK_V1_FIELDS, 'activeTask', errors);

  ['id', 'state', 'engineer', 'reviewer', 'startedAt'].forEach((field) => {
    if (field in value && !isNonEmptyString(value[field])) {
      errors.push(`activeTask.${field} must be a non-empty string`);
    }
  });

  if ('attempt' in value) {
    validatePositiveInteger(value.attempt, 'activeTask.attempt', errors);
  }

  if ('ownedFiles' in value) {
    validateStringArray(value.ownedFiles, 'activeTask.ownedFiles', errors);
  }
}

/**
 * Validates the schemaVersion 2 active task id.
 * @param {unknown} value - Candidate active task id.
 * @param {unknown} tasks - Candidate task list.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateActiveTaskV2(value, tasks, errors) {
  if (value === null) {
    return;
  }

  if (!isNonEmptyString(value)) {
    errors.push('activeTask must be null or a non-empty string for schemaVersion 2 or 3');
    return;
  }

  if (Array.isArray(tasks) && !tasks.some((task) => isPlainObject(task) && task.id === value)) {
    errors.push('activeTask must reference an existing tasks[].id');
  }
}

/**
 * Validates planned verification entries.
 * @param {unknown} value - Candidate verification plan list.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @param {{rejectUnknownFields?: boolean}} [options] - Validation options.
 * @returns {void} No return value.
 */
function validateVerificationPlanList(value, label, errors, options = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }

  value.forEach((verification, index) => {
    const itemLabel = `${label}[${index}]`;
    if (!isPlainObject(verification)) {
      errors.push(`${itemLabel} must be an object`);
      return;
    }

    if (options.rejectUnknownFields === true) {
      rejectUnknownFields(verification, VERIFICATION_PLAN_FIELDS, itemLabel, errors);
    }

    requireFields(verification, VERIFICATION_PLAN_FIELDS, itemLabel, errors);

    if ('command' in verification) {
      validateSingleCommand(verification.command, labelFor(itemLabel, 'command'), errors);
    }

    if ('expectedSignal' in verification && !isNonEmptyString(verification.expectedSignal)) {
      errors.push(`${labelFor(itemLabel, 'expectedSignal')} must be a non-empty string`);
    }

    if ('lastRun' in verification && verification.lastRun !== null) {
      validateVerificationResult(verification.lastRun, `${itemLabel}.lastRun`, errors, options);
    }
  });
}

/**
 * Validates task evidence metadata.
 * @param {unknown} value - Candidate evidence object.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @param {{rejectUnknownFields?: boolean}} [options] - Validation options.
 * @returns {void} No return value.
 */
function validateTaskEvidence(value, label, errors, options = {}) {
  if (!isPlainObject(value)) {
    errors.push(`${label} must be an object`);
    return;
  }

  if (options.rejectUnknownFields === true) {
    rejectUnknownFields(value, TASK_EVIDENCE_FIELDS, label, errors);
  }

  requireFields(value, TASK_EVIDENCE_FIELDS, label, errors);

  ['engineerReport', 'reviewerReport'].forEach((field) => {
    if (field in value) {
      validateNullableString(value[field], labelFor(label, field), errors);
    }
  });

  ['commandOutputSummary', 'changedFilesSummary'].forEach((field) => {
    if (field in value) {
      validateStringArray(value[field], labelFor(label, field), errors);
    }
  });
}

/**
 * Validates reviewer decision metadata.
 * @param {unknown} value - Candidate reviewer decision.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @param {{rejectUnknownFields?: boolean}} [options] - Validation options.
 * @returns {void} No return value.
 */
function validateReviewerDecision(value, label, errors, options = {}) {
  if (value === null) {
    return;
  }

  if (!isPlainObject(value)) {
    errors.push(`${label} must be null or an object`);
    return;
  }

  if (options.rejectUnknownFields === true) {
    rejectUnknownFields(value, REVIEWER_DECISION_FIELDS, label, errors);
  }

  requireFields(value, REVIEWER_DECISION_FIELDS, label, errors);

  if ('decision' in value && !REVIEWER_DECISIONS.has(value.decision)) {
    errors.push(`${labelFor(label, 'decision')} must be review_passed, review_rejected, or blocked`);
  }

  ['reviewer', 'summary', 'decidedAt'].forEach((field) => {
    if (field in value && !isNonEmptyString(value[field])) {
      errors.push(`${labelFor(label, field)} must be a non-empty string`);
    }
  });
}

/**
 * Validates one schemaVersion 2 task.
 * @param {unknown} task - Candidate task object.
 * @param {string} label - Error path label.
 * @param {string[]} errors - Mutable error accumulator.
 * @param {{rejectUnknownFields?: boolean}} [options] - Validation options.
 * @returns {void} No return value.
 */
function validateTaskV2(task, label, errors, options = {}) {
  if (!isPlainObject(task)) {
    errors.push(`${label} must be an object`);
    return;
  }

  if (options.rejectUnknownFields === true) {
    rejectUnknownFields(task, TASK_V2_FIELDS, label, errors);
  }

  requireFields(task, TASK_V2_FIELDS, label, errors);

  TASK_V2_STRING_FIELDS.forEach((field) => {
    if (field in task && !isNonEmptyString(task[field])) {
      errors.push(`${labelFor(label, field)} must be a non-empty string`);
    }
  });

  if ('state' in task && !TASK_STATES.has(task.state)) {
    errors.push(`${label}.state must be a known task state`);
  }

  if ('attempt' in task) {
    validatePositiveInteger(task.attempt, `${label}.attempt`, errors);
  }

  if ('wave' in task) {
    validateWave(task.wave, `${label}.wave`, errors);
  }

  TASK_V2_ARRAY_FIELDS.forEach((field) => {
    if (field in task) {
      validateStringArray(task[field], labelFor(label, field), errors);
    }
  });

  if ('verification' in task) {
    validateVerificationPlanList(task.verification, `${label}.verification`, errors, options);
  }

  if ('reviewerDecision' in task) {
    validateReviewerDecision(task.reviewerDecision, `${label}.reviewerDecision`, errors, options);
  }

  if ('evidence' in task) {
    validateTaskEvidence(task.evidence, `${label}.evidence`, errors, options);
  }
}

/**
 * Validates schemaVersion 2 tasks.
 * @param {unknown} value - Candidate task list.
 * @param {string[]} errors - Mutable error accumulator.
 * @param {{rejectUnknownFields?: boolean}} [options] - Validation options.
 * @returns {void} No return value.
 */
function validateTasksV2(value, errors, options = {}) {
  if (!Array.isArray(value)) {
    errors.push('tasks must be an array');
    return;
  }

  value.forEach((task, index) => {
    validateTaskV2(task, `tasks[${index}]`, errors, options);
  });
}

/**
 * Validates phase commit references.
 * @param {unknown} value - Candidate phase commit list.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validatePhaseCommits(value, errors) {
  if (!Array.isArray(value)) {
    errors.push('phaseCommits must be an array');
    return;
  }

  value.forEach((entry, index) => {
    const label = `phaseCommits[${index}]`;
    if (isNonEmptyString(entry)) {
      return;
    }

    if (!isPlainObject(entry)) {
      errors.push(`${label} must be a non-empty string or object`);
      return;
    }

    rejectUnknownFields(entry, PHASE_COMMIT_STRING_FIELDS, label, errors);

    if (!COMMIT_REF_FIELDS.some((field) => isNonEmptyString(entry[field]))) {
      errors.push(`${label} must include a non-empty ref, commit, commitRef, or sha`);
    }

    PHASE_COMMIT_STRING_FIELDS.forEach((field) => {
      if (field in entry && !isNonEmptyString(entry[field])) {
        errors.push(`${labelFor(label, field)} must be a non-empty string`);
      }
    });
  });
}

/**
 * Validates Firestore/storage rules deployment status.
 * @param {unknown} value - Candidate rules deploy status.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateRulesDeployStatus(value, errors) {
  if (!isPlainObject(value)) {
    errors.push('rulesDeployStatus must be an object');
    return;
  }

  rejectUnknownFields(value, RULES_DEPLOY_STATUS_FIELDS, 'rulesDeployStatus', errors);
  requireFields(value, RULES_DEPLOY_STATUS_FIELDS, 'rulesDeployStatus', errors);

  if ('state' in value && !RULES_DEPLOY_STATES.has(value.state)) {
    errors.push('rulesDeployStatus.state must be a known deploy state');
  }

  ['required', 'changed'].forEach((field) => {
    if (field in value) {
      validateBoolean(value[field], labelFor('rulesDeployStatus', field), errors);
    }
  });

  if ('evidence' in value) {
    validateDeployEvidenceList(value.evidence, 'rulesDeployStatus.evidence', errors);
  }

  if ('deployedCommit' in value) {
    validateNullableString(value.deployedCommit, 'rulesDeployStatus.deployedCommit', errors);
    if (value.deployedCommit === '') {
      errors.push('rulesDeployStatus.deployedCommit must be null or a non-empty string');
    }
  }
}

/**
 * Validates recorded workflow incidents.
 * @param {unknown} value - Candidate incidents list.
 * @param {string[]} errors - Mutable error accumulator.
 * @returns {void} No return value.
 */
function validateIncidents(value, errors) {
  if (!Array.isArray(value)) {
    errors.push('incidents must be an array');
    return;
  }

  value.forEach((incident, index) => {
    const label = `incidents[${index}]`;
    if (!isPlainObject(incident)) {
      errors.push(`${label} must be an object`);
      return;
    }

    rejectUnknownFields(incident, [...INCIDENT_FIELDS, ...INCIDENT_OPTIONAL_FIELDS], label, errors);
    requireFields(incident, INCIDENT_FIELDS, label, errors);

    if ('state' in incident && !INCIDENT_STATES.has(incident.state)) {
      errors.push(`${label}.state must be open, mitigated, resolved, or closed`);
    }

    INCIDENT_FIELDS.forEach((field) => {
      if (field in incident && !isNonEmptyString(incident[field])) {
        errors.push(`${labelFor(label, field)} must be a non-empty string`);
      }
    });

    INCIDENT_OPTIONAL_FIELDS.forEach((field) => {
      if (field in incident) {
        validateNullableString(incident[field], labelFor(label, field), errors);
        if (incident[field] === '') {
          errors.push(`${labelFor(label, field)} must be null or a non-empty string`);
        }
      }
    });
  });
}

/**
 * Validates one workflow status file.
 * @param {string} filePath - Path to a status JSON file.
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

  requireFields(parsed, REQUIRED_FIELDS, '', errors);

  if ('schemaVersion' in parsed && !SUPPORTED_SCHEMA_VERSIONS.has(parsed.schemaVersion)) {
    errors.push('schemaVersion must be 1, 2, or 3');
  }

  ['feature', 'branch', 'worktree', 'phase'].forEach((field) => {
    if (field in parsed && !isNonEmptyString(parsed[field])) {
      errors.push(`${field} must be a non-empty string`);
    }
  });

  const strictV3Options = parsed.schemaVersion === 3
    ? { rejectUnknownFields: true }
    : {};

  if (parsed.schemaVersion === 2 || parsed.schemaVersion === 3) {
    ['activeWave', 'tasks'].forEach((field) => {
      if (!(field in parsed)) {
        errors.push(`${field} is required for schemaVersion ${parsed.schemaVersion}`);
      }
    });

    if ('activeWave' in parsed && parsed.activeWave !== null) {
      validateWave(parsed.activeWave, 'activeWave', errors);
    }

    if ('tasks' in parsed) {
      validateTasksV2(parsed.tasks, errors, strictV3Options);
    }

    if ('activeTask' in parsed) {
      validateActiveTaskV2(parsed.activeTask, parsed.tasks, errors);
    }

    if (parsed.schemaVersion === 3) {
      rejectUnknownFields(parsed, STATUS_V3_TOP_LEVEL_FIELDS, '', errors);

      STATUS_V3_FIELDS.forEach((field) => {
        if (!(field in parsed)) {
          errors.push(`${field} is required for schemaVersion 3`);
        }
      });

      if ('authorizationBoundary' in parsed) {
        validateAuthorizationBoundary(parsed.authorizationBoundary, errors);
      }

      if ('currentHead' in parsed) {
        validateNullableHeadSnapshot(parsed.currentHead, 'currentHead', errors);
      }

      if ('remoteHead' in parsed) {
        validateNullableHeadSnapshot(parsed.remoteHead, 'remoteHead', errors);
      }

      if ('phaseCommits' in parsed) {
        validatePhaseCommits(parsed.phaseCommits, errors);
      }

      if ('rulesDeployStatus' in parsed) {
        validateRulesDeployStatus(parsed.rulesDeployStatus, errors);
      }

      if ('incidents' in parsed) {
        validateIncidents(parsed.incidents, errors);
      }
    }
  } else if ('activeTask' in parsed) {
    validateActiveTaskV1(parsed.activeTask, errors);
  }

  if ('completedTasks' in parsed) {
    validateStringArray(parsed.completedTasks, 'completedTasks', errors);
  }

  if ('blocked' in parsed && typeof parsed.blocked !== 'boolean') {
    errors.push('blocked must be a boolean');
  }

  if ('blockedReason' in parsed) {
    validateNullableString(parsed.blockedReason, 'blockedReason', errors);
    if (parsed.blocked === true && !isNonEmptyString(parsed.blockedReason)) {
      errors.push('blockedReason must be a non-empty string when blocked is true');
    }
  }

  if ('lastVerification' in parsed) {
    validateVerificationList(parsed.lastVerification, 'lastVerification', errors, strictV3Options);
  }

  if ('lastVerifiedCommit' in parsed) {
    validateNullableString(parsed.lastVerifiedCommit, 'lastVerifiedCommit', errors);
  }

  if ('updatedAt' in parsed) {
    validateNullableString(parsed.updatedAt, 'updatedAt', errors);
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
