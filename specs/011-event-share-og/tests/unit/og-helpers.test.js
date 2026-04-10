/**
 * @file Unit tests for og-helpers — RED phase.
 * @description
 * Target module: src/lib/og-helpers.js (does not exist yet).
 * Functions under test: stripMarkup, truncate, buildEventOgDescription, buildPostOgDescription.
 */

import { describe, it, expect } from 'vitest';
import {
  stripMarkup,
  truncate,
  buildEventOgDescription,
  buildPostOgDescription,
} from '@/lib/og-helpers';

/* ==========================================================================
   stripMarkup(text)
   ========================================================================== */

describe('Unit: stripMarkup', () => {
  it('should remove HTML tags', () => {
    // Arrange
    const input = '<p>Hello <strong>world</strong></p>';

    // Act
    const result = stripMarkup(input);

    // Assert
    expect(result).toBe('Hello world');
  });

  it('should remove self-closing HTML tags', () => {
    // Arrange
    const input = 'line one<br/>line two<hr />';

    // Act
    const result = stripMarkup(input);

    // Assert
    expect(result).toBe('line oneline two');
  });

  it('should remove Markdown heading markers', () => {
    // Arrange
    const input = '## My Heading';

    // Act
    const result = stripMarkup(input);

    // Assert
    expect(result).toBe('My Heading');
  });

  it('should remove Markdown bold and italic markers', () => {
    // Arrange
    const input = '**bold** and *italic* and __also bold__ and _also italic_';

    // Act
    const result = stripMarkup(input);

    // Assert
    expect(result).toBe('bold and italic and also bold and also italic');
  });

  it('should remove Markdown blockquote markers', () => {
    // Arrange
    const input = '> quoted text';

    // Act
    const result = stripMarkup(input);

    // Assert
    expect(result).toBe('quoted text');
  });

  it('should remove Markdown list markers (- and *)', () => {
    // Arrange
    const inputDash = '- list item';
    const inputStar = '* list item';

    // Act
    const resultDash = stripMarkup(inputDash);
    const resultStar = stripMarkup(inputStar);

    // Assert
    expect(resultDash).toBe('list item');
    expect(resultStar).toBe('list item');
  });

  it('should preserve emoji characters', () => {
    // Arrange
    const input = '<p>Hello world! </p>';

    // Act
    const result = stripMarkup(input);

    // Assert
    expect(result).toBe('Hello world! ');
  });

  it('should decode HTML entities (&amp;, &lt;, &gt;)', () => {
    // Arrange
    const input = '5 &gt; 3 &amp; 2 &lt; 4';

    // Act
    const result = stripMarkup(input);

    // Assert
    expect(result).toBe('5 > 3 & 2 < 4');
  });

  it('should handle quotes and special characters', () => {
    // Arrange
    const input = 'He said &quot;hello&quot; &amp; she said &#39;hi&#39;';

    // Act
    const result = stripMarkup(input);

    // Assert
    expect(result).toBe('He said "hello" & she said \'hi\'');
  });

  it('should return empty string for empty input', () => {
    // Arrange & Act & Assert
    expect(stripMarkup('')).toBe('');
  });

  it('should return plain text unchanged', () => {
    // Arrange
    const input = 'Just plain text';

    // Act
    const result = stripMarkup(input);

    // Assert
    expect(result).toBe('Just plain text');
  });
});

/* ==========================================================================
   truncate(text, maxLen)
   ========================================================================== */

describe('Unit: truncate', () => {
  it('should return text as-is when under maxLen', () => {
    // Arrange
    const input = 'short';

    // Act
    const result = truncate(input, 10);

    // Assert
    expect(result).toBe('short');
  });

  it('should return text as-is when exactly at maxLen', () => {
    // Arrange
    const input = '1234567890';

    // Act
    const result = truncate(input, 10);

    // Assert
    expect(result).toBe('1234567890');
  });

  it('should truncate and append ellipsis when exceeding maxLen', () => {
    // Arrange
    const input = '12345678901';

    // Act
    const result = truncate(input, 10);

    // Assert
    expect(result).toBe('1234567890\u2026');
  });

  it('should handle empty string', () => {
    // Arrange & Act & Assert
    expect(truncate('', 10)).toBe('');
  });

  it('should handle CJK characters correctly', () => {
    // Arrange
    const input = '今天第一次跑完半馬沿途風景很美';

    // Act
    const result = truncate(input, 5);

    // Assert
    expect(result).toBe('今天第一次\u2026');
  });

  it('should preserve emoji when truncating', () => {
    // Arrange
    const input = 'Run ';

    // Act
    const result = truncate(input, 80);

    // Assert
    expect(result).toBe('Run ');
  });
});

