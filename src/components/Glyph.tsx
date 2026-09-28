import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors, radius } from '../theme/tokens';
import { GLYPH_STROKE, GLYPHS, GlyphName, GlyphPart } from './glyphs';

export type { GlyphName } from './glyphs';

interface GlyphProps {
  name: GlyphName;
  size?: number;
  /** The glyph color (the `currentColor` of the set). */
  color?: string;
  /** The surface behind the glyph; hollow glyphs (doneMin) cut out in this color. */
  bg?: string;
  /**
   * Announces the glyph to screen readers. Leave out when the glyph sits
   * inside a control that already has a label.
   */
  label?: string;
}

/** One glyph from the Adet icon set (see glyphs.ts). */
export function Glyph({ name, size = 20, color = colors.ink, bg = colors.card, label }: GlyphProps) {
  const svg = (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {(GLYPHS[name] as GlyphPart[]).map((p, i) => {
        const c = p.knockout ? bg : color;
        return (
          <Path
            key={i}
            d={p.d}
            transform={p.transform}
            fill={p.fill ? c : 'none'}
            stroke={p.noStroke ? 'none' : c}
            strokeWidth={p.strokeWidth ?? GLYPH_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </Svg>
  );
  if (!label) return svg;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      {svg}
    </View>
  );
}

/** How long a long-press tooltip stays up. */
const TIP_MS = 1600;

/**
 * A long-press tooltip: touch has no hover, so pressing and holding an
 * icon-only control shows its label. It opens above the control (drawn over
 * what came before it); controls on a top edge pass `below`, and their row
 * sits above what follows (zIndex only orders siblings).
 */
export function useTip(label: string, below = false) {
  const [shown, setShown] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setShown(true);
    timer.current = setTimeout(() => setShown(false), TIP_MS);
  };
  const tip = shown ? (
    <View
      pointerEvents="none"
      style={[
        { position: 'absolute', left: -80, right: -80, alignItems: 'center', zIndex: 20 },
        below ? { top: '100%', marginTop: 6 } : { bottom: '100%', marginBottom: 6 },
      ]}
    >
      <View style={{ backgroundColor: colors.ink, borderRadius: radius.sm, paddingVertical: 5, paddingHorizontal: 9 }}>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: '#FFFFFF' }}>
          {label}
        </Text>
      </View>
    </View>
  ) : null;
  return { show, tip };
}

interface IconButtonProps {
  /** Spoken label and long-press tooltip; every icon-only control has one. */
  label: string;
  onPress(): void;
  name?: GlyphName;
  /** Custom content instead of a single glyph (e.g. a glyph and a number). */
  children?: React.ReactNode;
  size?: number;
  color?: string;
  /** Button background; transparent by default. */
  bg?: string;
  /** Width and height of a round button; omit to size to the content. */
  diameter?: number;
  disabled?: boolean;
  selected?: boolean;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  /** Open the tooltip below instead of above (controls on a top edge). */
  tipBelow?: boolean;
}

/** An icon-only control with an accessibility label and a long-press tooltip. */
export function IconButton({
  label,
  onPress,
  name,
  children,
  size = 20,
  color = colors.ink,
  bg = 'transparent',
  diameter,
  disabled,
  selected,
  hitSlop = 8,
  style,
  tipBelow,
}: IconButtonProps) {
  const { show, tip } = useTip(label, tipBelow);
  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        onPress={onPress}
        onLongPress={show}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled, selected }}
        style={({ pressed }) => [
          {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bg,
            opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
          },
          diameter ? { width: diameter, height: diameter, borderRadius: radius.pill } : null,
          style,
        ]}
      >
        {children ?? (name ? <Glyph name={name} size={size} color={color} bg={bg === 'transparent' ? colors.card : bg} /> : null)}
      </Pressable>
      {tip}
    </View>
  );
}

/** The round close button used at the top of sheets. */
export function CloseButton({ onPress, label = 'Close' }: { onPress(): void; label?: string }) {
  return <IconButton label={label} name="close" onPress={onPress} size={16} color={colors.subtext} bg={colors.track} diameter={32} tipBelow />;
}
