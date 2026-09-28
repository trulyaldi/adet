import { TextStyle } from 'react-native';

import { Colors, radius as radii } from './theme';

/** A text field on a sheet. */
export function inputStyle(colors: Colors, radius: typeof radii = radii): TextStyle {
  return {
    width: '100%',
    backgroundColor: colors.well,
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
  };
}
