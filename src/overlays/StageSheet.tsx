import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { CloseButton } from '../components/Glyph';
import { Sheet } from '../components/Sheet';
import { selectStageSheet } from '../domain/engine';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

const SUN = 'M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8';
const CHECK = 'M5 12l5 5L20 6';

export function StageSheet() {
  const { data, ui, now, config, actions } = useStreak();
  const model = ui.stageSheet
    ? selectStageSheet(data, config, ui.stageSheet, now)
    : null;

  return (
    <Sheet visible={!!model} onClose={actions.closeStageSheet} maxHeightPct={0.82}>
      {model && (
        <View style={{ gap: 16, paddingTop: 12 }}>
          {/* Header */}
          <View style={{ zIndex: 10, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {model.projectName}
              </Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 3 }}>
                {model.currentStage}
              </Text>
            </View>
            <CloseButton onPress={actions.closeStageSheet} />
          </View>

          {/* Next stage progress */}
          {model.hasNext && (
            <View style={{ backgroundColor: colors.screen, borderRadius: radius.lg, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>Next: {model.nextStage}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{model.remainingLabel}</Text>
              </View>
              <View style={{ marginTop: 11 }}>
                <ProgressBar pct={model.progressPct} color={config.accent} track={colors.track3} height={8} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 13 }}>
                <Icon path={SUN} size={16} color={config.accent} strokeWidth={2} />
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.ink }}>{model.etaLabel}</Text>
              </View>
            </View>
          )}

          {/* Ladder */}
          <View>
            {model.ladder.map((lv) => (
              <View
                key={lv.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: lv.rowBg,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    backgroundColor: lv.dotBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon path={CHECK} size={12} color={lv.dotFg} strokeWidth={3.2} />
                </View>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: lv.nameColor }}>{lv.name}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted }}>{lv.hoursLabel}</Text>
              </View>
            ))}
          </View>

        </View>
      )}
    </Sheet>
  );
}
