// @vitest-environment node
import { describe, expect, it } from 'vitest';

import depCruiseConfig from '../../../.dependency-cruiser.mjs';

/**
 * Finds a forbidden rule by name from the dependency-cruiser config.
 * @param {string} ruleName - The rule name to search for.
 * @returns {object | undefined} The matched rule, or undefined.
 */
function findRule(ruleName) {
  return depCruiseConfig.forbidden.find((candidate) => candidate.name === ruleName);
}

describe('S028 provider-no-service cross-cutting isolation', () => {
  const rule = findRule('provider-no-service');

  it('registers the rule in the forbidden list', () => {
    expect(rule).toBeDefined();
  });

  it('has severity error', () => {
    expect(rule.severity).toBe('error');
  });

  it('scopes from.path to src/runtime/providers/', () => {
    expect(rule.from.path).toBe('^src/runtime/providers(?:/|$)');
  });

  it('targets the service layer in to.path', () => {
    expect(rule.to.path).toBe('^src/service(?:/|$)');
  });

  it('exempts type-only and jsdoc dependency types', () => {
    expect(rule.to.dependencyTypesNot).toEqual(
      expect.arrayContaining(['type-only', 'jsdoc', 'type-import']),
    );
  });
});
