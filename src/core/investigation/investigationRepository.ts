import { appStorage, AtemStorage } from '../data/storage';
import { Investigation } from './types';

export const INVESTIGATIONS_STORAGE_KEY = '@atem:investigations:v1';

export class InvestigationRepository {
  constructor(private readonly storage: AtemStorage = appStorage) {}

  async getAllInvestigations(): Promise<Investigation[]> {
    try {
      const raw = await this.storage.getItem(INVESTIGATIONS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      }
      return [];
    } catch {
      return [];
    }
  }

  async getInvestigation(id: string): Promise<Investigation | null> {
    const list = await this.getAllInvestigations();
    return list.find(item => item.id === id) || null;
  }

  async saveInvestigation(investigation: Investigation): Promise<void> {
    const list = await this.getAllInvestigations();
    const existingIndex = list.findIndex(item => item.id === investigation.id);

    const updated = {
      ...investigation,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      list[existingIndex] = updated;
    } else {
      list.unshift(updated);
    }

    await this.storage.setItem(INVESTIGATIONS_STORAGE_KEY, JSON.stringify(list));
  }

  async deleteInvestigation(id: string): Promise<void> {
    const list = await this.getAllInvestigations();
    const filtered = list.filter(item => item.id !== id);
    await this.storage.setItem(INVESTIGATIONS_STORAGE_KEY, JSON.stringify(filtered));
  }

  async updateUserVerdict(id: string, verdict: string): Promise<Investigation | null> {
    const item = await this.getInvestigation(id);
    if (!item) return null;
    item.userVerdict = verdict.trim();
    await this.saveInvestigation(item);
    return item;
  }

  async addUserNote(id: string, note: string): Promise<Investigation | null> {
    const item = await this.getInvestigation(id);
    if (!item || !note.trim()) return null;
    item.userNotes.push(note.trim());
    await this.saveInvestigation(item);
    return item;
  }

  exportInvestigationToMarkdown(investigation: Investigation): string {
    const res = investigation.currentResult;
    const dateStr = new Date(investigation.updatedAt).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let md = `---
title: "Untersuchung: ${investigation.title.replace(/"/g, '\\"')}"
date: "${investigation.createdAt}"
updated: "${investigation.updatedAt}"
type: "research_brief"
tags: ["atmen", "untersuchung", "recherchebrief"]
sources: ${JSON.stringify(investigation.sources.map(s => s.title))}
execution_mode: "${res?.executionMode || 'unspecified'}"
---

# 🔍 Untersuchung: ${investigation.title}

> **Zentrale Leitfrage**: *„${investigation.question}“*
> **Stand**: ${dateStr} • **Quellen**: ${investigation.sources.length} • **Status**: ${investigation.status}

---

## 1. 💡 Was sich aus dem verfügbaren Material ableiten lässt
${res?.synthesisSummary || '_Keine Synthese verfügbar._'}

---

## 2. 📖 Belegstellen & Zitate (Darauf stützt sich diese Einordnung)
`;

    if (res?.groundedClaims && res.groundedClaims.length > 0) {
      for (const claim of res.groundedClaims) {
        const typeLabel =
          claim.evidenceType === 'observation'
            ? '🔍 Beobachtung'
            : claim.evidenceType === 'interpretation'
            ? '💭 Interpretation'
            : claim.evidenceType === 'causal_claim'
            ? '⚡ Kausalbehauptung'
            : '⚖️ Normative Aussage';

        md += `### [${typeLabel}] ${claim.claim}\n`;
        md += `> „${claim.exactQuote}“\n\n`;
        md += `*Quelle*: [${claim.sourceTitle}](${claim.sourceUrl || '#'}) • *Sicherheit*: \`${claim.confidence}\`\n\n`;
      }
    } else {
      md += `_Keine direkten Belegstellen erfasst._\n\n`;
    }

    md += `---

## 3. ⚠️ Relevante Grenzen & Gegenargumente
`;

    if (res?.limitationsAndCounterpoints && res.limitationsAndCounterpoints.length > 0) {
      for (const lim of res.limitationsAndCounterpoints) {
        md += `- ${lim}\n`;
      }
      md += '\n';
    } else {
      md += `_Keine methodischen Grenzen dokumentiert._\n\n`;
    }

    md += `---

## 4. ❓ Was offen bleibt
`;

    if (res?.openQuestions && res.openQuestions.length > 0) {
      for (const q of res.openQuestions) {
        md += `- ${q}\n`;
      }
      md += '\n';
    } else {
      md += `_Keine offenen Punkte verzeichnet._\n\n`;
    }

    if (res?.diffFromPreviousVersion) {
      md += `---

## 🔄 Veränderung gegenüber vorherigem Stand (${res.diffFromPreviousVersion.category})
**${res.diffFromPreviousVersion.summary}**

${res.diffFromPreviousVersion.impactOnPreviousClaims}

`;
      for (const d of res.diffFromPreviousVersion.details) {
        md += `- ${d}\n`;
      }
      md += '\n';
    }

    if (investigation.userVerdict) {
      md += `---

## ✍️ Mein persönliches Urteil (Unveränderbare Notiz)
${investigation.userVerdict}

`;
    }

    if (investigation.userNotes.length > 0) {
      md += `### Eigene Reflexionsnotizen\n`;
      for (const note of investigation.userNotes) {
        md += `- ${note}\n`;
      }
      md += '\n';
    }

    md += `---
*Erstellt mit [atmen](https://atmen.app) — Autonome Recherche & epistemische Kuration*
`;

    return md;
  }
}

export const defaultInvestigationRepository = new InvestigationRepository();
