import React from 'react';
import { Alert, Modal, Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon } from '../components/Icon';
import { activeSec, selectTimer } from '../domain/engine';
import { longSessionSec } from '../domain/reminder';
import { fmtClock, fmtHM } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

const R = 124;
const CIRC = 2 * Math.PI * R;

export function TimerOverlay() {
  const { data, ui, now, config, settings, actions } = useStreak();
  const model = selectTimer(data, config, now);
  const open = ui.timerOpen && !!model;

  // An unusually long session offers a trim before it's saved. Asked while this
  // modal is still up, since iOS can't show an alert over a dismissing modal.
  const stop = () => {
    const secs = activeSec(data.active, Date.now());
    if (secs <= longSessionSec(settings.reminderHours)) {
      actions.stopTimer();
      return;
    }
    const tracked = fmtHM(secs);
    Alert.alert('Long session', `You tracked ${tracked}. Keep it, or set the end time?`, [
      { text: `Keep ${tracked}`, onPress: () => actions.stopTimer() },
      { text: 'Set end time', onPress: () => actions.stopTimer({ editAfter: true }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Modal visible={open} animationType="fade" transparent={false} onRequestClose={actions.closeTimer}>
      {model && (
        <View style={{ flex: 1, backgroundColor: colors.screen, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 40 }}>
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
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: colors.ink }}>
                  {model.name}
                </Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.subtext }}>
                  {model.projectLabel}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={actions.closeTimer}
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.pill,
                backgroundColor: colors.card,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 15, color: colors.subtext }}>✕</Text>
            </Pressable>
          </View>

          {/* Ring + clock */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={280} height={280} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={140} cy={140} r={R} fill="none" stroke="rgba(23,24,26,0.07)" strokeWidth={12} />
                <Circle
                  cx={140}
                  cy={140}
                  r={R}
                  fill="none"
                  stroke={model.ringColor}
                  strokeWidth={12}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - model.ringProgress)}
                />
              </Svg>
              <Text style={{ fontSize: 56, fontWeight: '800', letterSpacing: 0.5, color: colors.ink }}>
                {fmtClock(model.displaySec)}
              </Text>
            </View>

            {/* Quote */}
            {!!config.timerQuote.trim() && (
              <View style={{ alignItems: 'center', gap: 12, marginTop: 30, maxWidth: 280 }}>
                <View style={{ width: 150, height: 1, backgroundColor: 'rgba(23,24,26,0.18)' }} />
                <Text
                  style={{
                    fontStyle: 'italic',
                    fontSize: 16,
                    lineHeight: 24,
                    color: '#6C6F76',
                    textAlign: 'center',
                  }}
                >
                  {config.timerQuote.trim()}
                </Text>
              </View>
            )}
          </View>

          {/* Controls */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={actions.togglePause}
              style={{
                flex: 1,
                borderRadius: radius.lg,
                padding: 17,
                alignItems: 'center',
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>
                {model.tracking ? 'Pause' : 'Resume'}
              </Text>
            </Pressable>
            <Pressable
              onPress={stop}
              style={{
                flex: 1,
                borderRadius: radius.lg,
                padding: 17,
                alignItems: 'center',
                backgroundColor: config.accent,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>Done</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Modal>
  );
}
