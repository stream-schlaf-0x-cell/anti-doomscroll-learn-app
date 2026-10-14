import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generateCraftMarkdown } from '../src/core/export/craftExport';
import { INITIAL_FIXTURES } from '../src/core/data/fixtures';
import { ReadingInteraction } from '../src/core/domain/types';

describe('Craft Docs & Markdown Exporter (Data Sovereignty)', () => {
  test('generates valid markdown document with title and frontmatter', () => {
    const md = generateCraftMarkdown([], {});
    assert.match(md, /# 🌿 Atem — Mein persönliches Erkenntnis-Archiv/);
    assert.match(md, /100% Lokale Datensouveränität/);
  });

  test('formats saved items, key insights, and user notes with sparring', () => {
    const item = INITIAL_FIXTURES[0];
    const interactions: Record<string, ReadingInteraction> = {
      [item.id]: {
        itemId: item.id,
        saved: true,
        savedAt: '2026-10-14T10:00:00Z',
        progressPercent: 100,
        furthestPositionPercent: 100,
        voteScore: 1,
        userNotes: [
          {
            id: 'note_1',
            text: 'Wichtiger Einwand zur kognitiven Selbstbestimmung.',
            createdAt: '2026-10-14T11:00:00Z',
            tag: 'einwand',
            sparringReply: {
              id: 'rep_1',
              authorHandle: 'u/sokrates_2026',
              authorBadge: 'Sokratischer Sparring-Partner',
              createdAt: '2026-10-14T11:01:00Z',
              text: 'Aber führt das nicht zu einem Widerspruch?'
            }
          }
        ]
      }
    };

    const md = generateCraftMarkdown([item], interactions);

    assert.match(md, new RegExp(item.title));
    assert.match(md, /\[⚡️ Einwand\]/);
    assert.match(md, /u\/sokrates_2026/);
    assert.match(md, /Aber führt das nicht zu einem Widerspruch\?/);
    assert.match(md, /Quelle/);
  });
});
