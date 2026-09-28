import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { feedback } from '../feedback/feedback';
import { useTheme } from '../theme/ThemeProvider';
import { EDGE } from '../theme/theme';
import { GLYPH_STROKE, GLYPHS, GlyphName, GlyphPart } from './glyphs';
import { usePressMotion } from './motion/Press';

export type { GlyphName } from './glyphs';

interface GlyphProps {
  name: GlyphName;
  size?: number;
  /** The glyph color (the `currentColor` of the set); defaults to ink. */
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
export function Glyph({ name, size = 20, color, bg, label }: GlyphProps) {
  const { colors } = useTheme();
  const ink = color ?? colors.ink;
  const back = bg ?? colors.card;
  const svg = (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {(GLYPHS[name] as GlyphPart[]).map((p, i) => {
        const c = p.knockout ? back : ink;
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
 * icon-only control shows its label. It opens above the control; controls on
 * a top edge pass `below`.
 */
export function useTip(label: string, below = false) {
  const { colors, radius } = useTheme();
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
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: colors.bg }}>
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
  /** Button face color; transparent by default. */
  bg?: string;
  /**
   * `chunky`: a tactile button with a darker bottom edge that compresses on
   * press (pass `edge`, or it's derived from the face). `plain`: flat, with
   * a small squash on press.
   */
  variant?: 'plain' | 'chunky';
  /** The bottom edge color of a chunky button. */
  edge?: string;
  /** Width and height of a round button; omit to size to the content. */
  diameter?: number;
  disabled?: boolean;
  selected?: boolean;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
  /** Open the tooltip below instead of above (controls on a top edge). */
  tipBelow?: boolean;
  /** Skip the tap sound/haptic (the action plays its own). */
  quiet?: boolean;
}

/** An icon-only control with an accessibility label and a long-press tooltip. */
export function IconButton({
  label,
  onPress,
  name,
  children,
  size = 20,
  color,
  bg = 'transparent',
  variant = 'plain',
  edge,
  diameter,
  disabled,
  selected,
  hitSlop = 8,
  style,
  tipBelow,
  quiet,
}: IconButtonProps) {
  const { colors, radius, dark } = useTheme();
  const { show, tip } = useTip(label, tipBelow);
  const chunky = variant === 'chunky' && !disabled;
  const press = usePressMotion('icon', { disabled, edge: chunky, opacity: disabled ? 0.35 : 1 });
  const edgeColor = edge ?? (bg === 'transparent' ? colors.line : dark ? colors.line : colors.track);
  const content = children ?? (name ? <Glyph name={name} size={size} color={color ?? colors.ink} bg={bg === 'transparent' ? colors.card : bg} /> : null);
  const shape: ViewStyle = diameter ? { width: diameter, height: diameter, borderRadius: radius.pill } : {};
  const flat = (style ?? {}) as ViewStyle;
  const r = shape.borderRadius ?? (flat.borderRadius as number | undefined) ?? radius.md;

  return (
    <View style={{ position: 'relative' }}>
      <Pressable
        onPress={() => {
          // Chunky icon buttons are actions (start, done, add): a light haptic. Plain ones navigate: sound only.
          if (!quiet) feedback('tap', { haptic: chunky });
          onPress();
        }}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onLongPress={show}
        delayLongPress={450}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled, selected }}
        style={chunky ? { paddingBottom: EDGE } : undefined}
      >
        {chunky && (
          <View
            style={[
              shape,
              flat,
              { position: 'absolute', left: 0, right: 0, top: EDGE, bottom: 0, backgroundColor: edgeColor, borderRadius: r, padding: 0 },
            ]}
          />
        )}
        <Animated.View
          style={[
            { alignItems: 'center', justifyContent: 'center', backgroundColor: bg, opacity: disabled ? 0.35 : 1 },
            shape,
            style,
            press.style,
          ]}
        >
          {content}
        </Animated.View>
      </Pressable>
      {tip}
    </View>
  );
}

/** The round close button used at the top of sheets. */
export function CloseButton({ onPress, label = 'Close' }: { onPress(): void; label?: string }) {
  const { colors } = useTheme();
  return <IconButton label={label} name="close" onPress={onPress} size={16} color={colors.sub} bg={colors.well} diameter={34} tipBelow />;
}
