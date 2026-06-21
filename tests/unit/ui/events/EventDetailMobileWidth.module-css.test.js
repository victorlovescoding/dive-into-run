import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const EVENT_DETAIL_CSS_PATH = path.join(
  process.cwd(),
  'src/ui/events/EventDetailScreen.module.css',
);
const COMMENT_SECTION_CSS_PATH = path.join(
  process.cwd(),
  'src/components/CommentSection.module.css',
);

/**
 * Extracts the raw body for a matching media query block.
 * @param {string} source - CSS source text to inspect.
 * @param {string} mediaQuery - Media query condition including parentheses.
 * @returns {string} Inner text of the matched media block.
 */
function getMediaBlock(source, mediaQuery) {
  const atRule = `@media ${mediaQuery}`;
  const start = source.indexOf(atRule);

  if (start === -1) {
    return '';
  }

  const openBrace = source.indexOf('{', start);

  if (openBrace === -1) {
    return '';
  }

  let depth = 1;

  for (let i = openBrace + 1; i < source.length; i += 1) {
    if (source[i] === '{') {
      depth += 1;
    } else if (source[i] === '}') {
      depth -= 1;
    }

    if (depth === 0) {
      return source.slice(openBrace + 1, i);
    }
  }

  return '';
}

/**
 * Reads declarations for a selector from a flat block of CSS text.
 * @param {string} source - CSS text that already contains the selector rule.
 * @param {string} selector - Class selector to inspect.
 * @returns {Record<string, string>} Declaration map keyed by property name.
 */
function getDeclarations(source, selector) {
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

describe('event detail mobile width CSS regressions', () => {
  it('overrides the event detail content width on mobile without reusing 65vw', () => {
    const source = readFileSync(EVENT_DETAIL_CSS_PATH, 'utf8');
    const mobileBlock = getMediaBlock(source, '(max-width: 767px)');
    const rules = getDeclarations(mobileBlock, '.eventsSection');

    expect(mobileBlock).toContain('.eventsSection');
    expect(rules).toMatchObject({
      width: '100%',
    });
    expect(mobileBlock).not.toContain('65vw');
  });

  it('overrides the fixed event comment composer width on mobile without reusing 65vw', () => {
    const source = readFileSync(COMMENT_SECTION_CSS_PATH, 'utf8');
    const mobileBlock = getMediaBlock(source, '(max-width: 767px)');
    const rules = getDeclarations(mobileBlock, '.eventComposer');

    expect(mobileBlock).toContain('.eventComposer');
    expect(rules).toMatchObject({
      '--comment-composer-width': 'calc(100vw - 2rem)',
    });
    expect(mobileBlock).not.toContain('65vw');
  });
});
