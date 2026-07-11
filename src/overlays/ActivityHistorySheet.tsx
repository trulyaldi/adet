import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '../components/Sheet';
import { selectStats } from '../domain/engine';
import { useStreak } from '../store/StreakStore';
import { colors } from '../theme/tokens';

export function ActivityHistorySheet() {
  const { data, ui, now, config, actions } = useStreak();
  const visible = ui.heatSheet;
  // Only run the (heavier) stats selector while the sheet is actually open.
  const model = visible ? selectStats(data, config, now, { heatSel: ui.heatSel }) : null;

  return (
    <Sheet visible={visible} onClose={actions.closeHeatSheet} maxHeightPct={0.88}>
      {model && (
      <View style={{ paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink }}>Full history</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{model.heatFullRangeLabel}</Text>
          </View>
          <Pressable
            onPress={actions.closeHeatSheet}
            style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 14, color: colors.subtext }}>✕</Text>
          </Pressable>
        </View>

        {/* Day-of-week header */}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
          <View style={{ width: 34 }} />
          {model.dayHeads.map((t, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.muted }}>
              {t}
            </Text>
          ))}
        </View>

        {/* Weeks */}
        {model.heatFullRows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <Text style={{ width: 34, fontSize: 10, fontWeight: '700', color: colors.muted, textAlign: 'right', paddingRight: 2 }}>
              {row.monthLabel}
            </Text>
            {row.cells.map((cell, ci) => (
              <Pressable
                key={ci}
                disabled={!cell.key}
                onPress={() => cell.key && actions.pickHeat(cell.key)}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: 8,
                  backgroundColor: cell.color,
                  borderWidth: cell.selected ? 2 : 1,
                  borderColor: cell.selected ? config.accent : cell.bcolor,
                }}
              />
            ))}
          </View>
        ))}

        {/* Legend */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 18 }}>
          <Text style={{ fontSize: 11, color: colors.muted, marginRight: 3 }}>Less</Text>
          {model.legendCells.map((c, i) => (
            <View
              key={i}
              style={{ width: 11, height: 11, borderRadius: 3.5, backgroundColor: c, borderWidth: 1, borderColor: 'rgba(23,24,26,0.06)' }}
            />
          ))}
          <Text style={{ fontSize: 11, color: colors.muted, marginLeft: 3 }}>More</Text>
        </View>
      </View>
      )}
    </Sheet>
  );
}
