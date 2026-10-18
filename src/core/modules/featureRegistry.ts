import { z } from 'zod';
import { UserProfile } from '../domain/types';

export const FeatureModuleIdSchema = z.enum([
  'socratic_sparring',
  'didactic_transfer',
  'cross_references',
  'sound_grounding',
  'craft_obsidian_export',
  'why_this_transparency',
  'breathing_portal',
  'bloomscroll_quizzes',
  'hivemind_streams'
]);
export type FeatureModuleId = z.infer<typeof FeatureModuleIdSchema>;

export interface FeatureModuleDefinition {
  id: FeatureModuleId;
  title: string;
  description: string;
  icon: string;
  category: 'reading' | 'reflection' | 'export' | 'discovery';
  defaultEnabled: boolean;
}

export const FEATURE_MODULES: readonly FeatureModuleDefinition[] = [
  {
    id: 'socratic_sparring',
    title: 'Sokratisches Sparring & Dialektik',
    description: 'Hegelsche Gegenthesen, philosophische Einwände und dialektische Vertiefungsfragen.',
    icon: 'chatbubbles-outline',
    category: 'reflection',
    defaultEnabled: true
  },
  {
    id: 'didactic_transfer',
    title: 'Didaktischer Transfer & Schul-Impuls',
    description: 'Konkrete Anknüpfungspunkte für Unterricht, Bildungskonzepte und Lernpsychologie.',
    icon: 'school-outline',
    category: 'reflection',
    defaultEnabled: true
  },
  {
    id: 'cross_references',
    title: 'Netzwerk-Querverweise (Cross-References)',
    description: 'Verwandte Beiträge und thematische Brücken im lokalen Wissens-Kanon.',
    icon: 'git-network-outline',
    category: 'discovery',
    defaultEnabled: true
  },
  {
    id: 'sound_grounding',
    title: 'Klang-Erdung & Soundscapes',
    description: 'Kuratierte Ambient- und Fokus-Musik (Brian Eno, Nils Frahm) zum Innehalten.',
    icon: 'musical-notes-outline',
    category: 'reading',
    defaultEnabled: true
  },
  {
    id: 'craft_obsidian_export',
    title: 'Craft & Obsidian Markdown-Export',
    description: 'Exportiere Notizen und Wissens-Karten mit einem Klick als sauberes Markdown.',
    icon: 'document-text-outline',
    category: 'export',
    defaultEnabled: true
  },
  {
    id: 'why_this_transparency',
    title: 'Epistemische Transparenz („Warum sehe ich das?“)',
    description: 'Vollständige Offenlegung der thematischen Gewichtung und kuratorischen Provenienz.',
    icon: 'help-circle-outline',
    category: 'reading',
    defaultEnabled: true
  },
  {
    id: 'breathing_portal',
    title: 'Atmen-Portal & Entschleunigungs-Tor',
    description: 'Nahtlose Integration der Atem-App (4s-2s-6s) zur mentalen Zentrierung beim Lesen.',
    icon: 'fitness-outline',
    category: 'reflection',
    defaultEnabled: true
  },
  {
    id: 'bloomscroll_quizzes',
    title: 'Bloomscrolling & Quiz-Checkpoints',
    description: 'Interaktive Verständnis- und Transferfragen alle 3 Beiträge für nachhaltiges Lernen.',
    icon: 'bulb-outline',
    category: 'discovery',
    defaultEnabled: true
  },
  {
    id: 'hivemind_streams',
    title: 'Hivemind 2.0 Themen- & Text-zu-Stream',
    description: 'Generiere 4-teilige dialektische Lernströme aus beliebigen Themen oder Quellen-Notizen.',
    icon: 'color-wand-outline',
    category: 'discovery',
    defaultEnabled: true
  }
];

export const DEFAULT_ENABLED_MODULES: Record<FeatureModuleId, boolean> = {
  socratic_sparring: true,
  didactic_transfer: true,
  cross_references: true,
  sound_grounding: true,
  craft_obsidian_export: true,
  why_this_transparency: true,
  breathing_portal: true,
  bloomscroll_quizzes: true,
  hivemind_streams: true
};

export function isFeatureEnabled(profile: UserProfile | undefined | null, id: FeatureModuleId): boolean {
  if (!profile || !profile.enabledModules) {
    return DEFAULT_ENABLED_MODULES[id] ?? true;
  }
  return profile.enabledModules[id] ?? DEFAULT_ENABLED_MODULES[id] ?? true;
}
