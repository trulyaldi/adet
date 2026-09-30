// An optional amount of a habit's measure (v2 N8): − / a number / +, then the
// unit. Empty means "not counted" (skipping costs nothing; amounts never earn).

import React from 'react';
import { View } from 'react-native';

import { TextInput } from '../../../components/Text';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';

export function AmountField({ value, onChange, label, unit }: { value: string; onChange(v: string): void; label: string; unit: string }) {
  const n = Number(value) || 0;
  const step = (d: number) => onChange(String(Math.max(0, n + d)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <PixelButton small tone="parchment" label="−" accessibilityLabel={`Less ${label}`} onPress={() => step(-1)} disabled={n <= 0} />
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, '').slice(0, 7))}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={QUI.muted}
        accessibilityLabel={`${label}, how many`}
        style={{ width: 64, minHeight: 44, textAlign: 'center', backgroundColor: QUI.white, color: QUI.ink, fontSize: 16, borderWidth: 2, borderColor: QUI.ink }}
      />
      <PixelButton small tone="parchment" label="+" accessibilityLabel={`More ${label}`} onPress={() => step(1)} />
      <PixelText size="sm" color={QUI.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
        {unit || label}
      </PixelText>
    </View>
  );
}

/** The amount to save: a positive number, or nothing. */
export function amountOf(value: string, metricId: string | null): { value: number; metricId: string } | undefined {
  const v = Number(value);
  return metricId && Number.isFinite(v) && v > 0 ? { value: v, metricId } : undefined;
}
