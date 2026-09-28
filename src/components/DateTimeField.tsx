import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { DOWFULL, MONTHS } from '../domain/constants';
import { pad } from '../domain/time';
import { useTheme } from '../theme/ThemeProvider';

interface DateTimeFieldProps {
  label: string;
  /** Epoch ms. */
  value: number;
  onChange(ms: number): void;
  /** Latest selectable moment (epoch ms). */
  max?: number;
}

/**
 * A labelled date + time picker. iOS uses the native compact picker; Android
 * has no combined mode, so it shows date and time buttons that open the
 * system dialogs.
 */
export function DateTimeField({ label, value, onChange, max }: DateTimeFieldProps) {
  const { colors, radius, shadow } = useTheme();
  const date = new Date(value);
  const maximumDate = max === undefined ? undefined : new Date(max);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.sub }}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={date}
          mode="datetime"
          display="compact"
          maximumDate={maximumDate}
          onValueChange={(_e, d) => onChange(d.getTime())}
        />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <FieldButton
            text={DOWFULL[date.getDay()].slice(0, 3) + ', ' + MONTHS[date.getMonth()].slice(0, 3) + ' ' + date.getDate()}
            onPress={() =>
              DateTimePickerAndroid.open({
                value: date,
                mode: 'date',
                maximumDate,
                onValueChange: (_e, d) => {
                  const next = new Date(value);
                  next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                  onChange(next.getTime());
                },
              })
            }
          />
          <FieldButton
            text={pad(date.getHours()) + ':' + pad(date.getMinutes())}
            onPress={() =>
              DateTimePickerAndroid.open({
                value: date,
                mode: 'time',
                is24Hour: true,
                onValueChange: (_e, d) => {
                  const next = new Date(value);
                  next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                  onChange(next.getTime());
                },
              })
            }
          />
        </View>
      )}
    </View>
  );
}

function FieldButton({ text, onPress }: { text: string; onPress(): void }) {
  const { colors, radius, shadow } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: colors.bg, borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 12 }}
    >
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{text}</Text>
    </Pressable>
  );
}
