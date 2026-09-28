import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { CompletionMark } from '../components/CompletionMark';
import { Glyph } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { UndoToast } from '../components/UndoToast';
import { selectStats } from '../domain/engine';
import { useStreak } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';

export function ActivityDaySheet() {
  const { colors, radius, shadow } = useTheme();
  const { data, ui, now, config, actions } = useStreak();
  const visible = ui.heatSel != null;
  // Only run the (heavier) stats selector while the sheet is actually open.
  const model = visible ? selectStats(data, config, now, { heatSel: ui.heatSel }) : null;

  return (
    <Sheet visible={visible} onClose={actions.closeHeatSel} maxHeightPct={0.72}>
      {model && (
      <View style={{ gap: 14, paddingTop: 12 }}>
        <UndoToast />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colors.ink }}>{model.heatSelDate}</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.sub }}>{model.heatSelInfo}</Text>
        </View>

        {model.heatSelEmpty && (
          <View style={{ alignItems: 'center', paddingVertical: 26 }}>
            <Glyph name="list" size={26} color={colors.muted} label="Nothing logged this day" />
          </View>
        )}

        {model.heatSelSessions.length > 0 && (
          <View>
            {model.heatSelSessions.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => actions.openSessionSheet(s.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 11,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.line,
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: radius.sm, backgroundColor: s.tile, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={s.iconPath} size={17} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>{s.name}</Text>
                  <Text style={{ fontSize: 12.5, color: colors.sub, marginTop: 1, fontVariant: ['tabular-nums'] }}>{s.sub}</Text>
                  {s.note ? (
                    <Text numberOfLines={2} style={{ fontSize: 12, fontStyle: 'italic', color: colors.muted, marginTop: 2 }}>{s.note}</Text>
                  ) : null}
                </View>
                <CompletionMark mark={s.mark} bonus={s.bonus} />
                <Icon path="M9 6l6 6-6 6" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
      )}
    </Sheet>
  );
}
