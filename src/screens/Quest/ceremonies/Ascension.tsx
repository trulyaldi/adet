import React from 'react';
import { View } from 'react-native';

import type { AvatarLook } from '../../../game/avatar';
import { feedback } from '../../../game/feedback';
import { Avatar } from '../../../game/render/Avatar';
import { useGameClock } from '../../../game/render/clock';
import { Particles } from '../../../game/render/Particles';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { CeremonyStage, useCeremonySize } from './Stage';

export function Ascension({ loop, look, onDone, reduced }: { loop: number; look: AvatarLook; onDone(): void; reduced: boolean }) {
  const { worldW, worldH } = useCeremonySize();
  const clock = useGameClock(!reduced);
  React.useEffect(() => { feedback.haptic('success', 'ceremony'); }, []);
  return (
    <CeremonyStage background={QUI.night} onTap={onDone} label={`Ascension ${loop}`} scene={
      !reduced && <Particles kind="stars" x={0} y={0} w={worldW} h={worldH} count={70} clock={clock} />
    }>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Avatar tier={look.tier} gear={look.gear} stars={loop} animation="cheer" scale={4} animate={!reduced} accessibilityLabel={`Avatar with ${loop} ascension star`} />
        <PixelText size="xl" bold color={QUI.goldLight} accessibilityRole="header">Ascension {loop}</PixelText>
        <PixelButton label="Continue" accessibilityLabel="Continue the journey" onPress={onDone} />
      </View>
    </CeremonyStage>
  );
}
