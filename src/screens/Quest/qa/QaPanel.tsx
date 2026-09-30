// Dev QA panel (reachable only from the __DEV__ playground). Everything here
// is in memory: a what-if overlay derives a separate game for this view only,
// and ceremonies play as previews that never touch the real marks. Nothing is
// written to any synced table (qa.test.ts checks the imports).

import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, useWindowDimensions, View } from 'react-native';

import { useSharedValue } from 'react-native-reanimated';

import { useQuestMeta } from '../../../data/itemsRepo';
import { BIOME_IDS, BiomeId } from '../../../domain/game/biomes';
import type { CeremonyEvent } from '../../../domain/game/ceremonies';
import type { SceneState } from '../../../domain/game/stage';
import { DayPhase } from '../../../domain/game/daylight';
import { gameInput } from '../../../domain/game/fromData';
import { dkey } from '../../../domain/time';
import { RANKS } from '../../../domain/game/balance';
import { isWhatIfOff, NO_WHAT_IF, WhatIf, whatIfGame } from '../../../domain/game/whatIf';
import { activeHabits } from '../../../domain/projects';
import { ceremonyHost } from '../../../game/ceremonies/host';
import { npcName } from '../../../game/content/npcs';
import { biomeMaps } from '../../../game/content/biomes';
import { BIOME_H } from '../../../game/content/biomes/layout';
import { useGameClock } from '../../../game/render/clock';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useData, useStoreNow } from '../../../store/StreakStore';
import { Onboarding } from '../ceremonies/Onboarding';
import { cameraFor, JourneyMap } from '../map/JourneyMap';
import Stage from '../session/Stage';
import { spotFor } from '../model';
import { Text } from '../../../components/Text';

const PHASES: DayPhase[] = ['dawn', 'day', 'dusk', 'night'];
const MINUTES = [10, 25, 60, 240];
const BOSS_HP = [undefined, 0.9, 0.5, 0.1] as const;
const MAP_H = 300;

