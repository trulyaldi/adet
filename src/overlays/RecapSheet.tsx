import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '../components/Sheet';
import { changeLabel, recapSummary, weekRecap } from '../domain/recap';
import { fmtH } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

export function RecapSheet() {
  const { data, ui, actions } = useStreak();
  // Only compute while open.
  const recap = ui.recapSheet ? weekRecap(data, ui.recapSheet) : null;

  return (
    <Sheet visible={!!recap} onClose={actions.closeRecap} maxHeightPct={0.8}>
      {recap && (
        <View style={{ gap: 14, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext, letterSpacing: 0.5 }}>WEEKLY RECAP</Text>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 2 }}>{recap.rangeLabel}</Text>
            </View>
            <Pressable
              onPress={actions.closeRecap}
              style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 14, color: colors.subtext }}>✕</Text>
            </Pressable>
          </View>

          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink, lineHeight: 20 }}>{recapSummary(recap)}</Text>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Tile value={fmtH(recap.totalSec)} label="Tracked" />
            <Tile value={String(recap.sessions)} label={recap.sessions === 1 ? 'Session' : 'Sessions'} />
            <Tile value={recap.bestDay ? recap.bestDay.label.slice(0, 3) : '—'} label={recap.bestDay ? 'Best day · ' + fmtH(recap.bestDay.sec) : 'Best day'} />
          </View>

          <View>
            {recap.projects.map((p) => (
              <View
                key={p.projectId}
                style={{ paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.hairline, gap: 3 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink }}>{p.name}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>
                    {fmtH(p.doneSec)}
                    {p.targetSec !== null ? ' / ' + fmtH(p.targetSec) : ''}
                  </Text>
                  {p.hit !== null && (
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color: p.hit ? '#1F8A3B' : colors.subtext,
                        backgroundColor: p.hit ? '#E3F5E8' : colors.track,
                        borderRadius: radius.pill,
                        paddingVertical: 3,
                        paddingHorizontal: 8,
                        overflow: 'hidden',
                      }}
                    >
                      {p.hit ? 'HIT' : 'MISSED'}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 12, color: colors.subtext }}>{changeLabel(p.doneSec, p.prevSec)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </Sheet>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.screen, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{value}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 11.5, fontWeight: '600', color: colors.subtext, marginTop: 3 }}>{label}</Text>
    </View>
  );
}
