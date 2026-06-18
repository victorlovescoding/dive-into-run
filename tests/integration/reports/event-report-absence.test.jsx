import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../../..');

/**
 * Reads a repo file as UTF-8 text.
 * @param {string} relativePath Repo-relative file path.
 * @returns {string} File contents.
 */
function readRepoFile(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('Phase 1 event report absence', () => {
  it('does not wire event or eventComment report UI into event screens', () => {
    const eventScreenSources = [
      readRepoFile('src/ui/events/EventsPageScreen.jsx'),
      readRepoFile('src/ui/events/EventDetailScreen.jsx'),
      readRepoFile('src/components/EventCardMenu.jsx'),
    ].join('\n');

    expect(eventScreenSources).not.toMatch(/ReportDialog|handleOpenReport|onReport|檢舉/);
    expect(eventScreenSources).not.toMatch(/targetType:\s*['"]event(Comment)?['"]/);
  });

  it('does not add report composite indexes for Phase 1', () => {
    const firestoreIndexes = readRepoFile('firestore.indexes.json');

    expect(firestoreIndexes).not.toMatch(/"collectionGroup"\s*:\s*"reports"/);
  });
});