export function QaPanel({ reduced }: { reduced: boolean }) {
  const data = useData();
  const now = useStoreNow();
  const meta = useQuestMeta();
  const { width } = useWindowDimensions();
  const habits = activeHabits(data).filter((h) => h.kind !== 'check');
  const [habitId, setHabitId] = useState(habits[0]?.id ?? 'qa:habit');
  const [weakPoint, setWeakPoint] = useState(false);
  const [overlay, setOverlay] = useState<WhatIf>(NO_WHAT_IF);
  const [phase, setPhase] = useState<DayPhase>('day');
  const [rank, setRank] = useState(1);
  const [bossBiome, setBossBiome] = useState<BiomeId>('forest');
  const [json, setJson] = useState(false);
  const [intro, setIntro] = useState(false);
  const [scene, setScene] = useState<SceneState>('fight');

  // A separate game for this view only; the real one (and its watcher) never sees the overlay.
  // Re-derived when the data or the overlay changes, or once a minute (not on every store tick).
  const minute = Math.floor(now / 60_000);
  const game = useMemo(() => whatIfGame(gameInput(data, minute * 60_000, undefined, dkey(new Date(minute * 60_000))), overlay), [data, minute, overlay]);
  const maps = biomeMaps();
  const at = spotFor(maps, game.journey.position.global);
  const camY = useSharedValue(cameraFor(at.y, MAP_H, width));
  const avatarX = useSharedValue(at.x);
  const avatarY = useSharedValue(at.y);
  const avatarMode = useSharedValue(0);
  const shake = useSharedValue(0);
  const dustX = useSharedValue(0);
  const dustY = useSharedValue(0);
  const dustAt = useSharedValue(-1e9);
  const clock = useGameClock(!reduced);
  const fx = useMemo(() => ({ pops: [], dust: { x: dustX, y: dustY, at: dustAt } }), [dustX, dustY, dustAt]);
  const look = { tier: game.rank.tier, gear: meta?.props.avatar.gear ?? {} };

  const add = (minutes: number) => setOverlay((o) => ({ ...o, sessions: [...o.sessions, { habitId, minutes, weakPoint }] }));
  const jump = (b: BiomeId) => {
    const m = maps[BIOME_IDS.indexOf(b)];
    camY.set(cameraFor(m.top + BIOME_H / 2, MAP_H, width));
  };
  const backToAvatar = () => {
    avatarX.set(at.x);
    avatarY.set(at.y);
    camY.set(cameraFor(at.y, MAP_H, width));
  };
  const preview = (event: CeremonyEvent) => ceremonyHost.preview(event, game);
  const summary = {
    whatIf: isWhatIfOff(overlay) ? 'off (the real game)' : overlay,
    xp: game.xp,
    rank: game.rank,
    credits: game.credits,
    journey: { ...game.journey, defeated: game.journey.defeated.map((d) => `${d.biome}:${d.loop}`) },
    chests: game.chests.unopened.length,
    skills: game.skills.map((s) => ({ habitId: s.habitId, level: s.level, retired: s.retired })),
    newAchievements: game.newAchievements,
  };

  return (
    <View style={{ gap: 12, paddingHorizontal: 12 }}>
      <Section title="What if (in memory only)">
        <Row>
          {habits.slice(0, 4).map((h) => (
            <PixelButton key={h.id} small tone={habitId === h.id ? 'gold' : 'parchment'} label={h.name.slice(0, 10)} accessibilityLabel={`Use habit ${h.name}`} onPress={() => setHabitId(h.id)} />
          ))}
          <PixelButton small tone={weakPoint ? 'gold' : 'parchment'} label="+task" accessibilityLabel={`With a completed weak point: ${weakPoint ? 'on' : 'off'}`} onPress={() => setWeakPoint(!weakPoint)} />
        </Row>
        <Row>
          {MINUTES.map((m) => (
            <PixelButton key={m} small label={`+${m}m`} accessibilityLabel={`Add a ${m} minute session`} onPress={() => add(m)} />
          ))}
        </Row>
        <Row>
          {BOSS_HP.map((f) => (
            <PixelButton key={String(f)} small tone={overlay.bossHp === f ? 'gold' : 'parchment'} label={f === undefined ? 'boss: real' : `boss ${Math.round(f * 100)}%`} accessibilityLabel={f === undefined ? 'Boss at its real HP' : `Boss at ${Math.round(f * 100)} percent HP`} onPress={() => setOverlay((o) => ({ ...o, bossHp: f }))} />
          ))}
        </Row>
        <Row>
          <PixelButton small tone="night" label="Overlay off" accessibilityLabel="Turn the what-if overlay off" onPress={() => setOverlay(NO_WHAT_IF)} />
          <PixelText size="sm" color={QUI.white}>
            {isWhatIfOff(overlay) ? 'Real game' : `${overlay.sessions.length} what-if sessions`}
          </PixelText>
        </Row>
      </Section>

      <Section title="Map">
        <Row>
          {PHASES.map((p) => (
            <PixelButton key={p} small tone={phase === p ? 'gold' : 'parchment'} label={p} accessibilityLabel={`Time of day: ${p}`} onPress={() => setPhase(p)} />
          ))}
        </Row>
        <Row>
          {BIOME_IDS.map((b) => (
            <PixelButton key={b} small label={b} accessibilityLabel={`Jump the camera to ${b}`} onPress={() => jump(b)} />
          ))}
          <PixelButton small tone="gold" label="avatar" accessibilityLabel="Jump the camera back to the avatar" onPress={backToAvatar} />
        </Row>
        <View style={{ height: MAP_H, marginHorizontal: -12, overflow: 'hidden' }}>
          <JourneyMap
            width={width}
            height={MAP_H}
            maps={maps}
            journey={game.journey}
            phase={phase}
            camY={camY}
            clock={clock}
            reduced={reduced}
            camp={{ at, fireLit: true, fireStyle: 'default', chests: game.chests.unopened.length, pet: meta?.props.companion ?? null }}
            look={look}
            avatarX={avatarX}
            avatarY={avatarY}
            avatarMode={avatarMode}
            fx={fx}
            shake={shake}
            onTap={() => {}}
            onTouch={() => {}}
          />
        </View>
      </Section>

      <Section title="Ceremonies (previews: real marks untouched)">
        <Row>
          <PixelButton small label={`LV ${game.xp.level}`} accessibilityLabel="Preview the level-up" onPress={() => preview({ id: 'qa:level', kind: 'level_up', level: game.xp.level })} />
          <PixelButton small label="Ascension" accessibilityLabel="Preview the Ascension" onPress={() => preview({ id: 'qa:asc', kind: 'ascension', loop: 1 })} />
          <PixelButton small label="Onboarding" accessibilityLabel="Preview the onboarding" onPress={() => setIntro(true)} />
        </Row>
        <Row>
          {RANKS.map((r, i) =>
            i === 0 ? null : (
              <PixelButton key={r.title} small tone={rank === i ? 'gold' : 'parchment'} label={r.title} accessibilityLabel={`Choose rank ${r.title}`} onPress={() => setRank(i)} />
            )
          )}
          <PixelButton small tone="night" label="Rank up" accessibilityLabel={`Preview the promotion to ${RANKS[rank].title}`} onPress={() => preview({ id: 'qa:rank', kind: 'rank_up', rankIndex: rank })} />
        </Row>
        <Row>
          {BIOME_IDS.map((b) => (
            <PixelButton key={b} small tone={bossBiome === b ? 'gold' : 'parchment'} label={b} accessibilityLabel={`Choose the ${b} boss`} onPress={() => setBossBiome(b)} />
          ))}
          <PixelButton small tone="night" label="Boss defeat" accessibilityLabel={`Preview the ${bossBiome} boss defeat`} onPress={() => preview({ id: 'qa:boss', kind: 'boss_defeated', biomeId: bossBiome, loop: 0 })} />
        </Row>
        <Row>
          <PixelButton small tone="night" label="Forget marks" accessibilityLabel="Clear this device's ceremony marks (they reseed silently)" onPress={() => ceremonyHost.forgetMarks()} />
        </Row>
      </Section>

      <Section title="Timer Stage">
        <Row>
          {(['fight', 'defeat', 'walkIn', 'stagger', 'nap', 'wake'] as const).map((k) => (
            <PixelButton key={k} small tone={scene === k ? 'gold' : 'parchment'} label={k} accessibilityLabel={`Show the Stage in its ${k} state`} onPress={() => setScene(k)} />
          ))}
        </Row>
        <View style={{ height: 180 }}>
          <Stage key={scene} width={width - 64} height={180} slim={false} live reduced={reduced} force={scene} />
        </View>
        <View style={{ height: 72 }}>
          <Stage width={width - 64} height={72} slim live reduced={reduced} force={scene} />
        </View>
      </Section>

      <Section title="Derived state">
        <PixelButton small label={json ? 'Hide JSON' : 'Show JSON'} accessibilityLabel="Toggle the derived state as JSON" onPress={() => setJson(!json)} />
        {json && (
          <ScrollView horizontal style={{ maxHeight: 360 }}>
            <Text selectable style={{ color: QUI.white, fontFamily: 'Courier', fontSize: 11 }}>
              {JSON.stringify(summary, null, 2)}
            </Text>
          </ScrollView>
        )}
      </Section>

      {intro && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => setIntro(false)}>
          <Onboarding game={game} look={look} sageName={npcName('sage', meta?.props.settings)} reduced={reduced} replay onBegin={() => setIntro(false)} />
        </Modal>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PixelPanel tone="night" padding={2} style={{ gap: 8 }}>
      <PixelText size="sm" bold color={QUI.goldLight}>
        {title}
      </PixelText>
      {children}
    </PixelPanel>
  );
}

const Row = ({ children }: { children: React.ReactNode }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>{children}</View>;
