// The pure side of projects as realms in the app (no React, so it is tested
// under node): the silent attach by name, and the attach sheet's next question.

import type { QuestSlice } from '../domain/items/ops';
import type { Item } from '../domain/items/types';
import { worldOps } from '../domain/world';
import { projectsWithoutRealm, unlinkedRealms } from '../domain/world/rules';
import { liveWorld } from '../domain/world/select';
import { ProjectRef, projectsByAge, Realm } from '../domain/world/types';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Silent attach: a hand-claimed realm whose name equals (ignoring case and
 * extra spaces) the name of exactly one project that has no realm is linked
 * to it. A name two projects share, or that matches none, is left for the
 * attach sheet. Only sets `props.projectId`; nothing else about the realm moves.
 */
export function linkByName(q: QuestSlice, projects: readonly ProjectRef[]): QuestSlice {
  const active = projects.filter((p) => p.archivedAt == null);
  let cur = q;
  for (let guard = 0; guard < 8; guard++) {
    const w = liveWorld(cur.items, projects);
    const free = projectsWithoutRealm(w, active.map((p) => p.id));
    let next = cur;
    for (const r of unlinkedRealms(w)) {
      const hits = active.filter((p) => free.includes(p.id) && norm(p.name) === norm(r.name));
      if (hits.length === 1) {
        next = worldOps.linkRealm(cur, r.id, hits[0].id);
        if (next !== cur) break;
      }
    }
    if (next === cur) return cur;
    cur = next;
  }
  return cur;
}

export interface AttachChoice {
  realm: Realm;
  /** Active projects with no realm, oldest first. */
  candidates: ProjectRef[];
}

/** The attach sheet's next question: the lowest hand-claimed realm still unanswered, and the projects it could be. Null when there is nothing to ask. */
export function attachChoiceOf(items: readonly Item[], projects: readonly ProjectRef[]): AttachChoice | null {
  const w = liveWorld(items, projects);
  const active = projects.filter((p) => p.archivedAt == null);
  const free = new Set(projectsWithoutRealm(w, active.map((p) => p.id)));
  const candidates = projectsByAge(active.filter((p) => free.has(p.id)));
  const realm = unlinkedRealms(w).sort((a, b) => a.slot - b.slot)[0];
  return realm && candidates.length ? { realm, candidates } : null;
}
