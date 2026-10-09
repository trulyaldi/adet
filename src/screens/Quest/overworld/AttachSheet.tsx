// The attach choice (projects as realms): a realm claimed by hand before
// realms came from projects asks which project it is, once. One tap on a
// project links it; Skip keeps the realm as it is. Closing the sheet answers
// nothing and asks again next time. Nothing is deleted either way.

import React from 'react';
import { Pressable } from 'react-native';

import { Icon } from '../../../components/Icon';
import { ICONS } from '../../../domain/constants';
import { projectLook } from '../../../domain/look';
import type { ProjectRef, Realm } from '../../../domain/world/types';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { QuestSheet, Row } from '../sheets/common';

export function AttachSheet({
  realm,
  candidates,
  reduced,
  onPick,
  onSkip,
  onClose,
}: {
  realm: Pick<Realm, 'name' | 'icon'>;
  candidates: readonly ProjectRef[];
  reduced: boolean;
  onPick(projectId: string): void;
  onSkip(): void;
  onClose(): void;
}) {
  return (
    <QuestSheet visible title={realm.name} onClose={onClose} reduced={reduced}>
      <Row style={{ flexWrap: 'wrap' }}>
        {candidates.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onPick(p.id)}
            accessibilityRole="button"
            accessibilityLabel={`This realm is ${p.name}`}
            style={{ minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: QUI.ink, backgroundColor: QUI.parchmentDark }}
          >
            <Icon path={ICONS[projectLook(p).icon]} size={18} color={QUI.ink} />
            <PixelText size="md" numberOfLines={1} style={{ maxWidth: 180 }}>
              {p.name}
            </PixelText>
          </Pressable>
        ))}
      </Row>
      <Row>
        <PixelButton small tone="parchment" label="Skip" accessibilityLabel="Keep this realm as it is" onPress={onSkip} />
      </Row>
    </QuestSheet>
  );
}