/* ==========================================================================
   buildEventOgDescription(event)
   ========================================================================== */

describe('Unit: buildEventOgDescription', () => {
  /**
   * Helper to create a mock Firestore Timestamp.
   * @param {Date} date - Date to convert.
   * @returns {{ toDate: () => Date }} Mock Timestamp object.
   */
  const mockTimestamp = (date) => ({
    toDate: () => date,
  });

  it('should format event with full city and district', () => {
    // Arrange
    const event = {
      time: mockTimestamp(new Date('2026-04-15T09:00:00')),
      city: '\u53f0\u5317\u5e02',
      district: '\u5927\u5b89\u5340',
    };

    // Act
    const result = buildEventOgDescription(event);

    // Assert
    expect(result).toBe('\u300c2026/04/15 \u00b7 \u53f0\u5317\u5e02\u5927\u5b89\u5340\u300d');
  });

  it('should omit district when empty', () => {
    // Arrange
    const event = {
      time: mockTimestamp(new Date('2026-04-15T09:00:00')),
      city: '\u53f0\u5317\u5e02',
      district: '',
    };

    // Act
    const result = buildEventOgDescription(event);

    // Assert
    expect(result).toBe('\u300c2026/04/15 \u00b7 \u53f0\u5317\u5e02\u300d');
  });

  it('should omit city when empty', () => {
    // Arrange
    const event = {
      time: mockTimestamp(new Date('2026-04-15T09:00:00')),
      city: '',
      district: '\u5927\u5b89\u5340',
    };

    // Act
    const result = buildEventOgDescription(event);

    // Assert
    expect(result).toBe('\u300c2026/04/15 \u00b7 \u5927\u5b89\u5340\u300d');
  });

  it('should omit separator when both city and district are empty', () => {
    // Arrange
    const event = {
      time: mockTimestamp(new Date('2026-04-15T09:00:00')),
      city: '',
      district: '',
    };

    // Act
    const result = buildEventOgDescription(event);

    // Assert
    expect(result).toBe('\u300c2026/04/15\u300d');
  });

  it('should pad single-digit month and day with zero', () => {
    // Arrange
    const event = {
      time: mockTimestamp(new Date('2026-01-05T09:00:00')),
      city: '\u53f0\u5317\u5e02',
      district: '\u4fe1\u7fa9\u5340',
    };

    // Act
    const result = buildEventOgDescription(event);

    // Assert
    expect(result).toBe('\u300c2026/01/05 \u00b7 \u53f0\u5317\u5e02\u4fe1\u7fa9\u5340\u300d');
  });

  it('should return fallback description when event is null', () => {
    // Arrange & Act
    const result = buildEventOgDescription(null);

    // Assert
    expect(result).toBe('Dive Into Run \u8dd1\u6b65\u793e\u7fa4\u5e73\u53f0');
  });

  it('should return fallback description when event is undefined', () => {
    // Arrange & Act
    const result = buildEventOgDescription(undefined);

    // Assert
    expect(result).toBe('Dive Into Run \u8dd1\u6b65\u793e\u7fa4\u5e73\u53f0');
  });
});

/* ==========================================================================
   buildPostOgDescription(post)
   ========================================================================== */

