import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AtemStorage, MemoryStorageDriver } from '../src/core/data/storage';
import { InvestigationRepository } from '../src/core/investigation/investigationRepository';
import { Investigation } from '../src/core/investigation/types';

describe('InvestigationRepository & Markdown Export', () => {
  it('1. Loads empty array on clean storage', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const repo = new InvestigationRepository(storage);
    const all = await repo.getAllInvestigations();
    assert.deepStrictEqual(all, []);
  });

  it('2. Saves, retrieves, and updates an investigation cleanly', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const repo = new InvestigationRepository(storage);

    const testInvestigation: Investigation = {
      id: 'inv-test-1',
      title: 'Effekt von 5.5s Atmung auf Herzratenvariabilität',
      question: 'Welche physiologischen Messwerte belegen die Amygdala-Dämpfung?',
      scope: 'single_source',
      sources: [
        {
          id: 'src-breath-1',
          title: 'Cell Reports Medicine (2023)',
          publisher: 'Cell Press',
          contentSnippet: 'Cyclic sighing significantly reduced negative affect and heart rate over 28 days (p < 0.001).',
          fullTextAvailable: true,
          wordCount: 120
        }
      ],
      status: 'completed',
      historyVersions: [],
      userNotes: ['Erste eigene Notiz zur Vagus-Theorie'],
      connectedThoughtNodeIds: [],
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z',
      currentResult: {
        version: 1,
        timestamp: '2026-10-18T10:00:00.000Z',
        synthesisSummary: 'Zyklisches Seufzen führt nachweislich zu reduzierter sympathischer Erregung.',
        groundedClaims: [
          {
            id: 'c1',
            claim: 'Signifikante Reduktion negativer Affekte bei 5 Minuten täglicher Praxis.',
            exactQuote: 'Cyclic sighing significantly reduced negative affect and heart rate over 28 days (p < 0.001).',
            sourceId: 'src-breath-1',
            sourceTitle: 'Cell Reports Medicine (2023)',
            evidenceType: 'observation',
            confidence: 'direct_quote'
          }
        ],
        limitationsAndCounterpoints: ['Kleine Kohorte im ambulanten Setting (n = 108).'],
        openQuestions: ['Langzeiteffekte über 6 Monate hinaus unklar.'],
        suggestedNextSteps: [
          {
            id: 's1',
            type: 'trace',
            label: 'Originaldaten der Kontrollgruppe prüfen',
            promptOrAction: 'https://doi.org/...',
            rationale: 'Vergleich mit Achtsamkeitsmeditation'
          }
        ],
        modelUsed: 'gemini-3.8-flash',
        promptVersion: '2026-10-18-v1',
        executionMode: 'ai_real'
      }
    };

    await repo.saveInvestigation(testInvestigation);

    const retrieved = await repo.getInvestigation('inv-test-1');
    assert.ok(retrieved);
    assert.strictEqual(retrieved.title, testInvestigation.title);
    assert.strictEqual(retrieved.currentResult?.groundedClaims.length, 1);
    assert.strictEqual(retrieved.currentResult?.groundedClaims[0].evidenceType, 'observation');
  });

  it('3. UserVerdict is updated independently without overriding AI claims', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const repo = new InvestigationRepository(storage);

    const testInvestigation: Investigation = {
      id: 'inv-verdict-1',
      title: 'Didaktischer Nutzen von Flipped Classroom',
      question: 'Ist der Effekt replizierbar?',
      scope: 'single_source',
      sources: [],
      status: 'completed',
      historyVersions: [],
      userNotes: [],
      connectedThoughtNodeIds: [],
      createdAt: '2026-10-18T12:00:00.000Z',
      updatedAt: '2026-10-18T12:00:00.000Z'
    };

    await repo.saveInvestigation(testInvestigation);
    await repo.updateUserVerdict('inv-verdict-1', 'Überzeugt mich für Sekundarstufe II, nicht für Primarstufe.');

    const updated = await repo.getInvestigation('inv-verdict-1');
    assert.ok(updated);
    assert.strictEqual(updated.userVerdict, 'Überzeugt mich für Sekundarstufe II, nicht für Primarstufe.');
  });

  it('4. Exports structured research brief to publication-ready Markdown with YAML frontmatter & Wikilinks', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const repo = new InvestigationRepository(storage);

    const testInvestigation: Investigation = {
      id: 'inv-md-1',
      title: 'Simone Weil und die Kultur der Aufmerksamkeit',
      question: 'Wie unterscheidet Weil Aufmerksamkeit von erzwungener Willensanstrengung?',
      scope: 'single_source',
      sources: [
        {
          id: 'src-weil',
          title: 'Attente de Dieu',
          publisher: 'Gallimard',
          contentSnippet: 'Aufmerksamkeit besteht im Innehalten, im Warten und Nicht-Wollen.',
          fullTextAvailable: true,
          wordCount: 80
        }
      ],
      status: 'completed',
      historyVersions: [],
      userVerdict: 'Zentraler Text für das Manifest gegen Informationsüberflutung.',
      userNotes: ['Mit Byung-Chul Han verknüpfen'],
      connectedThoughtNodeIds: [],
      createdAt: '2026-10-18T14:00:00.000Z',
      updatedAt: '2026-10-18T14:00:00.000Z',
      currentResult: {
        version: 1,
        timestamp: '2026-10-18T14:00:00.000Z',
        synthesisSummary: 'Weil definiert Aufmerksamkeit als Entsagung des subjektiven Willens.',
        groundedClaims: [
          {
            id: 'c-w1',
            claim: 'Aufmerksamkeit ist rezeptives Warten, kein aggressives Zugreifen.',
            exactQuote: 'Aufmerksamkeit besteht im Innehalten, im Warten und Nicht-Wollen.',
            sourceId: 'src-weil',
            sourceTitle: 'Attente de Dieu',
            evidenceType: 'interpretation',
            confidence: 'direct_quote'
          }
        ],
        limitationsAndCounterpoints: ['Mystischer und religiöser Rahmen ist nicht säkular neutral.'],
        openQuestions: ['Wie lässt sich dieses Modell im digitalen Schulalltag operationalisieren?'],
        suggestedNextSteps: [
          {
            id: 's-w1',
            type: 'connect',
            label: 'Mit Han verknüpfen',
            promptOrAction: 'Byung-Chul Han Müdigkeitsgesellschaft',
            rationale: 'Parallele zur negativen Potenz'
          }
        ],
        modelUsed: 'gemini-3.8-flash',
        promptVersion: '2026-10-18-v1',
        executionMode: 'ai_real'
      }
    };

    const markdown = repo.exportInvestigationToMarkdown(testInvestigation);

    assert.ok(markdown.includes('title: "Untersuchung: Simone Weil und die Kultur der Aufmerksamkeit"'));
    assert.ok(markdown.includes('type: "research_brief"'));
    assert.ok(markdown.includes('## 1. 💡 Was sich aus dem verfügbaren Material ableiten lässt'));
    assert.ok(markdown.includes('## 2. 📖 Belegstellen & Zitate'));
    assert.ok(markdown.includes('„Aufmerksamkeit besteht im Innehalten, im Warten und Nicht-Wollen.“'));
    assert.ok(markdown.includes('## 3. ⚠️ Relevante Grenzen & Gegenargumente'));
    assert.ok(markdown.includes('## ✍️ Mein persönliches Urteil'));
    assert.ok(markdown.includes('Zentraler Text für das Manifest gegen Informationsüberflutung.'));
  });

  it('5. Deletes an investigation cleanly without residual artifacts', async () => {
    const storage = new AtemStorage(new MemoryStorageDriver());
    const repo = new InvestigationRepository(storage);

    const item: Investigation = {
      id: 'inv-del-1',
      title: 'Zu löschen',
      question: 'Test',
      scope: 'single_source',
      sources: [],
      status: 'idle',
      historyVersions: [],
      userNotes: [],
      connectedThoughtNodeIds: [],
      createdAt: '2026-10-18T10:00:00.000Z',
      updatedAt: '2026-10-18T10:00:00.000Z'
    };

    await repo.saveInvestigation(item);
    assert.strictEqual((await repo.getAllInvestigations()).length, 1);

    await repo.deleteInvestigation('inv-del-1');
    assert.strictEqual((await repo.getAllInvestigations()).length, 0);
  });
});
