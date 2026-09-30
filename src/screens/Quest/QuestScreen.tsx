// The Quest tab: the journey map with its HUD. On open the camera finds the
// avatar; if progress was made since the last visit, the avatar walks there
// (dust puffs, beaten mobs popping into sparkles, the camera easing along),
// in under four seconds, skippable with a tap.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, LayoutChangeEvent, Modal, Platform, View } from 'react-native';
import { cancelAnimation, Easing, makeMutable, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { NODE_MOBS } from '../../domain/game/balance';
import { mobHp, nodeAt } from '../../domain/game/derive';
import { npcName, npcTitle } from '../../game/content/npcs';
import { bossId, mobId, NpcId, ROSTER } from '../../game/content/roster';
import { bossLine } from '../../game/content/bossLines';
import { useQuestWrites } from '../../data/itemsRepo';
import { useQuestFonts } from '../../game/assets/fonts';
import { useGameClock } from '../../game/render/clock';
import { pixelScale } from '../../game/render/pixel';
import { getQuestLocal, updateQuestLocal, useQuestLocal } from '../../game/state/local';
import { useQuestReduced, useWorldRunning } from '../../game/state/settings';
import { PixelButton } from '../../game/ui/PixelButton';
import { PixelPanel } from '../../game/ui/PixelPanel';
import { PixelText } from '../../game/ui/PixelText';
import { QUI } from '../../game/ui/theme';
import { ceremonyHost } from '../../game/ceremonies/host';
import { holdCeremonies } from '../../game/ceremonies/gate';
import { preloadQuestSounds } from '../../game/audio';
import { feedback } from '../../game/feedback';
import { Onboarding } from './ceremonies/Onboarding';
import { Hud } from './Hud';
import { cameraFor, JourneyMap, MapFx } from './map/JourneyMap';
import { campLayout, hitTest, planReveal, spotFor, Target, targetAt } from './model';
import { QuestSheets, SheetId } from './sheets';
import { Panel, TapPanel } from './TapPanel';
import { useQuestModel } from './useQuestModel';
import { useActions } from '../../store/StreakStore';
import { PE } from '../../game/ui/pointer';
import { MODAL_GAP_MS } from '../../theme/motion';
import { SpriteView } from '../../game/render/SpriteView';
import { onQuestSheetRequest, takeQuestSheet } from '../../game/state/questOpen';

const POPS = 12;

export default function QuestScreen({ onPlayground }: { onPlayground?(): void }) {
  useQuestFonts();
  const m = useQuestModel();
  const reduced = useQuestReduced();
  const running = useWorldRunning();
  const clock = useGameClock(running);
  const local = useQuestLocal();
  const writes = useQuestWrites();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [sheet, setSheet] = useState<SheetId | null>(null);
  // A sheet asked for from elsewhere (the Almanac's Trail link).
  useEffect(() => {
    const take = () => {
      const id = takeQuestSheet();
      if (id) setSheet(id as SheetId);
    };
    take();
    return onQuestSheetRequest(take);
  }, []);
  const [replayIntro, setReplayIntro] = useState(false);
  // Android back during onboarding: step out of the Quest tab (nothing is written).
  const actions = useActions();
  const leaveQuest = useCallback(() => actions.setScreen('today'), [actions]);
  const bossTaps = useRef(0);
  // Ceremonies wait while a sheet, a panel or the intro replay is up.
  const busy = !!sheet || !!panel || replayIntro;
  useEffect(() => (busy ? holdCeremonies() : undefined), [busy]);
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => { preloadQuestSounds(); }, []);
  useEffect(() => {
    feedback.music.setBiome(m.game.journey.position.biome);
    return () => feedback.music.setBiome(null);
  }, [m.game.journey.position.biome, m.data.active]);
  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => sub.remove();
  }, []);

  const camY = useSharedValue(0);
  const avatarX = useSharedValue(m.at.x);
  const avatarY = useSharedValue(m.at.y);
  const avatarMode = useSharedValue(0);
  const shake = useSharedValue(0);
  const fx: MapFx = useMemo(
    () => ({
      pops: Array.from({ length: POPS }, () => ({ x: 0, y: 0, at: makeMutable(-1e9) })),
      dust: { x: makeMutable(0), y: makeMutable(0), at: makeMutable(-1e9) },
    }),
    []
  );
  const [popSpots, setPopSpots] = useState<{ x: number; y: number }[]>([]);
  const mapFx = useMemo(() => ({ ...fx, pops: fx.pops.map((p, i) => ({ ...p, x: popSpots[i]?.x ?? -99, y: popSpots[i]?.y ?? -99 })) }), [fx, popSpots]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
  };

  // ---- the reveal ----
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finish = useRef<(() => void) | null>(null);
  const skip = useCallback(() => finish.current?.(), []);
  const pos = m.game.journey.position;
  const hp = m.game.journey.hp;

  // The camera finds the avatar as soon as the map has a size.
  const placed = useRef(false);
  useEffect(() => {
    if (!size || placed.current) return;
    placed.current = true;
    camY.set(cameraFor(m.at.y, size.h, size.w));
  }, [size, m.at.y, camY]);

  useEffect(() => {
    if (!size || !local.loaded || !m.meta) return;
    const seen = getQuestLocal().seen;
    const cur = { global: pos.global, hp };
    const settle = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      finish.current = null;
      cancelAnimation(avatarX);
      cancelAnimation(avatarY);
      avatarX.set(m.at.x);
      avatarY.set(m.at.y);
      avatarMode.set(0);
      updateQuestLocal((s) => ({ ...s, seen: cur }));
      ceremonyHost.evaluate();
    };
    const plan = seen ? planReveal(m.maps, seen.global, cur.global) : null;
    if (!seen || !plan || reduced) {
      // First visit, nothing new, or reduced motion: just be there.
      camY.set(cameraFor(m.at.y, size.h, size.w));
      if (seen && cur.global === seen.global && cur.hp < seen.hp && !reduced) {
        // Same enemy, a bit weaker: a small hit where it stands.
        const n = nodeAt(pos.global);
        const node = m.maps[n.biomeIndex].nodes[n.node];
        setPopSpots([{ x: node.x, y: node.y }]);
        fx.pops[0].at.set(clock.value);
        shake.set(withSequence(withTiming(1.5, { duration: 50 }), withTiming(-1.5, { duration: 50 }), withTiming(0, { duration: 60 })));
      }
      settle();
      return;
    }
    // Walk it.
    const start = plan.points[0];
    avatarX.set(start.x);
    avatarY.set(start.y);
    camY.set(cameraFor(start.y, size.h, size.w));
    setPopSpots(plan.pops.slice(0, POPS).map((p) => ({ x: p.x, y: p.y })));
    finish.current = () => {
      settle();
      camY.set(withTiming(cameraFor(m.at.y, size.h, size.w), { duration: 250 }));
    };
    const step = plan.stepMs;
    plan.points.slice(1).forEach((pt, i) => {
      timers.current.push(
        setTimeout(() => {
          avatarMode.set(1);
          avatarX.set(withTiming(pt.x, { duration: step, easing: Easing.linear }));
          avatarY.set(withTiming(pt.y, { duration: step, easing: Easing.linear }));
          camY.set(withTiming(cameraFor(pt.y, size.h, size.w), { duration: step, easing: Easing.inOut(Easing.quad) }));
          fx.dust.x.set(plan.points[i].x);
          fx.dust.y.set(plan.points[i].y);
          fx.dust.at.set(clock.value);
          const pop = plan.pops.findIndex((p) => p.at === i);
          if (pop >= 0 && pop < POPS) fx.pops[pop].at.set(clock.value + step * 0.6);
        }, 350 + i * step)
      );
    });
    timers.current.push(setTimeout(() => finish.current?.(), 350 + (plan.points.length - 1) * step + 80));
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // Re-run when progress changes (a claimed chest, a synced session).
  }, [size, local.loaded, !!m.meta, pos.global, hp, reduced]);

  // ---- taps ----
  const scale = size ? pixelScale(size.w) : 3;
  const targets = useMemo(() => {
    const min = 44 / scale;
    const out: Target[] = [];
    const bi = pos.biomeIndex;
    for (const map of m.maps.filter((x) => Math.abs(x.index - bi) <= 1)) {
      for (const n of map.nodes) {
        if (n.kind === 'mob') out.push(targetAt('node', `${map.id}:${n.index}`, n.x, n.y, 16, 16, min, { biome: map.index, node: n.index }));
      }
      out.push(targetAt('gate', `${map.id}:gate`, map.gate.x, map.gate.y - 14, 60, 64, min, { biome: map.index }));
      map.critters.forEach((c, i) => out.push(targetAt('critter', `${map.id}:c${i}`, c.x, c.y, c.wander * 2 + 10, 10, min)));
      map.villagers.forEach((v, i) => out.push(targetAt('villager', `${map.id}:v${i}`, v.x, v.y, 14, 22, min, v.line)));
    }
    for (const c of campLayout(m.at)) {
      const kind = c.thing === 'sage' || c.thing === 'merchant' || c.thing === 'scribe' ? 'npc' : c.thing;
      if (c.thing === 'chests' && !m.chests) continue;
      if (c.thing === 'pet' && !m.pet) continue;
      out.push(targetAt(kind, c.thing, c.x, c.y, 16, 16, min));
    }
    out.push(targetAt('avatar', 'avatar', m.at.x, m.at.y, 14, 24, min));
    return out;
  }, [m.maps, m.at, m.chests, m.pet, pos.biomeIndex, scale]);

  const onTap = useCallback(
    (wx: number, wy: number, sx: number, sy: number) => {
      if (finish.current) return;
      const t = hitTest(targets, wx, wy);
      if (!t) {
        setPanel(null);
        return;
      }
      const g = m.game.journey;
      switch (t.kind) {
        case 'node': {
          const { biome, node } = t.data as { biome: number; node: number };
          const map = m.maps[biome];
          const here = biome * 8 + node;
          const cur = g.position.biomeIndex * 8 + g.position.node;
          const mob = ROSTER[map.id].mobs[Math.max(0, NODE_MOBS[node] as number)];
          const max = mobHp(biome);
          // `cur` and `here` count within this loop; `global` counts every node since the first.
          const ahead = g.softened.find((x) => x.global === g.position.global - cur + here)?.hp ?? max;
          setPanel({ kind: 'mob', sprite: here < cur ? `prop.${map.id}.grave` : `${mobId(map.id, mob.key)}.idle`, name: mob.name, hp: here < cur ? 0 : here === cur ? g.hp : ahead, max, x: sx, y: sy });
          break;
        }
        case 'gate': {
          const { biome } = t.data as { biome: number };
          const map = m.maps[biome];
          const active = biome === g.position.biomeIndex && g.position.node === 7;
          const beaten = biome < g.position.biomeIndex;
          // The boss you face speaks a pre-fight line each tap (the Hollow Echo also quotes you).
          const line = active ? bossLine(m.game, map.id, bossTaps.current++) : undefined;
          const staggered = active && g.staggered;
          const here = biome === g.position.biomeIndex;
          setPanel({ kind: 'boss', sprite: beaten ? `trophy.${map.id}` : `${bossId(map.id)}.${staggered ? 'low' : 'idle'}`, name: ROSTER[map.id].boss.name, hp: beaten ? 0 : active ? g.hp : g.bossMaxHp, max: g.bossMaxHp, active, line, seals: here ? g.seals : undefined, staggered, x: sx, y: sy });
          break;
        }
        case 'villager':
          setPanel({ kind: 'say', text: String(t.data), x: sx, y: sy });
          break;
        case 'critter':
          setPanel({ kind: 'emote', x: sx, y: sy });
          break;
        case 'npc':
          setPanel(null);
          setSheet(t.key as SheetId);
          break;
        case 'board':
          setPanel(null);
          setSheet('board');
          break;
        case 'chests':
          setPanel(null);
          setSheet('chests');
          break;
        case 'avatar':
        case 'pet':
          setPanel(null);
          setSheet('character');
          break;
        case 'fire':
          setPanel({ kind: 'say', text: m.fireLit ? 'The fire is bright. Today is done.' : 'Embers glow. A little focus rekindles them.', x: sx, y: sy });
          break;
      }
    },
    [targets, m]
  );

  const newcomer = m.game.sessions.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: QUI.night }} onLayout={onLayout}>
      {size && (
        <JourneyMap
          width={size.w}
          height={size.h}
          maps={m.maps}
          journey={m.game.journey}
          phase={m.phase}
          camY={camY}
          clock={clock}
          reduced={reduced}
          camp={{ at: m.at, fireLit: m.fireLit, fireStyle: m.fireStyle, chests: m.chests, pet: m.pet }}
          look={m.look}
          avatarX={avatarX}
          avatarY={avatarY}
          avatarMode={avatarMode}
          fx={mapFx}
          shake={shake}
          onTap={onTap}
          onTouch={skip}
        />
      )}
      <View style={{ position: 'absolute', top: 8, left: 8, right: 8 }}>
        <Hud game={m.game} look={m.look} width={size?.w ?? 360} onAvatar={() => setSheet('character')} onLongPress={__DEV__ ? onPlayground : undefined} />
      </View>
      {newcomer && !panel && (
        <View style={[PE.none, { position: 'absolute', left: 16, right: 16, bottom: 16 }]}>
          <PixelPanel tone="parchment" padding={2}>
            <PixelText size="sm">{npcName('sage', m.meta?.props.settings)}: Start a session to strike your first foe.</PixelText>
          </PixelPanel>
        </View>
      )}
      {!newcomer && !panel && (
        <View style={{ position: 'absolute', right: 12, bottom: 12 }}>
          <PixelButton small tone="parchment" icon={<SpriteView id="icon.quill" scale={2} />} accessibilityLabel="Quick log: record something you did" onPress={() => setSheet('quicklog')} />
        </View>
      )}
      {panel && size && <TapPanel panel={panel} width={size.w} onClose={() => setPanel(null)} reduced={reduced} />}
      {screenReader && Platform.OS !== 'web' && (
        <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(['sage', 'board', 'merchant', 'scribe'] as SheetId[]).map((id) => (
            <PixelButton key={id} small tone="parchment" label={id === 'board' ? 'Quest Board' : npcName(id as NpcId, m.meta?.props.settings)} accessibilityLabel={id === 'board' ? 'Quest Board' : npcTitle(id as NpcId, m.meta?.props.settings)} onPress={() => setSheet(id)} />
          ))}
          {m.chests > 0 && <PixelButton small tone="gold" label={`${m.chests}`} accessibilityLabel={`${m.chests} unopened chests`} onPress={() => setSheet('chests')} />}
          <PixelButton small tone="night" label="Enemy" accessibilityLabel={`Current enemy, ${Math.ceil(hp)} of ${m.game.journey.maxHp} health`} onPress={() => {
            const at = spotFor(m.maps, pos.global);
            onTap(at.x, at.y - 14, (size?.w ?? 0) / 2, (size?.h ?? 0) / 2);
          }} />
        </View>
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
      <QuestSheets sheet={sheet} onClose={() => setSheet(null)} onOpen={setSheet} onReplayIntro={() => {
        setSheet(null);
        setTimeout(() => setReplayIntro(true), MODAL_GAP_MS);
      }} model={m} />
    </View>
  );
}
