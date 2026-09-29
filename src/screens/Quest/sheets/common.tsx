// Shared pieces of the camp's sheets: a parchment sheet that opens with the
// NPC's greeting (tap to go on), and a grid of sprite icons drawn in one
// canvas with ordinary buttons over it (one GPU surface, not one per icon).

import { Canvas, Group } from '@shopify/react-native-skia';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sprite } from '../../../game/assets/manifest';
import { BatchItem, SpriteBatch } from '../../../game/render/SpriteBatch';
import { SpriteView } from '../../../game/render/SpriteView';
import { DialogBox } from '../../../game/ui/DialogBox';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI, useUiUnit } from '../../../game/ui/theme';

export function QuestSheet({
  visible,
  title,
  portrait,
  greeting,
  onClose,
  reduced,
  children,
  scroll = true,
}: {
  visible: boolean;
  title: string;
  /** Sprite id base for the NPC (e.g. npc.sage), or a single sprite id. */
  portrait?: string;
  /** Shown first, typed out; the content follows. */
  greeting?: string;
  onClose(): void;
  reduced: boolean;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const u = useUiUnit();
  const [greeted, setGreeted] = useState(!greeting);
  const isNpc = !!portrait?.startsWith('npc.');
  return (
    <Modal visible={visible} transparent animationType={reduced ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,8,20,0.45)' }]} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={{ marginTop: 'auto', maxHeight: height * 0.86, paddingHorizontal: 8, paddingBottom: Math.max(insets.bottom, 8) }}>
          {!greeted && greeting && isNpc ? (
            <DialogBox name={title} portrait={portrait!} lines={[greeting]} onDone={() => setGreeted(true)} reduced={reduced} />
          ) : (
            <PixelPanel tone="parchment" padding={3} style={{ gap: 3 * u, flexShrink: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 * u }}>
                {portrait && <SpriteView id={isNpc ? `${portrait}.idle` : portrait} scale={3} animate={!reduced && isNpc} />}
                <PixelText size="lg" bold style={{ flex: 1 }} accessibilityRole="header">
                  {title}
                </PixelText>
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <PixelText size="lg" color={QUI.wood}>
                    ✕
                  </PixelText>
                </Pressable>
              </View>
              {scroll ? (
                <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 3 * u, paddingBottom: 2 * u }} keyboardShouldPersistTaps="handled">
                  {children}
                </ScrollView>
              ) : (
                children
              )}
            </PixelPanel>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export interface GridCell {
  key: string;
  icon: string;
  label: string;
  dim?: boolean;
  badge?: 'lock' | 'check' | 'star' | null;
  /** A small number beside the badge (times a boss was beaten). */
  count?: number;
}

/** Icons in a grid: one canvas draws them all; buttons sit on top (labelled pictures without `onPress`). */
export function IconGrid({ cells, columns, cell, scale, onPress, selected }: { cells: GridCell[]; columns: number; cell: number; scale: number; onPress?(key: string): void; selected?: string | null }) {
  const rows = Math.ceil(cells.length / columns);
  const w = columns * cell;
  const h = rows * cell;
  const byAtlas = new Map<string, BatchItem[]>();
  const dimmed = new Map<string, BatchItem[]>();
  const badges: BatchItem[] = [];
  cells.forEach((c, i) => {
    const m = sprite(c.icon);
    const cx = ((i % columns) + 0.5) * (cell / scale);
    const cy = (Math.floor(i / columns) + 0.5) * (cell / scale);
    const item = { id: c.icon, x: cx - m.w / 2 + m.ax, y: cy - m.h / 2 + m.ay, frame: 0 };
    const map = c.dim ? dimmed : byAtlas;
    if (!map.has(m.atlas)) map.set(m.atlas, []);
    map.get(m.atlas)!.push(item);
    if (c.badge === 'star') badges.push({ id: 'avatar.pip', x: cx + cell / scale / 2 - 7, y: cy - cell / scale / 2 + 2, frame: 0 });
    else if (c.badge) badges.push({ id: c.badge === 'lock' ? 'icon.lock' : 'icon.check', x: cx + cell / scale / 2 - 8, y: cy - cell / scale / 2 + 8, frame: 0 });
  });
  return (
    <View style={{ width: w, height: h, alignSelf: 'center' }}>
      <Canvas style={{ width: w, height: h }}>
        <Group transform={[{ scale }]}>
          {[...byAtlas.entries()].map(([a, items]) => (
            <SpriteBatch key={a} atlas={a as never} items={items} />
          ))}
          <Group opacity={0.4}>
            {[...dimmed.entries()].map(([a, items]) => (
              <SpriteBatch key={a} atlas={a as never} items={items} />
            ))}
          </Group>
          <SpriteBatch atlas="shared" items={badges} />
        </Group>
      </Canvas>
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', flexWrap: 'wrap' }]}>
        {cells.map((c) => !onPress ? (
          <View key={c.key} accessible accessibilityRole="image" accessibilityLabel={c.label} style={{ width: cell, height: cell }} />
        ) : (
          <Pressable
            key={c.key}
            onPress={() => onPress(c.key)}
            accessibilityRole="button"
            accessibilityLabel={c.label}
            accessibilityState={{ selected: selected === c.key, disabled: !!c.dim }}
            style={{ width: cell, height: cell, borderWidth: selected === c.key ? 2 : 0, borderColor: QUI.gold }}
          >
            {!!c.count && (
              <PixelText size="tiny" bold color={QUI.goldDark} style={{ position: 'absolute', right: 2, bottom: 2 }}>
                {c.count}
              </PixelText>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** A labelled row with a sprite icon. */
export function Row({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>{children}</View>;
}
