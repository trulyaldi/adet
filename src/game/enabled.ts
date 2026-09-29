// Quest Mode's kill switch. EXPO_PUBLIC_QUEST_ENABLED=false removes the
// Quest tab and every session hook; the app behaves as it did before.
// Default on. (Static `process.env.EXPO_PUBLIC_…` access: Expo inlines it.)

/** Off only for an explicit false-like value; unset or anything else is on. */
export function questEnabledFrom(raw: string | undefined): boolean {
  return !/^(0|false|off|no)$/i.test((raw ?? '').trim());
}

export const QUEST_ENABLED = questEnabledFrom(process.env.EXPO_PUBLIC_QUEST_ENABLED);
