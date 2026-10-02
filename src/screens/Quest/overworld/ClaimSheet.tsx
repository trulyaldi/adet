// Claim a slot on the Overworld (world-5): a name and an icon, nothing else.
// The same sheet renames a claimed realm (name only; the icon stays).

import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../components/Icon';
import { TextInput } from '../../../components/Text';
import { ICONS } from '../../../domain/constants';
import { PROJECT_ICONS } from '../../../domain/look';
import type { IconKey } from '../../../domain/types';
import { REALM_NAME_MAX } from '../../../domain/world/types';
import { PixelButton } from '../../../game/ui/PixelButton';
import { QUI } from '../../../game/ui/theme';
import { inputStyle } from '../realm/QuestNodeSheet';
import { QuestSheet, Row } from '../sheets/common';

export function ClaimSheet({
  rename,
  reduced,
  onClose,
  onDone,
}: {
  /** Renaming this realm (its current name), instead of claiming. */
  rename?: string;
  reduced: boolean;
  onClose(): void;
  onDone(name: string, icon: IconKey): void;
}) {
  const [name, setName] = useState(rename ?? '');
  const [icon, setIcon] = useState<IconKey>('target');
  const ok = !!name.trim();
  const done = () => ok && onDone(name, icon);
  return (
    <QuestSheet visible title={rename ? 'Rename' : 'A new realm'} onClose={onClose} reduced={reduced}>
      <Row>
        <TextInput
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={REALM_NAME_MAX}
          returnKeyType="done"
          onSubmitEditing={done}
          placeholder="Name it"
          placeholderTextColor={QUI.muted}
          accessibilityLabel="The realm's name"
          style={inputStyle}
        />
      </Row>
      {!rename && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityRole="radiogroup">
          {PROJECT_ICONS.map((k) => {
            const on = k === icon;
            return (
              <Pressable
                key={k}
                onPress={() => setIcon(k)}
                accessibilityRole="radio"
                accessibilityLabel={`Icon ${k}`}
                accessibilityState={{ selected: on }}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? QUI.ink : 'transparent', backgroundColor: on ? QUI.goldLight : QUI.parchmentDark }}
              >
                <Icon path={ICONS[k]} size={22} color={QUI.ink} />
              </Pressable>
            );
          })}
        </View>
      )}
      <Row>
        <PixelButton label={rename ? 'Save' : 'Claim'} accessibilityLabel={rename ? 'Save the name' : 'Claim this realm'} disabled={!ok} onPress={done} style={{ flex: 1 }} />
      </Row>
    </QuestSheet>
  );
}
