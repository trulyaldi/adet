// The hand-off after a session (world-4): a quest session asks for its result
// first and the chest follows; a free session goes straight to its chest, as
// before. Ceremonies are held the whole way, so a boss can't fall on screen
// and then be undone.
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import type { SessionTarget } from '../../domain/world/target';
import { ceremoniesHeld } from '../ceremonies/gate';
import { closeLoot, handOffAfterStop, isLootOpen, openLoot } from './loot';
import { closeResult, isResultOpen, openResult } from './result';

const GAP = 450;
const target = { quest: { id: 'm', realmId: 'realm:0', title: 'Normalize', createdAt: 0 }, realm: { id: 'realm:0', slot: 0, name: 'Db', icon: 'code' }, boss: null, hearts: 3, phases: null } as SessionTarget;

test('a free session: no result sheet, the chest opens as before', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    handOffAfterStop('s1', GAP);
    assert.equal(ceremoniesHeld(), true);
    mock.timers.tick(GAP);
    assert.equal(isResultOpen(), false);
    assert.equal(isLootOpen(), true);
    assert.equal(ceremoniesHeld(), false);
    closeLoot();
  } finally {
    mock.timers.reset();
  }
});

test('a quest session: the result sheet first, then its chest; ceremonies held throughout', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let evaluated = 0;
    const next = (lootFor: string | null) => (lootFor ? openLoot({ sessionId: lootFor, fresh: true }) : evaluated++);
    handOffAfterStop('s1', GAP, (lootFor) => openResult({ sessionId: 's1', target, lootFor }));
    mock.timers.tick(GAP);
    assert.equal(isResultOpen(), true);
    assert.equal(isLootOpen(), false);
    assert.equal(ceremoniesHeld(), true, 'held while the sheet (and its undo) is up');
    closeResult(GAP, next);
    assert.equal(isResultOpen(), false);
    assert.equal(ceremoniesHeld(), true, 'held while it animates out');
    mock.timers.tick(GAP);
    assert.equal(isLootOpen(), true);
    assert.equal(ceremoniesHeld(), false);
    assert.equal(evaluated, 0, 'the chest evaluates when it closes');
    closeLoot();
  } finally {
    mock.timers.reset();
  }
});

test('a short quest session: the sheet, no chest; the host looks after it', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    let evaluated = 0;
    const next = (lootFor: string | null) => (lootFor ? openLoot({ sessionId: lootFor, fresh: true }) : evaluated++);
    handOffAfterStop(null, GAP, (lootFor) => openResult({ sessionId: 's2', target, lootFor }));
    mock.timers.tick(GAP);
    closeResult(GAP, next);
    mock.timers.tick(GAP);
    assert.equal(isLootOpen(), false);
    assert.equal(evaluated, 1);
    assert.equal(ceremoniesHeld(), false);
  } finally {
    mock.timers.reset();
  }
});
