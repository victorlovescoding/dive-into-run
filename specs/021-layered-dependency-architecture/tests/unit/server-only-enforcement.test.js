// @vitest-environment node
import { describe, expect, it } from 'vitest';

import depCruiseConfig from '../../../../.dependency-cruiser.mjs';

/**
 * Finds a forbidden rule by name from the dependency-cruiser config.
 * @param {string} ruleName - The rule name to search for.
 * @returns {object | undefined} The matched rule, or undefined.
 */
function findRule(ruleName) {
  return depCruiseConfig.forbidden.find((candidate) => candidate.name === ruleName);
}

describe('S027 server-deps-require-server-path enforcement', () => {
  const rule = findRule('server-deps-require-server-path');

  it('registers the rule in the forbidden list', () => {
    expect(rule).toBeDefined();
  });

  it('has severity error', () => {
    expect(rule.severity).toBe('error');
  });

  it('scopes from.path to src/ and excludes server paths via pathNot', () => {
    expect(rule.from.path).toBe('^src/');
    expect(rule.from.pathNot).toEqual(expect.stringContaining('server'));
  });

  it('targets firebase-admin and firebase-admin-app in to.path', () => {
    const toPath = rule.to.path;

    expect(toPath).toEqual(expect.stringContaining('firebase-admin'));
    expect(toPath).toEqual(expect.stringContaining('firebase-admin-app'));
  });

  it('exempts type-only and jsdoc dependency types', () => {
    expect(rule.to.dependencyTypesNot).toEqual(expect.arrayContaining(['type-only', 'jsdoc']));
  });
});
