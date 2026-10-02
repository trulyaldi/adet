// Where things stand on a realm's path (World Mode, world-3): the camp and the
// "+" at the path's start, the uncleared quests along it (8 at most, oldest
// first) and the oldest uncleared boss in the lair at the top. Cleared quests
// leave the path; they're trophies (counted here, listed in the Scribe). Pure.

import type { BossView, PathNode, RealmView } from '../../../domain/world/select';
import type { SessionTarget } from '../../../domain/world/target';
import { BIOME_IDS, BiomeId } from '../../../domain/game/biomes';
import type { StageTarget } from '../session/TimerStage';
import { alongPath, BiomeMap } from '../../../game/content/biomes/layout';
import { bossId, mobId, ROSTER } from '../../../game/content/roster';

/** Most uncleared quests shown at once (the lair included). */
export const MAX_NODES = 8;

export interface PlacedNode {
  node: PathNode;
  x: number;
  y: number;
  sprite: string;
}

export interface RealmLayout {
  camp: { x: number; y: number };
  plus: { x: number; y: number };
  nodes: PlacedNode[];
  lair: (PlacedNode & { node: BossView }) | null;
  /** Uncleared quests not shown (past the 8). */
  hidden: number;
  trophies: number;
}

const point = (path: { x: number; y: number }[], f: number) => {
  const p = alongPath(path, 2, f, f)[0];
  return { x: Math.round(p.x), y: Math.round(p.y) };
};

/** A stable mob sprite for a quest, from the realm's biome. */
export function mobSprite(biome: BiomeId, questId: string): string {
  let h = 0;
  for (let i = 0; i < questId.length; i++) h = (h * 31 + questId.charCodeAt(i)) >>> 0;
  const mobs = ROSTER[biome].mobs;
  return `${mobId(biome, mobs[h % mobs.length].key)}.idle`;
}

export function realmLayout(map: BiomeMap, view: RealmView): RealmLayout {
  const b = map.id;
  const open = view.path.filter((n) => !n.cleared);
  const lairNode = open.find((n): n is BossView => n.kind === 'boss') ?? null;
  const rest = open.filter((n) => n !== lairNode);
  const room = MAX_NODES - (lairNode ? 1 : 0);
  const shown = rest.slice(0, room);
  const from = 0.22;
  const to = 0.84;
  const nodes = shown.map((node, i) => {
    const f = shown.length === 1 ? (from + to) / 2 : from + ((to - from) * i) / (shown.length - 1);
    return { node, ...point(map.path, f), sprite: mobSprite(b, node.quest.id) };
  });
  const lair = lairNode ? { node: lairNode, x: map.gate.x, y: map.gate.y - 14, sprite: `${bossId(b)}.idle` } : null;
  return { camp: point(map.path, 0.04), plus: point(map.path, 0.13), nodes, lair, hidden: Math.max(0, rest.length - room), trophies: view.cleared };
}

/** The timer Stage's enemy for a session's target: the boss sprite for a phase of a boss, else the quest's mob from the realm's biome. */
export function stageTargetOf(t: SessionTarget): StageTarget {
  const biome = BIOME_IDS[t.realm.slot] ?? 'forest';
  const enemyId = t.boss ? bossId(biome) : mobSprite(biome, t.quest.parentQuestId ?? t.quest.id).replace(/\.idle$/, '');
  return { biome, enemyId, boss: !!t.boss, name: t.quest.title, hearts: t.hearts, phases: t.phases };
}
