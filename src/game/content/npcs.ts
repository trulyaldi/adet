// NPC display names (renamable in Quest settings) and their short lines.

import type { QuestSettings } from '../../domain/items/types';
import { NpcId, NPCS } from './roster';

export function npcName(id: NpcId, settings?: Pick<QuestSettings, 'npcNames'>): string {
  return settings?.npcNames[id]?.trim() || NPCS[id].name;
}

export function npcTitle(id: NpcId, settings?: Pick<QuestSettings, 'npcNames'>): string {
  return `${npcName(id, settings)} ${NPCS[id].title}`;
}

/** Greetings (≤12 words), one picked per visit. */
export const GREETINGS: Record<NpcId | 'board', string[]> = {
  sage: ['Hoo. Shall we look at what comes next?', 'A little planning makes the blade lighter.', 'I have thought about your path.'],
  merchant: ['Fine wares for fine travellers!', 'Credits jingling? Have a look.', 'Everything here was polished this morning.'],
  scribe: ['Your chronicle grows, page by page.', 'Every line you write, I keep.', 'Shall we read what you have done?'],
  board: ['The Quest Board. Pin what matters.'],
};

export function greeting(id: NpcId | 'board', seed: number): string {
  const g = GREETINGS[id];
  return g[Math.abs(seed) % g.length];
}
