// Naming a free session (Projects as Realms): a long session started without
// a quest, in a project that has a realm, may say what it was for after the
// fact. The realm's open quests as chips, one text field for a new mob, and a
// visible Skip. Plain React Native (no Skia), so the result sheet and its
// fallback share it. Nothing here is required, timed or repeated.

import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { TextInput } from '../../../components/Text';
import { useSessionTarget, WorldWrites } from '../../../data/worldRepo';
import { liveWorld } from '../../../domain/world/select';
import { QUEST_TITLE_MAX } from '../../../domain/world/types';
import { SessionTarget, targetOf } from '../../../domain/world/target';
import { PIXEL_FONT, PIXEL_TEXT } from '../../../game/assets/fonts';
import { createLatch } from '../../../game/state/latch';
import type { ResultRequest } from '../../../game/state/result';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useData } from '../../../store/StreakStore';

// The same field as the Realm's sheets (QuestNodeSheet's, which would pull Skia into start-up).
const inputStyle = { flex: 1, minHeight: 44, paddingHorizontal: 10, backgroundColor: QUI.white, color: QUI.ink, ...PIXEL_TEXT, fontFamily: PIXEL_FONT, fontSize: 16, borderWidth: 2, borderColor: QUI.ink };

/**
 * The fight a result is told on. Already known for a session that had a quest;
 * for a naming step it is set once, when the picked or new quest shows up in
 * the world, and then stays as it was (a Done clears the quest, which must not
 * take the Stage away mid-swing). `create` is false when nothing was written.
 */
export function useNamedTarget(req: ResultRequest, world: WorldWrites) {
  const [session, setSession] = useState<SessionTarget | null>(req.target);
  const [pending, setPending] = useState<string | null>(null);
  // One choice per sheet, even on a double tap.
  const [chosen] = useState(createLatch);
  const live = useSessionTarget(pending);
  const { items } = useData();
  // Taken once, while rendering (the "adjust state on a change" pattern), then left alone.
  if (!session && live) setSession(live);
  return {
    session,
    pick(questId: string) {
      // A quest that has gone since the sheet opened (another device) can't be told: the tap does nothing, and the others still work.
      if (!targetOf(liveWorld(items), questId)) return;
      if (chosen.take()) setPending(questId);
    },
    create(title: string): boolean {
      const realmId = req.naming?.realm.id;
      if (!realmId || !chosen.take()) return true;
      const id = world.addQuest(realmId, title);
      if (!id) return false;
      setPending(id);
      return true;
    },
  };
}

export function NamingStep({ req, onPick, onCreate, onSkip }: { req: ResultRequest; onPick(questId: string): void; onCreate(title: string): void; onSkip(): void }) {
  const naming = req.naming;
  const [text, setText] = useState('');
  const ok = !!text.trim();
  const add = () => ok && onCreate(text);
  return (
    <View style={{ gap: 10, alignSelf: 'stretch' }}>
      <PixelText size="md" bold numberOfLines={1} style={{ textAlign: 'center' }}>
        {naming?.realm.name ?? ''}
      </PixelText>
      <PixelText size="sm" color={QUI.wood} style={{ textAlign: 'center' }}>
        What was it for?
      </PixelText>
      {!!naming?.quests.length && (
        <ScrollView style={{ maxHeight: 132, flexGrow: 0 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} keyboardShouldPersistTaps="handled">
          {naming.quests.map((q) => (
            <Pressable
              key={q.id}
              onPress={() => onPick(q.id)}
              accessibilityRole="button"
              accessibilityLabel={q.title}
              style={{ minHeight: 44, maxWidth: '100%', justifyContent: 'center', paddingHorizontal: 10, borderWidth: 2, borderColor: QUI.ink, backgroundColor: QUI.parchmentDark }}
            >
              <PixelText size="sm" numberOfLines={1}>
                {q.title}
              </PixelText>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          maxLength={QUEST_TITLE_MAX}
          returnKeyType="done"
          onSubmitEditing={add}
          placeholder="Something new"
          placeholderTextColor={QUI.muted}
          accessibilityLabel="A new quest in this realm"
          style={inputStyle}
        />
        <PixelButton small label="Add" accessibilityLabel="Add this quest" disabled={!ok} onPress={add} />
      </View>
      <PixelButton small tone="parchment" label="Skip" accessibilityLabel="Skip, leave it a free session" onPress={onSkip} style={{ alignSelf: 'center' }} />
    </View>
  );
}
