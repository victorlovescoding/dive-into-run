import { describe, expect, test } from 'vitest';

import { createPageMetadata, formatPageTitle, SITE_NAME } from './site-metadata';

describe('site metadata helpers', () => {
  test('keeps the root title as the site name', () => {
    expect(SITE_NAME).toBe('Dive Into Run');
    expect(formatPageTitle()).toBe('Dive Into Run');
  });

  test('suffixes page titles with the site name', () => {
    expect(formatPageTitle('天氣')).toBe('天氣 | Dive Into Run');
    expect(formatPageTitle('週末晨跑')).toBe('週末晨跑 | Dive Into Run');
  });

  test('creates page metadata with consistent social titles', () => {
    expect(createPageMetadata('文章河道', '看看跑步文章')).toEqual({
      title: '文章河道 | Dive Into Run',
      description: '看看跑步文章',
      openGraph: {
        title: '文章河道 | Dive Into Run',
        description: '看看跑步文章',
      },
      twitter: {
        title: '文章河道 | Dive Into Run',
        description: '看看跑步文章',
      },
    });
  });
});
