import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { AMBER, BudgetBar } from '../components/BudgetBar';
import { CompletionMark } from '../components/CompletionMark';
import { DotRow } from '../components/DotRow';
import { CloseButton, Glyph } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { StartButtons } from '../components/StartButtons';
import { ICONS } from '../domain/constants';
import { habitDaySec, planFor, planMinutes } from '../domain/plan';
import { PickerRow, selectPickerRows } from '../domain/today';
import { dkey } from '../domain/time';
import { useStreak } from '../store/StreakStore';
import { colors, radius } from '../theme/tokens';

/**
 * Edit today's plan without instructions: swap a planned habit for another,
 * or add one while there's room. Habits that wouldn't fit the budget are
 * dimmed with their minutes in amber; choosing one shakes the budget bar and
 * nothing changes. In bonus mode (day done) any habit can be started.
 */
export function PlanPickerSheet() {
  const { data, ui, now, settings, config, actions } = useStreak();
  const picker = ui.planPicker;
  const planSettings = { budgetMin: settings.budgetMin, planCap: settings.planCap };
  const rows = picker
    ? selectPickerRows(data, planSettings, now, {
        swapFor: picker.mode === 'swap' ? picker.habitId : undefined,
        ignoreBudget: picker.mode === 'bonus',
      })
    : [];
  const day = dkey(new Date(now));
  const planned = picker ? planMinutes(planFor(data, habitDaySec(data), day, planSettings), data) : 0;
  const out = picker?.mode === 'swap' ? data.habits.find((h) => h.id === picker.habitId) : undefined;

  const choose = (r: PickerRow) => {
    if (!picker || picker.mode === 'bonus') return;
    if (picker.mode === 'swap') actions.swapPlan(picker.habitId, r.habitId);
    else actions.addToPlan(r.habitId);
  };

  return (
    <Sheet visible={!!picker} onClose={actions.closePlanPicker} maxHeightPct={0.8}>
      {picker && (
        <View style={{ gap: 14, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Glyph
                name={picker.mode === 'swap' ? 'swap' : picker.mode === 'add' ? 'plus' : 'bonus'}
                size={22}
                color={colors.ink}
                label={picker.mode === 'swap' ? 'Swap' : picker.mode === 'add' ? 'Add to today' : 'Bonus'}
              />
              {out && (
                <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: out.tile, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={ICONS[out.icon] || ICONS.code} size={16} />
                </View>
              )}
            </View>
            <CloseButton onPress={actions.closePlanPicker} />
          </View>

          {picker.mode !== 'bonus' && (
            <BudgetBar usedMin={planned} budgetMin={settings.budgetMin} accent={config.accent} shakeKey={ui.budgetShake} />
          )}

          {rows.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Glyph name="done" size={28} color={colors.faint} label="Nothing else to add" />
            </View>
          )}

          <View>
            {rows.map((r) => (
              <Pressable
                key={r.habitId}
                onPress={() => choose(r)}
                disabled={picker.mode === 'bonus'}
                accessibilityRole={picker.mode === 'bonus' ? undefined : 'button'}
                accessibilityLabel={
                  picker.mode === 'bonus' ? undefined : `${r.name}, ${r.fullMin} minutes${r.fits ? '' : ', over the budget'}`
                }
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 11,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.hairline,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={{ opacity: r.fits ? 1 : 0.45, width: 36, height: 36, borderRadius: radius.sm, backgroundColor: r.tile, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon path={r.iconPath} size={18} />
                </View>
                <View style={{ flex: 1, gap: 5, opacity: r.fits ? 1 : 0.45 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{r.name}</Text>
                  <DotRow total={r.weekTarget} filled={r.weekDone} size={6} color={config.accent} label={`${r.weekDone} of ${r.weekTarget} this week`} />
                </View>
                <CompletionMark mark={r.done} size={18} />
                {picker.mode === 'bonus' ? (
                  <StartButtons habit={data.habits.find((h) => h.id === r.habitId)!} size={40} onStarted={actions.closePlanPicker} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Glyph name="full" size={12} color={r.fits ? colors.subtext : AMBER} />
                    <Text style={{ fontSize: 14, fontWeight: '800', color: r.fits ? colors.ink : AMBER, fontVariant: ['tabular-nums'] }}>
                      {r.fullMin}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Sheet>
  );
}

