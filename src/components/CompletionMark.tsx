import React from 'react';
import { View } from 'react-native';

import { Completion } from '../domain/plan';
import { colors, radius } from '../theme/tokens';
import { Glyph } from './Glyph';

export const DONE_GREEN = '#1F8A3B';

interface CompletionMarkProps {
  mark: Completion | null;
  /** Done outside the day's plan: a small plus badge on the check. */
  bonus?: boolean;
  size?: number;
  bg?: string;
}

/**
 * A habit-day's completion: a solid check for a full session, a hollow check
 * for the minimum (shape, not only color), plus a small badge when it was a
 * bonus. Nothing at all when it wasn't done: never a failure mark.
 */
export function CompletionMark({ mark, bonus, size = 18, bg = colors.card }: CompletionMarkProps) {
  if (!mark) return null;
  const label = (mark === 'full' ? 'Done, full session' : 'Done, minimum session') + (bonus ? ', bonus' : '');
  return (
    <View accessible accessibilityLabel={label} style={{ width: size + 4, height: size + 2, justifyContent: 'center' }}>
      <Glyph name={mark === 'full' ? 'done' : 'doneMin'} size={size} color={DONE_GREEN} bg={bg} />
      {bonus && (
        <View
          style={{
            position: 'absolute',
            right: -3,
            top: -3,
            width: size * 0.62,
            height: size * 0.62,
            borderRadius: radius.pill,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Glyph name="bonus" size={size * 0.58} color={DONE_GREEN} bg={bg} />
        </View>
      )}
    </View>
  );
}
