import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const COMPOSE_PROMPT_CSS_PATH = path.join(
  process.cwd(),
  'src/components/ComposePrompt.module.css',
);

/**
 * Returns CSS declarations for a single class selector in a flat CSS module.
 * @param {string} selector - CSS selector to inspect.
 * @returns {Record<string, string>} Declaration map.
 */
function getDeclarations(selector) {
  const source = readFileSync(COMPOSE_PROMPT_CSS_PATH, 'utf8');
  const selectorPattern = selector.replace('.', String.raw`\.`);
  const match = new RegExp(`${selectorPattern}\\s*\\{(?<body>[^}]*)\\}`).exec(source);
  const body = match?.groups?.body ?? '';

  return Object.fromEntries(
    body
      .split(';')
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const [property, ...valueParts] = declaration.split(':');
        return [property.trim(), valueParts.join(':').trim()];
      }),
  );
}

describe('ComposePrompt.module.css', () => {
  it('keeps the avatar square before circular cropping', () => {
    const avatarRules = getDeclarations('.avatar');

    expect(avatarRules).toMatchObject({
      width: '36px',
      height: '36px',
      'border-radius': '50%',
      'object-fit': 'cover',
    });
  });
});
