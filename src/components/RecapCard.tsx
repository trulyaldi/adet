import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import { recapSummary, weekRecap } from '../domain/recap';
import { CloseButton, IconButton } from './Glyph';
import { useStreak } from '../store/StreakStore';
import { colors, radius, shadowCard } from '../theme/tokens';

/**
 * Last week's recap. The store puts it up once per week on this device (see
 * ui.recapCard); it stays for the app session until dismissed or opened.
 */
export function RecapCard() {
  const { data, ui, actions } = useStreak();
  const weekStart = ui.recapCard;
  const recap = useMemo(() => (weekStart ? weekRecap(data, weekStart) : null), [data, weekStart]);
  if (!recap) return null;

  const openDetails = () => {
    actions.dismissRecapCard();
    actions.openRecap(recap.weekStart);
  };

  return (
    <View style={[{ marginTop: 16, backgroundColor: colors.card, borderRadius: radius.xl, padding: 16 }, shadowCard]}>
      <View style={{ zIndex: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.subtext, letterSpacing: 0.5 }}>
            LAST WEEK · {recap.rangeLabel.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 6, lineHeight: 21 }}>
            {recapSummary(recap)}
          </Text>
        </View>
        <CloseButton label="Dismiss" onPress={actions.dismissRecapCard} />
      </View>
      <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
        <IconButton label="See recap" name="chevronRight" size={18} color="#0A84FF" bg={colors.track} diameter={32} onPress={openDetails} />
      </View>
    </View>
  );
}
