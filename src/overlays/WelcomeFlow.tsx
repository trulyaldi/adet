import React, { useRef, useState } from 'react';
import { Modal, NativeScrollEvent, NativeSyntheticEvent, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { BadgeArt } from '../components/celebrate/BadgeArt';
import { Character } from '../components/character/Character';
import { Glyph } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { AnimatedBar } from '../components/motion/AnimatedBar';
import { ProgressRing } from '../components/motion/ProgressRing';
import { ScenePreview } from '../components/ScenePreview';
import { targetCheck } from '../domain/capacity';
import { ICONS } from '../domain/constants';
import { projectLook, SCENES } from '../domain/look';
import { activeProjects } from '../domain/projects';
import { fmtDur } from '../domain/time';
import { useActions, useData, useReady, useSettings, useUi } from '../store/StreakStore';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Once, after the update: three swipeable pictures (flexible time, colorful
 * projects with scenes, celebrations), then the rebalance step — projects
 * with their new colors and scenes and the week's targets against capacity —
 * and a check to accept.
 */
export function WelcomeFlow() {
  const ready = useReady();
  const data = useData();
  const settings = useSettings();
  const timerOpen = useUi((u) => u.timerOpen);
  const open = ready && !settings.welcomeSeen && !timerOpen;
  return (
    <Modal visible={open} animationType="fade" onRequestClose={() => {}} statusBarTranslucent>
      {open && <Pages hasProjects={activeProjects(data).length > 0} />}
    </Modal>
  );
}

function Pages({ hasProjects }: { hasProjects: boolean }) {
  const t = useTheme();
  const { colors } = t;
  const actions = useActions();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const count = hasProjects ? 4 : 3;
  const last = page === count - 1;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  const next = () => {
    if (last) {
      actions.markWelcomeSeen();
      return;
    }
    scroll.current?.scrollTo({ x: width * (page + 1), animated: true });
    setPage(page + 1);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
      <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flex: 1 }}>
        <Page width={width} label="Time is flexible: every minute counts, and going past the target is bonus">
          <FlexibleTime />
        </Page>
        <Page width={width} label="Every project has its color and its own focus scene">
          <ColorfulProjects />
        </Page>
        <Page width={width} label="Wins get celebrated, big ones with badges">
          <Celebrations />
        </Page>
        {hasProjects && (
          <Page width={width} group={false} label="Your projects, their colors and scenes, and the week's targets against your time">
            <Rebalance />
          </Page>
        )}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 18 }}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? colors.brand : colors.track }} />
        ))}
      </View>
      <View style={{ paddingHorizontal: 24 }}>
        <Button icon={last ? 'done' : 'chevronRight'} label={last ? 'Start' : 'Next'} haptic={last} onPress={next} />
      </View>
    </View>
  );
}

/** A page; picture pages are read as one labelled image, the rebalance page (with buttons) is not grouped. */
function Page({ width, label, children, group = true }: { width: number; label: string; children: React.ReactNode; group?: boolean }) {
  return (
    <View accessible={group} accessibilityLabel={group ? label : undefined} style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      {children}
    </View>
  );
}

function FlexibleTime() {
  const t = useTheme();
  const sw = t.swatch('teal');
  return (
    <View style={{ alignItems: 'center', gap: 26 }}>
      <ProgressRing size={220} stroke={16} value={1.35} color={sw.base} bonusColor={sw.bonus} track={sw.light} marker>
        <Glyph name="sparkle" size={44} color={sw.dark} bg={t.colors.bg} />
      </ProgressRing>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Glyph name="play" size={30} color={t.colors.sub} />
        <Glyph name="chevronRight" size={20} color={t.colors.muted} />
        <Glyph name="clock" size={30} color={t.colors.sub} />
        <Glyph name="chevronRight" size={20} color={t.colors.muted} />
        <Glyph name="done" size={30} color={t.colors.brand} />
      </View>
    </View>
  );
}

function ColorfulProjects() {
  const t = useTheme();
  const colorsFor = ['green', 'purple', 'teal', 'orange'] as const;
  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {SCENES.slice(0, 2).map((k, i) => (
          <ScenePreview key={k} kind={k} swatch={t.swatch(colorsFor[i])} width={140} height={170} progress={0.8} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {SCENES.slice(2).map((k, i) => (
          <ScenePreview key={k} kind={k} swatch={t.swatch(colorsFor[i + 2])} width={140} height={170} progress={0.8} />
        ))}
      </View>
    </View>
  );
}

function Celebrations() {
  return (
    <View style={{ alignItems: 'center', gap: 30 }}>
      <BadgeArt info={{ id: 'demo', kind: 'streak', value: 7 }} size={160} animated />
      <Character mood="waving" size={110} />
    </View>
  );
}

function Rebalance() {
  const t = useTheme();
  const { colors, radius } = t;
  const data = useData();
  const actions = useActions();
  const chk = targetCheck(data);
  const max = Math.max(chk.targetMin, chk.capacityMin, 1);
  return (
    <View style={{ alignSelf: 'stretch', gap: 12 }}>
      {activeProjects(data).map((p) => {
        const look = projectLook(p);
        const sw = t.swatch(look.color);
        return (
          <View key={p.id} style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.xl, padding: 10 }, t.shadow]}>
            <ScenePreview kind={look.scene} swatch={sw} width={52} height={60} />
            <View style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: sw.base, alignItems: 'center', justifyContent: 'center' }}>
              <Icon path={ICONS[look.icon]} size={18} color={sw.on} />
            </View>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 15.5, fontWeight: '800', color: colors.ink }}>
              {p.name}
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '800', color: colors.sub, fontVariant: ['tabular-nums'] }}>{fmtDur(p.weeklyTarget * 3600)}</Text>
          </View>
        );
      })}
      <View style={{ gap: 10, marginTop: 8 }}>
        <View accessible accessibilityLabel={`Weekly targets ${fmtDur(chk.targetMin * 60)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Glyph name="target" size={20} color={colors.sub} />
          <View style={{ flex: 1 }}>
            <AnimatedBar value={chk.targetMin / max} color={chk.over ? colors.amber : colors.brand} height={12} />
          </View>
          <Text style={{ width: 60, textAlign: 'right', fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(chk.targetMin * 60)}</Text>
        </View>
        <View accessible accessibilityLabel={`Week capacity ${fmtDur(chk.capacityMin * 60)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Glyph name="week" size={20} color={colors.sub} />
          <View style={{ flex: 1 }}>
            <AnimatedBar value={chk.capacityMin / max} color={colors.brand} height={12} />
          </View>
          <Text style={{ width: 60, textAlign: 'right', fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }}>{fmtDur(chk.capacityMin * 60)}</Text>
        </View>
        {chk.over && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button variant="secondary" size="md" icon="shrink" label="Scale targets down to fit" onPress={() => actions.fixTargets('scale')} quiet style={{ flex: 1 }} />
            <Button size="md" icon="raise" label="Raise capacity to fit" onPress={() => actions.fixTargets('raise')} quiet style={{ flex: 1 }} />
          </View>
        )}
      </View>
    </View>
  );
}
