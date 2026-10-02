// The Overworld (World Mode, world-5): the Quest tab's root. One vertical
// map of the 7 biome slots. A claimed slot shows its realm's name, icon and a
// glance of quests cleared (pips), and a flag once conquered; an unclaimed
// one sits under cloud, the lowest offering a "+". Tap a realm and the hero
// walks there along the path (under 900 ms, tap to skip), then the Realm
// opens. Long-press a realm to rename it. The canvas stays screen-sized: a
// transparent scroll view on top moves its camera and takes the taps.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, scrollTo, SharedValue, useAnimatedReaction, useAnimatedRef, useAnimatedScrollHandler, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '../../../components/Icon';
import { ICONS } from '../../../domain/constants';
import type { SlotView } from '../../../domain/world/select';
import type { AvatarLook } from '../../../game/avatar';
import { WORLD_W } from '../../../game/content/biomes/layout';
import { pixelScale } from '../../../game/render/pixel';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { PE } from '../../../game/ui/pointer';
import { QUI } from '../../../game/ui/theme';
import { OverworldMap } from './OverworldMap';
import { along, OW_H, overworldLayout, route, SLOT_H, travelMs } from './overworldModel';

/** Pips past this many would crowd the label: they scale down to it. */
const MAX_PIPS = 8;

