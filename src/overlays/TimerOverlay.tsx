import React from 'react';
import { Modal, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Glyph, IconButton } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { MessageToast } from '../components/UndoToast';
import { selectTimer } from '../domain/engine';
import { fmtClock } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { useStopTimer } from '../store/useStopTimer';
import { colors, radius } from '../theme/tokens';

const R = 124;
const CIRC = 2 * Math.PI * R;
const DONE_GREEN = '#1F8A3B';

export function TimerOverlay() {
  const { data, ui, now, config, actions } = useStreak();
  const goal = ui.timerGoal && data.active && ui.timerGoal.habitId === data.active.habitId ? ui.timerGoal.min : undefined;
  const model = selectTimer(data, config, now, goal);
  const open = ui.timerOpen && !!model;

  const stop = useStopTimer();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={open} animationType="fade" transparent={false} onRequestClose={actions.closeTimer}>
      {model && (
        <View style={{ flex: 1, backgroundColor: colors.screen, paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 24) + 16 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: radius.md,
                  backgroundColor: model.tile,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon path={model.iconPath} size={22} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.ink }}>
                {model.name}
              </Text>
            </View>
            <IconButton label="Hide timer" name="chevronDown" size={20} color={colors.subtext} bg={colors.card} diameter={36} onPress={actions.closeTimer} />
          </View>

          {/* Ring toward the chosen length, clock inside */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={280} height={280} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={140} cy={140} r={R} fill="none" stroke="rgba(23,24,26,0.07)" strokeWidth={12} />
                <Circle
                  cx={140}
                  cy={140}
                  r={R}
                  fill="none"
                  stroke={model.reached ? DONE_GREEN : model.ringColor}
                  strokeWidth={12}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - model.ringProgress)}
                />
              </Svg>
              {/* Goal: its circle glyph and minutes; a check once today's time reaches it. */}
              <View
                accessible
                accessibilityLabel={
                  model.reached
                    ? 'Done for today'
                    : `${model.goalIsMin ? 'Minimum' : 'Full'} session, ${model.goalMin} minutes`
                }
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, height: 26 }}
              >
                {model.reached ? (
                  <Glyph name="done" size={26} color={DONE_GREEN} bg={colors.screen} />
                ) : (
                  <>
                    <Glyph name={model.goalIsMin ? 'min' : 'full'} size={16} color={colors.subtext} bg={colors.screen} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.subtext, fontVariant: ['tabular-nums'] }}>
                      {model.goalMin}
                    </Text>
                  </>
                )}
              </View>
              <Text style={{ fontSize: 56, fontWeight: '800', letterSpacing: 0.5, color: colors.ink, fontVariant: ['tabular-nums'] }}>
                {fmtClock(model.displaySec)}
              </Text>
            </View>
          </View>

          {/* Starting another habit discards a too-short running timer and opens
              this modal, which covers the app's toast, so it shows here too. */}
          <View style={{ marginBottom: 12 }}>
            <MessageToast />
          </View>

          {/* Controls */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <IconButton
                label={model.tracking ? 'Pause' : 'Resume'}
                name={model.tracking ? 'pause' : 'play'}
                size={24}
                bg={colors.card}
                onPress={actions.togglePause}
                style={{ borderRadius: radius.lg, padding: 17 }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <IconButton
                label="Stop and save"
                name="done"
                size={26}
                color="#FFFFFF"
                bg={config.accent}
                onPress={stop}
                style={{ borderRadius: radius.lg, padding: 16 }}
              />
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}
