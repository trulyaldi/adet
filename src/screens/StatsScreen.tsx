import React from 'react';
import { Alert, Animated, Easing, Pressable, ScrollView, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { SyncIndicator } from '../components/SyncIndicator';
import { selectStats } from '../domain/engine';
import { useStreak } from '../store/StreakStore';
import { useAuth } from '../sync/AuthProvider';
import { colors, radius, shadowCard } from '../theme/tokens';

export function StatsScreen() {
  const { data, ui, now, config, actions } = useStreak();
  const model = selectStats(data, config, now, { heatSel: ui.heatSel });

  return (
    <ScrollView
      contentContainerStyle={{ paddingTop: 64, paddingHorizontal: 20, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: colors.ink }}>Stats</Text>
      <Text style={{ fontSize: 15, color: colors.subtext, marginTop: 3 }}>{model.sub}</Text>

      <LifetimeHero lifetimeLabel={model.lifetimeLabel} lifetimeSub={model.lifetimeSub} />

      {/* Period stats 2x2 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
        <PeriodTile
          value={model.weekHours}
          label="This week"
          iconBg="#D8EAF9"
          icon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Circle cx={12} cy={12} r={9} stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M12 7v5l3 2" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          }
        />
        <PeriodTile
          value={model.monthHours}
          label="This month"
          iconBg="#E4E0F7"
          icon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Rect x={4} y={5} width={16} height={16} rx={2} stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M4 9h16 M8 3v3 M16 3v3" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          }
        />
        <PeriodTile
          value={model.avgDaily}
          label="Avg per day"
          iconBg="#D9F2E3"
          icon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M4 20h16 M7 20v-5 M12 20V9 M17 20v-8" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          }
        />
        <PeriodTile
          value={model.recStreak}
          label="Longest streak"
          iconBg="#FDE4D5"
          icon={
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 21c3.9 0 6.5-2.4 6.5-6 0-2.5-1.4-4.7-3-6.5-.3 1-.8 1.9-1.7 2.5C13.6 8.6 13 5.5 10 3c.3 2.5-.7 4.4-2.1 6C6.6 10.6 5.5 12.4 5.5 15c0 3.6 2.6 6 6.5 6z"
                stroke={colors.ink}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          }
        />
      </View>

      {/* Insights */}
      {model.hasInsights && (
        <View
          style={[
            { backgroundColor: colors.card, borderRadius: radius.xxl, paddingVertical: 16, paddingHorizontal: 18, marginTop: 10 },
            shadowCard,
          ]}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Insights</Text>
          <View style={{ gap: 11, marginTop: 12 }}>
            {model.insights.map((ins, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 9,
                    backgroundColor: ins.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon path={ins.iconPath} size={14} strokeWidth={2} />
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: '#3A3D42', lineHeight: 19 }}>{ins.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Most active habit */}
      {model.hasTopHabit && (
        <View
          style={[
            {
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: 14,
              paddingHorizontal: 16,
              marginTop: 10,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            },
            shadowCard,
          ]}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 13,
              backgroundColor: model.topHabitTile,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon path={model.topHabitIcon} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink }}>{model.topHabitName}</Text>
            <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>Most active habit</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.ink }}>{model.topHabitHours}</Text>
        </View>
      )}

      {/* Time by project */}
      <View
        style={[
          { backgroundColor: colors.card, borderRadius: radius.xxl, paddingHorizontal: 18, paddingBottom: 14, marginTop: 10 },
          shadowCard,
        ]}
      >
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink, paddingTop: 14, paddingBottom: 6 }}>
          Time by project
        </Text>
        {model.projDist.map((pd) => (
          <View key={pd.name} style={{ paddingVertical: 9 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, fontWeight: '700', color: colors.ink }}>
                {pd.name}
              </Text>
              <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.subtext }}>{pd.label}</Text>
            </View>
            <View style={{ marginTop: 7 }}>
              <ProgressBar pct={pd.barW} color={colors.ink} />
            </View>
          </View>
        ))}
      </View>

      {/* Activity heatmap */}
      <View style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, padding: 18, marginTop: 10 }, shadowCard]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <Pressable onPress={actions.openHeatSheet} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Activity map</Text>
              <Text style={{ fontSize: 12, color: colors.subtext, marginTop: 2 }}>{model.heatRangeLabel}</Text>
            </View>
            <Icon path="M9 6l6 6-6 6" size={18} color={colors.muted} />
          </Pressable>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 11, color: colors.muted, marginRight: 3 }}>Less</Text>
              {model.legendCells.map((c, i) => (
                <View
                  key={i}
                  style={{ width: 11, height: 11, borderRadius: 3.5, backgroundColor: c, borderWidth: 1, borderColor: 'rgba(23,24,26,0.06)' }}
                />
              ))}
              <Text style={{ fontSize: 11, color: colors.muted, marginLeft: 3 }}>More</Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.muted }}>time per day</Text>
          </View>
        </View>

        {/* Day-of-week header */}
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ width: 30 }} />
          {model.dayHeads.map((t, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: colors.muted }}>
              {t}
            </Text>
          ))}
        </View>

        {/* Weeks */}
        {model.heatRows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
            <Text style={{ width: 30, fontSize: 10, fontWeight: '700', color: colors.muted, textAlign: 'right', paddingRight: 2 }}>
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

        {/* See full history */}
        {model.heatCanToggle && (
          <Pressable
            onPress={actions.openHeatSheet}
            style={{
              marginTop: 16,
              padding: 10,
              borderRadius: 12,
              backgroundColor: colors.screen,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{model.heatOpenLabel}</Text>
          </Pressable>
        )}
      </View>

      {/* Recent sessions */}
      <View style={[{ backgroundColor: colors.card, borderRadius: radius.xxl, paddingHorizontal: 18, marginTop: 10 }, shadowCard]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>Recent sessions</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Pressable onPress={actions.openLogSheet}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: config.accent }}>+ Log</Text>
            </Pressable>
            {model.historyHasRows &&
              (ui.clearArmed ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <Pressable onPress={actions.cancelClear}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.subtext }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={actions.confirmClear}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: colors.danger }}>Clear all</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={actions.armClear}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0A84FF' }}>Clear</Text>
                </Pressable>
              ))}
          </View>
        </View>

        {!model.historyHasRows && (
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 14, paddingVertical: 26 }}>
            No sessions yet
          </Text>
        )}

        {model.historyRows.map((hr) => (
          <Pressable
            key={hr.id}
            onPress={() => actions.openSessionSheet(hr.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
              paddingVertical: 11,
              borderBottomWidth: 1,
              borderBottomColor: colors.hairline,
            }}
          >
            <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: hr.tile, alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={hr.iconPath} size={18} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{hr.name}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12, color: colors.subtext, marginTop: 1 }}>{hr.sub}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>{hr.timeLabel}</Text>
          </Pressable>
        ))}
        <View style={{ height: 8 }} />
      </View>

      <AccountCard />
    </ScrollView>
  );
}

