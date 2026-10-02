// The focus screen with Quest Mode on (the pixel redesign): one scene, one
// clock, one progress signal. Four zones, top to bottom: a slim header, the
// clock plate, the Stage (the world as the clock, your character and the
// enemy) and the controls. With Quest Mode off, FocusView keeps its ring.

import React, { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../../components/Button';
import { Character } from '../../../components/character/Character';
import { IconButton } from '../../../components/Glyph';
import { Icon } from '../../../components/Icon';
import { Text } from '../../../components/Text';
import { MessageToast } from '../../../components/UndoToast';
import { useQuestStarted } from '../../../data/itemsRepo';
import { focusLayout, resolveTimerSkin, skinProgress } from '../../../domain/game/timerSkin';
import { ICONS } from '../../../domain/constants';
import { projectLook } from '../../../domain/look';
import { loadStage } from '../../../game/render/screens';
import { SkiaGate } from '../../../game/render/SkiaGate';
import { useQuestReduced, useQuestSettings } from '../../../game/state/settings';
import { DimOverlay, useFocusShell } from '../../../overlays/focusShell';
import { useDevicePrefs } from '../../../store/devicePrefs';
import { useActions, useData, useUi } from '../../../store/StreakStore';
import { TIMER_FRAME_MS, useActiveProgress } from '../../../store/useActiveProgress';
import { useQuestTables } from '../../../sync/questTables';
import { useTheme } from '../../../theme/ThemeProvider';
import { useAppActive } from '../../../theme/useMotion';
import { ClockPlate } from './ClockPlate';
import { WeakPointsChip, WeakPointsList } from './WeakPointsRow';

/** Done: the victory pose plays this long before the session saves (and the chest opens). */
const VICTORY_MS = 800;

export function QuestFocusContent() {
  const t = useTheme();
  const { colors, radius } = t;
  const data = useData();
  const targetHits = useUi((u) => u.targetHits);
  const actions = useActions();
  const { prefs, setPrefs } = useDevicePrefs();
  const reduced = useQuestReduced();
  const appActive = useAppActive();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { swipe, sheetStyle, dimOffer, dimmed, setDimmed, finish } = useFocusShell();
  // The screen refreshes slowly; the plate ticks on its own and the Stage on its own clock.
  const p = useActiveProgress(TIMER_FRAME_MS);
  const started = useQuestStarted();
  const tables = useQuestTables();
  const { battleStrip } = useQuestSettings();
  const [weakOpen, setWeakOpen] = useState(false);
  const [victory, setVictory] = useState(false);

  const habit = data.habits.find((h) => h.id === p?.habitId);
  if (!p || !habit) return null;
  const project = data.projects.find((x) => x.id === habit.projectId);
  const sw = t.swatch(projectLook(project ?? { id: habit.projectId }).color);
  const l = focusLayout(height, insets.top, insets.bottom);
  // The skin chosen in Settings, else the project's old focus scene mapped (read only).
  const skin = resolveTimerSkin(prefs.timerSkin, project?.scene);
  const { progress, past } = skinProgress(p.sec, p.targetSec, reduced);
  const battle = started && tables === 'available' && battleStrip;
  const stageW = width - 32;
  // Without Skia (still loading on web, or a failed draw): your character alone; the plate still shows the target.
  const portrait = (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 16, borderRadius: 8, backgroundColor: sw.light }}>
      <Character mood={p.paused ? 'sleepy' : 'focused'} size={96} />
    </View>
  );

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View style={[{ flex: 1, backgroundColor: colors.bg }, sheetStyle]}>
        {/* 1. Header: what's running; weak points, dim, sound, minimize. */}
        <View style={{ position: 'absolute', top: l.headerTop, left: 16, right: 16, height: l.headerH, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 5 }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
            <Icon path={ICONS[habit.icon] || ICONS.code} size={22} color={sw.on} />
          </View>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 17, fontWeight: '800', color: colors.ink }}>
            {habit.name}
          </Text>
          <WeakPointsChip habitId={habit.id} open={weakOpen} onToggle={() => setWeakOpen(!weakOpen)} />
          {dimOffer && <IconButton label="Dim the screen" name="dim" size={20} color={colors.sub} bg={colors.card} diameter={40} onPress={() => setDimmed(true)} tipBelow />}
          <IconButton
            label={prefs.sound ? 'Sounds off' : 'Sounds on'}
            name={prefs.sound ? 'soundOn' : 'soundOff'}
            size={20}
            color={colors.sub}
            bg={colors.card}
            diameter={40}
            selected={prefs.sound}
            onPress={() => setPrefs({ sound: !prefs.sound })}
            tipBelow
          />
          <IconButton label="Minimize" name="chevronDown" size={22} color={colors.sub} bg={colors.card} diameter={40} onPress={actions.closeTimer} tipBelow />
        </View>
        {weakOpen && (
          <View style={{ position: 'absolute', top: l.headerTop + l.headerH + 6, left: 16, right: 16, zIndex: 6 }}>
            <WeakPointsList habitId={habit.id} />
          </View>
        )}

        {/* 2. The clock plate. */}
        <View style={{ position: 'absolute', top: l.plateTop, left: 16, right: 16, alignItems: 'center' }}>
          <ClockPlate digits={l.digits} />
        </View>

        {/* 3. The Stage: the world is the clock. */}
        <View style={{ position: 'absolute', top: l.stageTop, left: 16, width: stageW, height: l.stageH }}>
          <SkiaGate
            load={loadStage}
            props={{ width: stageW, height: l.stageH, skin, progress, past, sessionSec: p.sessionSec, paused: p.paused, reduced, live: appActive && !dimmed, battle, payoff: targetHits, victory }}
            fallback={portrait}
            errorFallback={portrait}
          />
        </View>

        <View style={{ position: 'absolute', left: 16, right: 16, bottom: height - l.controlsTop + 8, alignItems: 'center' }}>
          <MessageToast />
        </View>

        {/* 4. Controls: Pause is secondary, Done the primary. */}
        <View style={{ position: 'absolute', left: 16, right: 16, top: l.controlsTop, height: l.controlsH, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Button variant="secondary" icon={p.paused ? 'play' : 'pause'} label={p.paused ? 'Resume' : 'Pause'} onPress={actions.togglePause} style={{ flex: 1 }} />
          <Button
            icon="done"
            label="Done"
            swatch={sw}
            quiet
            style={{ flex: 1 }}
            onPress={() =>
              finish(reduced ? 0 : VICTORY_MS, () => {
                setVictory(true);
                // A long-session question may be cancelled: back to the fight.
                setTimeout(() => setVictory(false), VICTORY_MS + 800);
              })
            }
          />
        </View>

        {dimmed && <DimOverlay onUndim={() => setDimmed(false)} />}
      </Animated.View>
    </GestureDetector>
  );
}
