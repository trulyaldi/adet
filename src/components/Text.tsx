// The app's text, in the pixel font (v2 N7.1): React Native's Text and
// TextInput with Tiny5 set first, so every screen takes the pixel look by
// importing these instead of react-native's. Same props and refs. The font has
// one weight and a pixel grid, so weight and letter-spacing are normalised
// (faux bold and squeezed spacing blur the pixels); size and colour still set
// the hierarchy. Tiny5's digits are all one width, so timers never jiggle.

import React, { forwardRef } from 'react';
import { Platform, Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps, TextStyle } from 'react-native';

import { PIXEL_FONT, PIXEL_TEXT } from '../game/assets/fonts';

// Web takes a font stack: the system face (not the browser's serif) while the pixel font loads.
const BASE: TextStyle = { ...PIXEL_TEXT, fontFamily: Platform.OS === 'web' ? `${PIXEL_FONT}, system-ui, sans-serif` : PIXEL_FONT };
const CRISP: TextStyle = { fontWeight: 'normal', letterSpacing: 0 };

export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...rest }, ref) {
  return <RNText ref={ref} {...rest} style={[BASE, style, CRISP]} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  return <RNTextInput ref={ref} {...rest} style={[BASE, style, CRISP]} />;
});