export function Overworld({
  width,
  height,
  slots,
  current,
  look,
  clock,
  reduced,
  onOpen,
  onClaim,
  onRename,
}: {
  width: number;
  height: number;
  slots: readonly SlotView[];
  /** Where the hero stands (null: nothing claimed yet). */
  current: number | null;
  look: AvatarLook;
  clock: SharedValue<number>;
  reduced: boolean;
  /** The hero has arrived: open this realm. */
  onOpen(slot: number): void;
  onClaim(slot: number): void;
  onRename(slot: number): void;
}) {
  const layout = useMemo(() => overworldLayout(), []);
  const scale = pixelScale(width);
  const viewW = Math.ceil(width / scale);
  const camX = Math.round((WORLD_W - viewW) / 2);
  const contentH = Math.max(height, OW_H * scale);
  const maxScroll = contentH - height;
  const scrollFor = useCallback((wy: number) => Math.max(0, Math.min(maxScroll, Math.round(wy * scale - height * 0.55))), [maxScroll, scale, height]);

  const scroller = useAnimatedRef<Animated.ScrollView>();
  const camY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    camY.set(e.contentOffset.y / scale);
  });

  // The hero token: on the current slot, or walking a route.
  const heroX = useSharedValue(0);
  const heroY = useSharedValue(0);
  const heroMode = useSharedValue(0);
  const t = useSharedValue(1);
  const pts = useSharedValue<number[]>([]);
  useEffect(() => {
    if (current === null || pts.value.length) return;
    heroX.set(layout.slots[current].x);
    heroY.set(layout.slots[current].y);
  }, [current, layout, heroX, heroY, pts]);
  useAnimatedReaction(
    () => t.value,
    (v) => {
      if (!pts.value.length) return;
      const p = along(pts.value, v);
      heroX.set(p.x);
      heroY.set(p.y);
      // The camera keeps the hero in view while it walks.
      scrollTo(scroller, 0, Math.max(0, Math.min(maxScroll, Math.round(p.y * scale - height * 0.55))), false);
    }
  );

  // Start on the hero's realm (or the bottom of the map before any claim).
  const placed = useRef(false);
  const place = () => {
    if (placed.current) return;
    placed.current = true;
    const y = scrollFor(current === null ? OW_H : layout.slots[current].y);
    camY.set(y / scale);
    scroller.current?.scrollTo({ y, animated: false });
  };

  const [walking, setWalking] = useState<number | null>(null);
  const arrived = useRef(true);
  const arrive = useCallback(
    (to: number) => {
      if (arrived.current) return;
      arrived.current = true;
      cancelAnimation(t);
      pts.set([]);
      heroMode.set(0);
      heroX.set(layout.slots[to].x);
      heroY.set(layout.slots[to].y);
      setWalking(null);
      onOpen(to);
    },
    [t, pts, heroMode, heroX, heroY, layout, onOpen]
  );
  const travel = (to: number) => {
    if (current === null || current === to || reduced) {
      onOpen(to);
      return;
    }
    arrived.current = false;
    setWalking(to);
    pts.set(route(layout, current, to));
    heroMode.set(1);
    t.set(0);
    t.set(
      withTiming(1, { duration: travelMs(current, to), easing: Easing.inOut(Easing.quad) }, (done) => {
        if (done) scheduleOnRN(arrive, to);
      })
    );
  };

  const next = slots.find((s) => !s.realm)?.slot ?? null;
  return (
    <View style={{ width, height }}>
      <OverworldMap
        width={width}
        height={height}
        scale={scale}
        layout={layout}
        slots={slots}
        camY={camY}
        clock={clock}
        reduced={reduced}
        look={look}
        hero={current !== null}
        heroX={heroX}
        heroY={heroY}
        heroMode={heroMode}
      />
      <Animated.ScrollView
        ref={scroller}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ height: contentH }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={place}
        scrollEnabled={walking === null}
      >
        {layout.slots.map((spot) => {
          const s = slots[spot.slot];
          const r = s.realm;
          const top = spot.top * scale;
          const cx = (spot.x - camX) * scale;
          return (
            <Pressable
              key={spot.slot}
              onPress={() => (r ? travel(spot.slot) : onClaim(spot.slot))}
              onLongPress={r ? () => onRename(spot.slot) : undefined}
              accessibilityRole="button"
              accessibilityLabel={r ? `${r.name}: ${s.cleared} of ${s.total} quests cleared${s.conquered ? ', conquered' : ''}. Open` : 'Land under cloud: claim it'}
              accessibilityActions={r ? [{ name: 'longpress', label: 'Rename' }] : undefined}
              onAccessibilityAction={r ? () => onRename(spot.slot) : undefined}
              style={{ position: 'absolute', left: 0, right: 0, top, height: SLOT_H * scale }}
            >
              {r ? (
                <View style={[PE.none, { position: 'absolute', left: cx - 90, width: 180, top: (spot.y - spot.top + 18) * scale, alignItems: 'center' }]}>
                  <PixelPanel tone="parchment" padding={1}>
                    <View style={{ alignItems: 'center', gap: 3 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Icon path={ICONS[r.icon] ?? ICONS.target} size={14} color={QUI.ink} />
                        <PixelText size="sm" numberOfLines={1} style={{ maxWidth: 140 }}>
                          {r.name}
                        </PixelText>
                      </View>
                      {s.total > 0 && <Pips cleared={s.cleared} total={s.total} />}
                    </View>
                  </PixelPanel>
                </View>
              ) : (
                spot.slot === next && (
                  <View style={[PE.none, { position: 'absolute', left: cx - 22, top: (spot.y - spot.top) * scale - 22, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }]}>
                    <PixelPanel tone="gold" padding={1}>
                      <PixelText size="lg" bold>
                        +
                      </PixelText>
                    </PixelPanel>
                  </View>
                )
              )}
            </Pressable>
          );
        })}
      </Animated.ScrollView>
      {/* While the hero walks, any tap skips to the arrival. */}
      {walking !== null && (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => arrive(walking)} accessibilityRole="button" accessibilityLabel="Skip the walk" />
      )}
    </View>
  );
}

/** Quests cleared out of all, as pips (scaled down past MAX_PIPS, so never a number). */
function Pips({ cleared, total }: { cleared: number; total: number }) {
  const n = Math.min(total, MAX_PIPS);
  const lit = total <= MAX_PIPS ? cleared : Math.round((cleared / total) * n);
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ width: 6, height: 6, borderWidth: 1, borderColor: QUI.ink, backgroundColor: i < lit ? QUI.goldLight : QUI.parchmentShade }} />
      ))}
    </View>
  );
}