function AccountCard() {
  const { session, signOut } = useAuth();
  const { sync, clearLocalData } = useStreak();
  const [busy, setBusy] = React.useState(false);

  const confirmSignOut = () => {
    const unsynced = sync.pending;
    Alert.alert(
      'Sign out?',
      unsynced
        ? `${unsynced} change${unsynced === 1 ? " hasn't" : "s haven't"} synced yet and will be lost. Your data will be removed from this device.`
        : "Your data is synced and will be removed from this device. You'll need to sign in again to see it.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: unsynced ? 'Sign out anyway' : 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await clearLocalData();
              await signOut();
            } catch (e) {
              setBusy(false);
              Alert.alert('Could not sign out', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.xl,
          padding: 14,
          paddingHorizontal: 16,
          marginTop: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        shadowCard,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: colors.subtext }}>Signed in as</Text>
        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: '700', color: colors.ink, marginTop: 2 }}>
          {session?.user.email ?? 'Unknown account'}
        </Text>
        <View style={{ marginTop: 4 }}>
          <SyncIndicator />
        </View>
      </View>
      <Pressable disabled={busy} onPress={confirmSignOut} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.dangerSoft, opacity: busy ? 0.5 : 1 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>Sign out</Text>
      </Pressable>
    </View>
  );
}

function LifetimeHero({ lifetimeLabel, lifetimeSub }: { lifetimeLabel: string; lifetimeSub: string }) {
  const gloss = React.useRef(new Animated.Value(0)).current;
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (size.width <= 0 || size.height <= 0) return undefined;

    gloss.setValue(0);
    const loop = Animated.loop(
      Animated.timing(gloss, {
        toValue: 1,
        duration: 3600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    loop.start();

    return () => {
      loop.stop();
    };
  }, [gloss, size.height, size.width]);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;

    setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
  };

  const hasSize = size.width > 0 && size.height > 0;
  const bandWidth = size.width * 0.45;
  const bandHeight = size.height * 1.4;
  const translateX = gloss.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth, size.width],
  });

  return (
    <View
      onLayout={onLayout}
      style={{ backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 20, marginTop: 18, overflow: 'hidden' }}
    >
      {hasSize && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -size.height * 0.2,
            left: 0,
            width: bandWidth,
            height: bandHeight,
            transform: [{ translateX }, { skewX: '-18deg' }],
          }}
        >
          <Svg width="100%" height="100%" viewBox={`0 0 ${bandWidth} ${bandHeight}`} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="lifetimeGloss" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0.14} />
                <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={bandWidth} height={bandHeight} fill="url(#lifetimeGloss)" />
          </Svg>
        </Animated.View>
      )}
      <View style={{ position: 'relative', zIndex: 1 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 1 }}>
          LIFETIME
        </Text>
        <Text style={{ fontSize: 40, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginTop: 4 }}>
          {lifetimeLabel}
        </Text>
        <Text style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', marginTop: 8 }}>{lifetimeSub}</Text>
      </View>
    </View>
  );
}

function PeriodTile({ value, label, icon, iconBg }: { value: string; label: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <View
      style={[
        { width: '48%', backgroundColor: colors.card, borderRadius: radius.xl, paddingVertical: 15, paddingHorizontal: 16, gap: 12 },
        shadowCard,
      ]}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.sm,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View>
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'], lineHeight: 24 }}>
          {value}
        </Text>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#8A8F98', marginTop: 5 }}>{label}</Text>
      </View>
    </View>
  );
}