describe('Unit: buildPostOgDescription', () => {
  it('should format post with title and plain text excerpt', () => {
    // Arrange
    const post = {
      title: '\u6211\u7684\u8dd1\u6b65\u5fc3\u5f97',
      content: '\u4eca\u5929\u7b2c\u4e00\u6b21\u8dd1\u5b8c\u534a\u99ac',
    };

    // Act
    const result = buildPostOgDescription(post);

    // Assert
    expect(result).toBe(
      '\u300c\u6211\u7684\u8dd1\u6b65\u5fc3\u5f97 \u2014 \u4eca\u5929\u7b2c\u4e00\u6b21\u8dd1\u5b8c\u534a\u99ac\u300d',
    );
  });

  it('should strip HTML tags from content', () => {
    // Arrange
    const post = {
      title: 'Trail Run',
      content: '<p>First <strong>trail run</strong> today!</p>',
    };

    // Act
    const result = buildPostOgDescription(post);

    // Assert
    expect(result).toBe('\u300cTrail Run \u2014 First trail run today!\u300d');
  });

  it('should strip Markdown formatting from content', () => {
    // Arrange
    const post = {
      title: '\u8a13\u7df4\u7d00\u9304',
      content: '## \u4eca\u65e5\u8a13\u7df4\n**5K** \u914d\u901f *5:30*',
    };

    // Act
    const result = buildPostOgDescription(post);

    // Assert
    expect(result).toContain('\u300c\u8a13\u7df4\u7d00\u9304 \u2014');
    expect(result).not.toContain('##');
    expect(result).not.toContain('**');
    expect(result).not.toContain('*');
  });

  it('should truncate content to 80 characters and append ellipsis', () => {
    // Arrange
    const longContent =
      '\u4eca\u5929\u7b2c\u4e00\u6b21\u8dd1\u5b8c\u534a\u99ac\uff0c\u6cbf\u9014\u98a8\u666f\u5f88\u7f8e\uff0c\u7d93\u904e\u6cb3\u6ff1\u516c\u5712\u7684\u6642\u5019\u770b\u5230\u5f88\u591a\u4eba\u5728\u6563\u6b65\uff0c\u5929\u6c23\u5f88\u597d\uff0c\u5fae\u98a8\u5f90\u5f90\uff0c\u8dd1\u8d77\u4f86\u5f88\u8212\u670d\uff0c\u4e0b\u6b21\u9084\u8981\u518d\u4f86\u9019\u689d\u8def\u7dda\u8dd1\u6b65\uff0c\u771f\u7684\u592a\u68d2\u4e86\uff0c\u5e0c\u671b\u53ef\u4ee5\u4e00\u76f4\u4fdd\u6301\u9019\u500b\u7fd2\u6163';
    const post = {
      title: '\u6211\u7684\u8dd1\u6b65\u5fc3\u5f97',
      content: longContent,
    };

    // Act
    const result = buildPostOgDescription(post);

    // Assert — content portion should be truncated to 80 chars with ellipsis
    // Format: 「{title} — {excerpt}…」
    expect(result).toMatch(/\u2026\u300d$/);
    // Verify title is present
    expect(result).toContain('\u300c\u6211\u7684\u8dd1\u6b65\u5fc3\u5f97 \u2014');
  });

  it('should NOT add ellipsis when content is exactly 80 characters', () => {
    // Arrange — exactly 80 CJK characters
    const exactContent =
      '\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57\u5341\u5b57';
    const post = {
      title: 'Test',
      content: exactContent,
    };

    // Act
    const result = buildPostOgDescription(post);

    // Assert — no ellipsis when exactly 80
    expect(result).not.toMatch(/\u2026\u300d$/);
    expect(result).toMatch(/\u300d$/);
  });

  it('should NOT add ellipsis when content is under 80 characters', () => {
    // Arrange
    const post = {
      title: 'Short Post',
      content: 'Just a short note.',
    };

    // Act
    const result = buildPostOgDescription(post);

    // Assert
    expect(result).toBe('\u300cShort Post \u2014 Just a short note.\u300d');
  });

  it('should preserve emoji in content', () => {
    // Arrange
    const post = {
      title: 'Run Day',
      content: 'Great run today! \ud83c\udfc3\u200d\u2642\ufe0f Felt amazing!',
    };

    // Act
    const result = buildPostOgDescription(post);

    // Assert
    expect(result).toContain('\ud83c\udfc3\u200d\u2642\ufe0f');
  });

  it('should decode HTML entities in content', () => {
    // Arrange
    const post = {
      title: 'Q&amp;A',
      content: '5K &gt; 3K &amp; 10K &lt; 21K',
    };

    // Act
    const result = buildPostOgDescription(post);

    // Assert
    expect(result).toContain('5K > 3K & 10K < 21K');
  });

  it('should return fallback description when post is null', () => {
    // Arrange & Act
    const result = buildPostOgDescription(null);

    // Assert
    expect(result).toBe('Dive Into Run \u8dd1\u6b65\u793e\u7fa4\u5e73\u53f0');
  });

  it('should return fallback description when post is undefined', () => {
    // Arrange & Act
    const result = buildPostOgDescription(undefined);

    // Assert
    expect(result).toBe('Dive Into Run \u8dd1\u6b65\u793e\u7fa4\u5e73\u53f0');
  });

  it('should handle empty content gracefully', () => {
    // Arrange
    const post = {
      title: 'Empty Post',
      content: '',
    };

    // Act
    const result = buildPostOgDescription(post);

    // Assert
    expect(result).toContain('\u300cEmpty Post');
  });

  it('should handle content with mixed HTML and Markdown', () => {
    // Arrange
    const post = {
      title: 'Mixed',
      content: '<p>## Heading</p>\n<strong>**nested bold**</strong>\n> quote',
    };

    // Act
    const result = buildPostOgDescription(post);

    // Assert
    expect(result).not.toContain('<p>');
    expect(result).not.toContain('<strong>');
    expect(result).not.toContain('##');
    expect(result).toContain('\u300cMixed \u2014');
  });
});
