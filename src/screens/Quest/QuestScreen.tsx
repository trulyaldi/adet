// The Quest tab: the Overworld (world-5) and, opened from it, the Realm
// screen (world-3). The Overworld shows the 7 slots; tap a realm and the hero
// walks there, then its Realm opens; Back returns to the map. One realm's path in
// its slot's biome: the uncleared quests along it, the oldest uncleared boss
// in the lair at the top, the camp (Sage, Merchant, Scribe) and a "+" at the
// path's start. Tap a quest for its sheet (Start, Mark done, edit, phases,
// delete); tap "+" to name a new one. The legacy linear journey isn't shown
// or converted; its chronicle stays in the Scribe and the HUD keeps level and
// credits.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, LayoutChangeEvent, Modal, Platform, StyleSheet, View } from 'react-native';
import { makeMutable, useSharedValue } from 'react-native-reanimated';

import { Glyph } from '../../components/Glyph';
import { TextInput } from '../../components/Text';
import { useQuestWrites } from '../../data/itemsRepo';
import { useAttachChoice } from '../../data/projectRealms';
import { useRealmView, useSlots, useWorldWrites } from '../../data/worldRepo';
import { PROJECT_REALMS } from '../../game/enabled';
import { RESULT_UNDO_MS } from '../../domain/game/balance';
import { BIOME_IDS } from '../../domain/game/biomes';
import { QUEST_TITLE_MAX } from '../../domain/world/types';
import { PIXEL_FONT, PIXEL_TEXT, useQuestFonts } from '../../game/assets/fonts';
import { preloadQuestSounds } from '../../game/audio';
import { holdCeremonies } from '../../game/ceremonies/gate';
import { ceremonyHost } from '../../game/ceremonies/host';
import { npcName, npcTitle } from '../../game/content/npcs';
import { NpcId } from '../../game/content/roster';
import { feedback } from '../../game/feedback';
import { useGameClock } from '../../game/render/clock';
import { pixelScale } from '../../game/render/pixel';
import { SpriteView } from '../../game/render/SpriteView';
import { setCurrentSlot, useQuestLocal } from '../../game/state/local';
import { onQuestSheetRequest, takeQuestSheet } from '../../game/state/questOpen';
import { useQuestReduced, useWorldRunning } from '../../game/state/settings';
import { attachWasClosed, closeAttach } from '../../game/state/attachAsked';
import { setTimerQuest } from '../../game/state/timerQuest';
import { PixelButton } from '../../game/ui/PixelButton';
import { PixelPanel } from '../../game/ui/PixelPanel';
import { PixelText } from '../../game/ui/PixelText';
import { PE } from '../../game/ui/pointer';
import { QUI } from '../../game/ui/theme';
import { useActions, useSyncStatus } from '../../store/StreakStore';
import { MODAL_GAP_MS } from '../../theme/motion';
import { Onboarding } from './ceremonies/Onboarding';
import { Hud } from './Hud';
import { campLayout, hitTest, Target, targetAt } from './model';
import { QuestNodeSheet } from './realm/QuestNodeSheet';
import { RealmMap, realmCamera, realmCameraFor } from './realm/RealmMap';
import { realmLayout } from './realm/realmModel';
import { AttachSheet } from './overworld/AttachSheet';
import { ClaimSheet } from './overworld/ClaimSheet';
import { CloudCurtain } from './overworld/CloudCurtain';
import { Overworld } from './overworld/Overworld';
import { newlyConquered } from './overworld/flagMemory';
import { currentSlot } from './overworld/overworldModel';
import { useRealmTransition } from './overworld/useRealmTransition';
import { QuestSheets, SheetId } from './sheets';
import { Panel, TapPanel } from './TapPanel';
import { useQuestModel } from './useQuestModel';

