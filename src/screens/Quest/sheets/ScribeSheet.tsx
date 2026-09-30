// Hatshy the Tortoise, the Scribe: the chronicle (every entry by week, with
// its habit and the enemy it helped defeat; tap to edit), the trail (is each
// skill rising?), a quick log, the chests still waiting at camp, the credits,
// and Quest settings.

import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';

import { Icon } from '../../../components/Icon';
import { useQuestWrites } from '../../../data/itemsRepo';
import { ICONS } from '../../../domain/constants';
import { NODE_MOBS } from '../../../domain/game/balance';
import { gameStateOf } from '../../../domain/game/fromData';
import { itemsOfType, LogEntryItem } from '../../../domain/items/types';
import { LOG_BODY_MAX } from '../../../domain/items/ops';
import { dkey, monday } from '../../../domain/time';
import { PACK_CREDITS, STAND_IN_SPRITES } from '../../../game/assets/credits.generated';
import { PIXEL_FONT, PIXEL_TEXT } from '../../../game/assets/fonts';
import { greeting, npcName } from '../../../game/content/npcs';
import { mobId, ROSTER } from '../../../game/content/roster';
import { openLoot } from '../../../game/state/loot';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useData } from '../../../store/StreakStore';
import { MODAL_GAP_MS } from '../../../theme/motion';
import type { QuestModel } from '../useQuestModel';
import { QuestSheet, Row } from './common';
import { QuickLog } from './QuickLog';
import { QuestSettingsPanel } from './SettingsPanel';
import { Trail } from './Trail';
import { SpriteView } from '../../../game/render/SpriteView';
import { TextInput } from '../../../components/Text';

export type ScribeTab = 'chronicle' | 'trail' | 'chests' | 'credits' | 'settings';
type Tab = ScribeTab;

