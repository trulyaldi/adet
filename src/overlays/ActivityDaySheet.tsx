import React from 'react';
import { Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { selectStats } from '../domain/engine';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

export function ActivityDaySheet() {
  const { data, ui, now, config, actions } = useStreak();
  const visible = ui.heatSel != null;
  // Only run the (heavier) stats selector while the sheet is actually open.
  const model = visible ? selectStats(data, config, now, { heatSel: ui.heatSel }) : null;

  return (
    <Sheet visible={visible} onClose={actions.closeHeatSel} maxHeightPct={0.72}>
      {model && (
      <View style={{ gap: 14, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext, letterSpacing: 0.5 }}>
              ACTIVITY
            </Text>
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.ink, marginTop: 2 }}>
              {model.heatSelDate}
            </Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.subtext }}>{model.heatSelInfo}</Text>
        </View>

        {model.heatSelEmpty ? (
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 14, paddingVertical: 26 }}>
            No time logged this day
          </Text>
        ) : (
          <View>
            {model.heatSelRows.map((hs, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.hairline,
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: hs.tile, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={hs.iconPath} size={17} />
                </View>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink }}>
                  {hs.name}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{hs.timeLabel}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      )}
    </Sheet>
  );
}