export default function QuestScreen({ onPlayground }: { onPlayground?(): void }) {
  useQuestFonts();
  const m = useQuestModel();
  const reduced = useQuestReduced();
  const running = useWorldRunning();
  const clock = useGameClock(running);
  const local = useQuestLocal();
  const writes = useQuestWrites();
  const world = useWorldWrites();
  const actions = useActions();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [undo, setUndo] = useState<{ resultId: string; title: string } | null>(null);
  const [replayIntro, setReplayIntro] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  // The Overworld is the root; a realm opens from it. Where the hero stands is kept on this device.
  const slots = useSlots();
  const current = currentSlot(slots, local.slot);
  const [open, setOpen] = useState<number | null>(null);
  const [claim, setClaim] = useState<{ slot: number; rename?: string } | null>(null);
  // Projects as realms: a hand-claimed realm asks once which project it is. Closing the sheet
  // answers nothing; it asks again on the next launch.
  const attach = useAttachChoice();
  const [attachClosed, setAttachClosed] = useState(attachWasClosed);
  // Clouds close over the map as it zooms toward the slot, and part on the realm (world-6).
  // While they move both screens stay mounted: the realm under, the map fading over it.
  const { t: zoomT, moving, run } = useRealmTransition(reduced);
  const shown = open ?? (moving?.dir === 'out' ? moving.slot : null);
  const realm = shown !== null ? slots[shown]?.realm ?? null : null;
  const inRealm = open !== null && !moving;
  const openRealm = useCallback(
    (slot: number) => {
      setOpen(slot);
      // The hero moves there once the map has gone (a claimed slot is a jump).
      run('in', slot, () => setCurrentSlot(slot));
    },
    [run]
  );
  // A claimed slot's clouds lift first, then the zoom.
  const [lift, setLift] = useState<number | null>(null);
  const onLifted = useCallback(
    (slot: number) => {
      setLift(null);
      openRealm(slot);
    },
    [openRealm]
  );
  // A realm conquered since the map was last seen: its flag rises there (world-6).
  const conquered = slots.flatMap((s) => (s.conquered && s.realm ? [s.realm.id] : [])).join(',');
  const [raise, setRaise] = useState<string[]>([]);
  // Seeded once sync has settled, so realms pulled onto a new device don't all raise their flags.
  const { settled } = useSyncStatus();
  useEffect(() => {
    if (!local.loaded || !settled) return;
    const fresh = newlyConquered(conquered ? conquered.split(',') : []);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fresh.length) setRaise((r) => [...r, ...fresh]);
  }, [conquered, local.loaded, settled]);
  const onRaised = useCallback(() => setRaise([]), []);
  const closeRealm = useCallback(() => {
    if (open === null || moving) return;
    setOpen(null);
    setNodeId(null);
    setAdding(false);
    setPanel(null);
    run('out', open);
  }, [open, moving, run]);
  useEffect(() => {
    if (open === null && !moving) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeRealm();
      return true;
    });
    return () => sub.remove();
  }, [open, moving, closeRealm]);
  const view = useRealmView(realm?.id ?? null);
  const map = m.maps[realm?.slot ?? 0];
  const layout = useMemo(() => (view ? realmLayout(map, view) : null), [map, view]);

  // A sheet asked for from elsewhere (the Almanac's Trail link).
  useEffect(() => {
    const take = () => {
      const id = takeQuestSheet();
      if (id) setSheet(id as SheetId);
    };
    take();
    return onQuestSheetRequest(take);
  }, []);
  const leaveQuest = useCallback(() => actions.setScreen('today'), [actions]);
  // Ceremonies wait while a sheet, a panel or the intro replay is up.
  const busy = !!sheet || !!panel || !!nodeId || adding || replayIntro || !!claim || !!moving || lift !== null;
  useEffect(() => (busy ? holdCeremonies() : undefined), [busy]);
  useEffect(() => { preloadQuestSounds(); }, []);
  useEffect(() => {
    feedback.music.setBiome(BIOME_IDS[realm?.slot ?? current ?? 0]);
    return () => feedback.music.setBiome(null);
  }, [realm?.slot, current]);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!undo) return;
    // A boss can't fall on screen and then be undone: ceremonies wait out the undo window.
    const release = holdCeremonies();
    const t = setTimeout(() => setUndo(null), RESULT_UNDO_MS);
    return () => {
      clearTimeout(t);
      release();
      ceremonyHost.evaluate();
    };
  }, [undo]);
  // Evaluate ceremonies once the screen settles (as the reveal used to).
  useEffect(() => {
    if (local.loaded && m.meta) ceremonyHost.evaluate();
  }, [local.loaded, m.meta]);

  const camY = useSharedValue(0);
  const avatarX = useSharedValue(0);
  const avatarY = useSharedValue(0);
  const avatarMode = useSharedValue(0);
  const pop = useMemo(() => ({ at: makeMutable(-1e9) }), []);
  const [popAt, setPopAt] = useState({ x: -99, y: -99 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
  };
  // The camera starts at the camp; the avatar stands there.
  const placedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!size || !layout) return;
    avatarX.set(layout.camp.x);
    avatarY.set(layout.camp.y);
    const key = `${map.id}:${size.w}x${size.h}`;
    if (placedFor.current === key) return;
    placedFor.current = key;
    camY.set(realmCameraFor(map, layout.camp.y, size.w, size.h));
  }, [size, layout, map, camY, avatarX, avatarY]);

  // ---- taps ----
  const scale = size ? realmCamera(map, size.w, size.h).scale : 3;
  const targets = useMemo(() => {
    if (!layout) return [];
    const min = 44 / scale;
    const out: Target[] = [];
    for (const n of layout.nodes) out.push(targetAt('node', n.node.quest.id, n.x, n.y, 16, 16, min));
    if (layout.lair) out.push(targetAt('gate', layout.lair.node.quest.id, layout.lair.x, layout.lair.y, 60, 64, min));
    out.push(targetAt('plus', 'plus', layout.plus.x, layout.plus.y + 7, 14, 14, min));
    map.critters.forEach((c, i) => out.push(targetAt('critter', `c${i}`, c.x, c.y, c.wander * 2 + 10, 10, min)));
    for (const c of campLayout(layout.camp)) {
      const kind = c.thing === 'sage' || c.thing === 'merchant' || c.thing === 'scribe' ? 'npc' : c.thing;
      if (c.thing === 'chests' && !m.chests) continue;
      if (c.thing === 'pet' && !m.pet) continue;
      out.push(targetAt(kind, c.thing, c.x, c.y, 16, 16, min));
    }
    out.push(targetAt('avatar', 'avatar', layout.camp.x, layout.camp.y, 14, 24, min));
    return out;
  }, [layout, map, m.chests, m.pet, scale]);

  const onTap = useCallback(
    (wx: number, wy: number, sx: number, sy: number) => {
      const t = hitTest(targets, wx, wy);
      setPanel(null);
      if (!t) return;
      switch (t.kind) {
        case 'node':
        case 'gate':
          setNodeId(t.key);
          break;
        case 'plus':
          setTitle('');
          setAdding(true);
          break;
        case 'critter':
          setPanel({ kind: 'emote', x: sx, y: sy });
          break;
        case 'npc':
          setSheet(t.key as SheetId);
          break;
        case 'chests':
          setSheet('chests');
          break;
        case 'avatar':
        case 'pet':
          setSheet('character');
          break;
        case 'fire':
          setPanel({ kind: 'say', text: m.fireLit ? 'The fire is bright. Today is done.' : 'Embers glow. A little focus rekindles them.', x: sx, y: sy });
          break;
      }
    },
    [targets, m.fireLit]
  );

  const nodeFull = (view && nodeId && view.path.find((n) => n.quest.id === nodeId)) || null;
  const spotOf = (questId: string) => {
    const n = layout?.nodes.find((x) => x.node.quest.id === questId || x.node.phases.some((p) => p.quest.id === questId));
    if (n) return n;
    return layout?.lair ?? layout?.plus ?? { x: -99, y: -99 };
  };
  const markDone = (questId: string, label: string) => {
    const id = world.markDone(questId);
    if (!id) return;
    const at = spotOf(questId);
    setPopAt({ x: at.x, y: at.y });
    pop.at.set(clock.value);
    feedback.sfx('hit', 'loot');
    setUndo({ resultId: id, title: label });
  };
  const addQuest = () => {
    if (!realm || !title.trim()) return;
    world.addQuest(realm.id, title);
    setTitle('');
    setAdding(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: QUI.night }} onLayout={onLayout}>
      {size && layout && view && (
        <RealmMap
          width={size.w}
          height={size.h}
          map={map}
          below={m.maps[(realm?.slot ?? 0) - 1]}
          above={m.maps[(realm?.slot ?? 0) + 1]}
          layout={layout}
          conquered={view.conquered}
          empty={view.empty}
          phase={m.phase}
          camY={camY}
          clock={clock}
          reduced={reduced}
          camp={{ fireLit: m.fireLit, fireStyle: m.fireStyle, chests: m.chests, pet: m.pet }}
          look={m.look}
          avatarX={avatarX}
          avatarY={avatarY}
          avatarMode={avatarMode}
          pop={{ ...popAt, at: pop.at }}
          onTap={onTap}
        />
      )}
      {/* Only once this device's state has loaded, so the map opens on the hero's realm. */}
      {size && (open === null || moving) && local.loaded && (
        <Overworld
          width={size.w}
          height={size.h}
          slots={slots}
          current={current}
          look={m.look}
          clock={clock}
          reduced={reduced}
          onOpen={openRealm}
          onClaim={(slot) => setClaim({ slot })}
          claimable={!PROJECT_REALMS}
          onRename={(slot) => {
            const r = slots[slot].realm;
            // A project's realm is renamed in its project; a hand-claimed one still renames here.
            if (PROJECT_REALMS && r?.projectId) actions.openEditProject(r.projectId);
            else setClaim({ slot, rename: r?.name ?? '' });
          }}
          zoom={zoomT}
          focus={moving?.slot ?? current}
          lift={lift}
          onLifted={onLifted}
          raise={raise}
          onRaised={onRaised}
        />
      )}
      {moving && size && !reduced && <CloudCurtain t={zoomT} width={size.w} height={size.h} scale={pixelScale(size.w)} biome={BIOME_IDS[moving.slot]} />}
      {/* Nothing under the clouds takes a tap while they move. */}
      {(moving || lift !== null) && <View style={StyleSheet.absoluteFill} onStartShouldSetResponder={() => true} />}
      <View style={{ position: 'absolute', top: 8, left: 8, right: 8 }}>
        <Hud game={m.game} look={m.look} width={size?.w ?? 360} onAvatar={() => setSheet('character')} onLongPress={__DEV__ ? onPlayground : undefined} />
      </View>

      {/* An empty realm: only the pulsing "+" on the map, and this line. */}
      {inRealm && view?.empty && !adding && !panel && (
        <View style={[PE.none, { position: 'absolute', left: 16, right: 16, top: 84, alignItems: 'center' }]}>
          <PixelPanel tone="parchment" padding={2}>
            <PixelText size="md">What do you want to beat?</PixelText>
          </PixelPanel>
        </View>
      )}
      {inRealm && !adding && !panel && !undo && !(screenReader && Platform.OS !== 'web') && (
        <View style={{ position: 'absolute', left: 12, bottom: 12 }}>
          <PixelButton small tone="parchment" icon={<Glyph name="chevronLeft" size={20} color={QUI.ink} />} accessibilityLabel="Back to the map" onPress={closeRealm} />
        </View>
      )}
      {inRealm && !view?.empty && !adding && !panel && !undo && (
        <View style={{ position: 'absolute', right: 12, bottom: 12 }}>
          <PixelButton small tone="parchment" icon={<SpriteView id="icon.quill" scale={2} />} accessibilityLabel="Quick log: record something you did" onPress={() => setSheet('quicklog')} />
        </View>
      )}
      {undo && !adding && (
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12, alignItems: 'center' }}>
          <PixelPanel tone="parchment" padding={2}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <PixelText size="sm" numberOfLines={1} style={{ maxWidth: 200 }}>{undo.title}: cleared</PixelText>
              <PixelButton small tone="parchment" label="Undo" accessibilityLabel={`Undo: ${undo.title} is not done`} onPress={() => {
                world.undoResult(undo.resultId);
                setUndo(null);
              }} />
            </View>
          </PixelPanel>
        </View>
      )}

      {/* Add a quest: one field; Enter makes a mob. */}
      {adding && (
        <View style={{ position: 'absolute', left: 12, right: 12, bottom: 12 }}>
          <PixelPanel tone="parchment" padding={2}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              autoFocus
              maxLength={QUEST_TITLE_MAX}
              returnKeyType="done"
              onSubmitEditing={addQuest}
              onBlur={() => !title.trim() && setAdding(false)}
              placeholder="What do you want to beat?"
              placeholderTextColor={QUI.muted}
              accessibilityLabel="A new quest: what do you want to beat?"
              style={{ minHeight: 44, paddingHorizontal: 10, backgroundColor: QUI.white, color: QUI.ink, ...PIXEL_TEXT, fontFamily: PIXEL_FONT, fontSize: 16, borderWidth: 2, borderColor: QUI.ink }}
            />
          </PixelPanel>
        </View>
      )}

      {panel && size && <TapPanel panel={panel} width={size.w} onClose={() => setPanel(null)} reduced={reduced} />}
      {inRealm && screenReader && Platform.OS !== 'web' && (
        <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <PixelButton small tone="parchment" label="‹" accessibilityLabel="Back to the map" onPress={closeRealm} />
          <PixelButton small tone="gold" label="+" accessibilityLabel="Add a quest" onPress={() => setAdding(true)} />
          {layout?.lair && <PixelButton small tone="night" label="Boss" accessibilityLabel={`Boss: ${layout.lair.node.quest.title}`} onPress={() => setNodeId(layout.lair!.node.quest.id)} />}
          {layout?.nodes.map((n) => (
            <PixelButton key={n.node.quest.id} small tone="parchment" label={n.node.quest.title.slice(0, 12)} accessibilityLabel={`Quest: ${n.node.quest.title}, ${n.node.hearts} hearts`} onPress={() => setNodeId(n.node.quest.id)} />
          ))}
          {(['sage', 'merchant', 'scribe'] as SheetId[]).map((id) => (
            <PixelButton key={id} small tone="parchment" label={npcName(id as NpcId, m.meta?.props.settings)} accessibilityLabel={npcTitle(id as NpcId, m.meta?.props.settings)} onPress={() => setSheet(id)} />
          ))}
          {m.chests > 0 && <PixelButton small tone="gold" label={`${m.chests}`} accessibilityLabel={`${m.chests} unopened chests`} onPress={() => setSheet('chests')} />}
        </View>
      )}

      {nodeFull && (
        <QuestNodeSheet
          node={nodeFull}
          reduced={reduced}
          onClose={() => setNodeId(null)}
          onStart={(questId) => {
            // The timer takes the quest as a param only (it targets quests in world-4).
            setTimerQuest(questId);
            setNodeId(null);
            setTimeout(() => actions.openStartSheet(), MODAL_GAP_MS);
          }}
          onMarkDone={(questId) => {
            const phase = nodeFull.phases.find((p) => p.quest.id === questId);
            const isPhase = !!phase;
            markDone(questId, phase?.quest.title ?? nodeFull.quest.title);
            if (!isPhase) setNodeId(null);
          }}
          onRename={(questId, t) => world.renameQuest(questId, t)}
          onAddPhase={(questId, t) => world.addPhase(questId, t)}
          onDelete={(questId) => {
            world.softDeleteQuest(questId);
            setNodeId(null);
          }}
        />
      )}

      {!m.meta && local.loaded && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={leaveQuest}>
          <Onboarding
            game={m.game}
            look={m.look}
            sageName={npcName('sage')}
            reduced={reduced}
            onBegin={() => {
              ceremonyHost.seed(m.game);
              writes.startQuest();
            }}
          />
        </Modal>
      )}
      {m.meta && replayIntro && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setReplayIntro(false)}>
          <Onboarding game={m.game} look={m.look} sageName={npcName('sage', m.meta.props.settings)} reduced={reduced} replay onBegin={() => setReplayIntro(false)} />
        </Modal>
      )}
      {attach && !attachClosed && open === null && !moving && lift === null && !claim && sheet === null && local.loaded && (
        <AttachSheet
          key={attach.realm.id}
          realm={attach.realm}
          candidates={attach.candidates}
          reduced={reduced}
          onPick={(projectId) => world.linkRealm(attach.realm.id, projectId)}
          onSkip={() => world.keepRealm(attach.realm.id)}
          onClose={() => {
            closeAttach();
            setAttachClosed(true);
          }}
        />
      )}
      {claim && (
        <ClaimSheet
          rename={claim.rename}
          reduced={reduced}
          onClose={() => setClaim(null)}
          onDone={(name, icon) => {
            const r = slots[claim.slot].realm;
            if (claim.rename !== undefined && r) {
              world.renameRealm(r.id, name);
              setClaim(null);
              return;
            }
            const claimed = world.claimSlot(claim.slot, name, icon);
            setClaim(null);
            // Taken on another device meanwhile: the map shows whose it is.
            if (!claimed) return;
            // Its clouds lift, then the new realm opens.
            setLift(claim.slot);
          }}
        />
      )}
      <QuestSheets sheet={sheet} onClose={() => setSheet(null)} onOpen={setSheet} onReplayIntro={() => {
        setSheet(null);
        setTimeout(() => setReplayIntro(true), MODAL_GAP_MS);
      }} model={m} />
    </View>
  );
}
