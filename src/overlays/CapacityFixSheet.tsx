import React from 'react';
import { View } from 'react-native';

import { Button } from '../components/Button';
import { CloseButton, Glyph } from '../components/Glyph';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { Sheet } from '../components/Sheet';
import { targetCheck } from '../domain/capacity';
import { fmtDur } from '../domain/time';
import { useActions, useData, useUi } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../components/Text';

/**
 * Targets over capacity: the two side by side as bars, then two ways to
 * balance them — scale the targets down proportionally, or raise the
 * capacity. Closing keeps things as they are (until the numbers change).
 */
export function CapacityFixSheet() {
  const t = useTheme();
  const { colors } = t;
  const data = useData();
  const open = useUi((u) => u.capacityFix);
  const actions = useActions();
  const chk = targetCheck(data);
  const close = () => {
    actions.dismissTargetCheck(chk.signature);
    actions.closeCapacityFix();
  };
  const max = Math.max(chk.targetMin, chk.capacityMin, 1);

  return (
    <Sheet visible={open} onClose={close}>
      <View style={{ gap: 16, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <Glyph name="clock" size={24} color={colors.amber} label="Weekly targets and capacity" />
          <CloseButton label="Keep as is" onPress={close} />
        </View>
        <Row glyph="target" label="Weekly targets" value={chk.targetMin} max={max} color={colors.amber} />
        <Row glyph="week" label="Week capacity" value={chk.capacityMin} max={max} color={colors.brand} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
          <Button
            variant="secondary"
            icon="shrink"
            label="Scale targets down to fit"
            onPress={() => {
              actions.fixTargets('scale');
              actions.closeCapacityFix();
            }}
            quiet
            style={{ flex: 1 }}
          />
          <Button
            icon="raise"
            label="Raise capacity to fit"
            onPress={() => {
              actions.fixTargets('raise');
              actions.closeCapacityFix();
            }}
            quiet
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Sheet>
  );
}

function Row({ glyph, label, value, max, color }: { glyph: 'target' | 'week'; label: string; value: number; max: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${label}, ${fmtDur(value * 60)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Glyph name={glyph} size={20} color={colors.sub} />
      <View style={{ flex: 1 }}>
        <AnimatedBar value={value / max} color={color} height={14} />
      </View>
      <Text style={{ width: 64, textAlign: 'right', fontSize: 15, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(value * 60)}</Text>
    </View>
  );
}