export function ScribeSheet({ model, onClose, onReplayIntro, reduced, initialTab = 'chronicle', quickLog = false }: { model: QuestModel; onClose(): void; onReplayIntro(): void; reduced: boolean; initialTab?: Tab; /** Open with the quick log showing (the camp's quill). */ quickLog?: boolean }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [logging, setLogging] = useState(quickLog);
  const settings = model.meta?.props.settings;
  return (
    <QuestSheet visible title={npcName('scribe', settings)} portrait="npc.scribe" greeting={initialTab === 'chronicle' && !quickLog ? greeting('scribe', model.now >> 20) : undefined} onClose={onClose} reduced={reduced} scroll={tab !== 'chronicle'}>
      {logging ? (
        <QuickLog onDone={() => setLogging(false)} />
      ) : (
        <PixelButton small tone="parchment" icon={<SpriteView id="icon.quill" scale={2} />} label="Quick log" accessibilityLabel="Quick log: record something you did" onPress={() => setLogging(true)} style={{ alignSelf: 'flex-start' }} />
      )}
      <Row style={{ flexWrap: 'wrap', gap: 4 }}>
        {(
          [
            ['chronicle', 'Chronicle'],
            ['trail', 'Trail'],
            ['chests', `Chests${model.chests ? ` ${model.chests}` : ''}`],
            ['credits', 'Credits'],
            ['settings', 'Settings'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <PixelButton key={k} small tone={tab === k ? 'gold' : 'parchment'} label={label} accessibilityLabel={label} onPress={() => setTab(k)} />
        ))}
      </Row>
      {tab === 'chronicle' && <Chronicle model={model} />}
      {tab === 'trail' && <Trail model={model} />}
      {tab === 'chests' && <Chests model={model} onOpen={(id) => {
        onClose();
        // After this sheet has gone: iOS shows one modal at a time.
        setTimeout(() => openLoot({ sessionId: id, fresh: false }), MODAL_GAP_MS);
      }} />}
      {tab === 'credits' && <Credits />}
      {tab === 'settings' && <QuestSettingsPanel model={model} onCredits={() => setTab('credits')} onReplayIntro={onReplayIntro} />}
    </QuestSheet>
  );
}

function Chronicle({ model }: { model: QuestModel }) {
  const data = useData();
  const writes = useQuestWrites();
  const game = gameStateOf(data);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const sections = useMemo(() => {
    const bySession = new Map(game.sessions.map((r) => [r.sessionId, r]));
    const logs = itemsOfType(data.items, 'log').sort((a, b) => b.createdAt - a.createdAt);
    const weeks = new Map<string, LogEntryItem[]>();
    for (const l of logs) {
      const r = bySession.get(l.props.sessionId);
      const wk = dkey(monday(new Date(r?.start ?? l.createdAt)));
      if (!weeks.has(wk)) weeks.set(wk, []);
      weeks.get(wk)!.push(l);
    }
    return [...weeks.entries()].map(([wk, items]) => ({ title: wk, data: items }));
  }, [data.items, game.sessions]);
  const enemyOf = (sessionId: string): { sprite: string; name: string } | null => {
    const r = game.sessions.find((x) => x.sessionId === sessionId);
    const hit = r?.hits.find((h) => h.defeated) ?? r?.hits[0];
    if (!hit) return null;
    const b = hit.node.biome;
    if (hit.node.kind === 'boss') return { sprite: `trophy.${b}`, name: ROSTER[b].boss.name };
    const mob = ROSTER[b].mobs[Math.max(0, NODE_MOBS[hit.node.node] as number)];
    return { sprite: `${mobId(b, mob.key)}.idle`, name: mob.name };
  };
  if (!sections.length) {
    return (
      <PixelText size="sm" color={QUI.muted}>
        Your chronicle is empty. Open a chest and write one line.
      </PixelText>
    );
  }
  return (
    <SectionList
      sections={sections}
      keyExtractor={(l) => l.id}
      style={{ flexShrink: 1 }}
      stickySectionHeadersEnabled={false}
      initialNumToRender={12}
      keyboardShouldPersistTaps="handled"
      renderSectionHeader={({ section }) => (
        <PixelText size="sm" bold color={QUI.wood} style={{ marginTop: 8 }} accessibilityRole="header">
          Week of {new Date(section.title + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </PixelText>
      )}
      renderItem={({ item: l }) => {
        const habit = data.habits.find((h) => h.id === l.habitId);
        const enemy = enemyOf(l.props.sessionId);
        const tasks = data.links.filter((k) => k.kind === 'completed_in' && k.toId === l.props.sessionId).length;
        const text = l.body || (tasks ? `${tasks} weak point${tasks === 1 ? '' : 's'} done` : '');
        if (editing === l.id) {
          return (
            <View style={{ gap: 6, marginVertical: 4 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                autoFocus
                multiline
                maxLength={LOG_BODY_MAX}
                accessibilityLabel="Edit the entry"
                style={{ minHeight: 60, padding: 8, backgroundColor: QUI.white, color: QUI.ink, ...PIXEL_TEXT, fontFamily: PIXEL_FONT, fontSize: 16, borderWidth: 2, borderColor: QUI.ink }}
              />
              <Row>
                <PixelButton small label="Save" accessibilityLabel="Save the entry" onPress={() => {
                  writes.editLog(l.id, draft);
                  setEditing(null);
                }} />
                <PixelButton small tone="parchment" label="Cancel" accessibilityLabel="Cancel editing" onPress={() => setEditing(null)} />
              </Row>
            </View>
          );
        }
        return (
          <Pressable
            onPress={() => {
              setDraft(l.body);
              setEditing(l.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${habit?.name ?? 'Retired habit'}: ${text || 'no text'}${enemy ? `. Against ${enemy.name}` : ''}. Edit`}
            style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: QUI.parchmentDark }}
          >
            <Icon path={ICONS[habit?.icon ?? 'code'] || ICONS.code} size={18} color={habit ? QUI.wood : QUI.muted} />
            <PixelText size="md" style={{ flex: 1 }}>
              {text || '…'}
            </PixelText>
            {enemy && (
              <PixelText size="tiny" color={QUI.muted} numberOfLines={1} style={{ maxWidth: 90 }}>
                {enemy.name}
              </PixelText>
            )}
          </Pressable>
        );
      }}
    />
  );
}

function Chests({ model, onOpen }: { model: QuestModel; onOpen(sessionId: string): void }) {
  const data = useData();
  const game = gameStateOf(data);
  const list = game.chests.unopened.slice(0, 50);
  if (!list.length) {
    return (
      <PixelText size="sm" color={QUI.muted}>
        No chests waiting. Every session of 10+ minutes brings one.
      </PixelText>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      {list.map((c) => {
        const h = data.habits.find((x) => x.id === c.habitId);
        const when = new Date(c.end).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        return (
          <PixelPanel key={c.sessionId} tone="parchment" padding={1}>
            <Row>
              <Icon path={ICONS[h?.icon ?? 'code'] || ICONS.code} size={18} color={QUI.wood} />
              <View style={{ flex: 1 }}>
                <PixelText size="md" numberOfLines={1}>
                  {h?.name ?? 'Retired habit'}
                </PixelText>
                <PixelText size="tiny" color={QUI.muted}>
                  {when} · {Math.round(c.effMin)} min
                </PixelText>
              </View>
              <PixelButton small label="Open" accessibilityLabel={`Open the chest from ${h?.name ?? 'a retired habit'}, ${when}`} onPress={() => onOpen(c.sessionId)} />
            </Row>
          </PixelPanel>
        );
      })}
      {model.chests > list.length && (
        <PixelText size="tiny" color={QUI.muted}>
          …and {model.chests - list.length} more. They never expire.
        </PixelText>
      )}
    </View>
  );
}

function Credits() {
  // From the pack registry (scripts/credits.ts): every pack in use, with its author and license.
  const rows = [
    ...PACK_CREDITS.map((p) => [p.title, `${p.author} · ${p.license} · ${p.uses}`]),
    ['Original art', STAND_IN_SPRITES ? `${STAND_IN_SPRITES} sprites are Adet's own pixel art, drawn in code.` : "None: every sprite is from a pack above."],
    ['Fonts', 'Tiny5 by the Tiny5 Project Authors (SIL OFL 1.1).'],
    ['Names', 'Aqyl, Saudager and Hatshy nod to Kazakh: wisdom, merchant, scribe.'],
  ];
  return (
    <View style={{ gap: 8 }}>
      {rows.map(([k, v]) => (
        <View key={k}>
          <PixelText size="sm" bold color={QUI.wood}>
            {k}
          </PixelText>
          <PixelText size="sm">{v}</PixelText>
        </View>
      ))}
    </View>
  );
}
