// Device audio and motion live here; journey settings that should sync stay
// in quest_meta. The one-line AI privacy notice appears before first enable.
import React, { useState } from 'react';
import { Switch, TextInput, View } from 'react-native';

import { useQuestWrites } from '../../../data/itemsRepo';
import { feedback } from '../../../game/feedback';
import { npcName } from '../../../game/content/npcs';
import { PixelButton } from '../../../game/ui/PixelButton';
import { PixelPanel } from '../../../game/ui/PixelPanel';
import { PixelText } from '../../../game/ui/PixelText';
import { QUI } from '../../../game/ui/theme';
import { useDevicePrefs } from '../../../store/devicePrefs';
import { enableSage } from '../../../services/sage';
import type { QuestSettings } from '../../../domain/items/types';
import type { QuestModel } from '../useQuestModel';
import { Row } from './common';

export function QuestSettingsPanel({ model, onCredits, onReplayIntro }: { model: QuestModel; onCredits(): void; onReplayIntro(): void }) {
  const { prefs, setPrefs } = useDevicePrefs();
  const writes = useQuestWrites();
  const settings = model.meta?.props.settings;
  const [showNames, setShowNames] = useState(false);
  const save = (patch: Partial<QuestSettings>) => writes.updateQuestMeta((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const toggleAi = (on: boolean) => {
    if (!settings) return;
    if (!on) { save({ ai: false }); return; }
    enableSage(settings, (next) => save(next));
  };
  return (
    <View style={{ gap: 8 }}>
      <SettingRow icon="S" label="Sound effects" value={prefs.questSfx} onChange={(v) => setPrefs({ questSfx: v })} />
      <SettingRow icon="M" label="Music" value={prefs.questMusic} onChange={(v) => {
        setPrefs({ questMusic: v });
        feedback.music.setBiome(v ? model.game.journey.position.biome : null);
      }} />
      <SettingRow icon="H" label="Haptics" value={prefs.questHaptics} onChange={(v) => setPrefs({ questHaptics: v })} />
      <PixelPanel tone="parchment" padding={2}>
        <Row>
          <PixelText size="sm" bold color={QUI.goldDark}>R</PixelText>
          <PixelText size="sm" style={{ flex: 1 }}>Reduce motion</PixelText>
        </Row>
        <Row style={{ flexWrap: 'wrap' }}>
          {(['system', 'reduce', 'full'] as const).map((value) => (
            <PixelButton key={value} small label={value === 'system' ? 'System' : value === 'reduce' ? 'On' : 'Off'}
              accessibilityLabel={`Reduce motion ${value === 'reduce' ? 'on' : value === 'full' ? 'off' : 'follows system'}`}
              tone={prefs.motion === value ? 'gold' : 'parchment'} onPress={() => setPrefs({ motion: value })} />
          ))}
        </Row>
      </PixelPanel>
      <SettingRow icon="B" label="Battle strip" value={settings?.battleStrip ?? true} onChange={(v) => save({ battleStrip: v })} />
      <SettingRow icon="A" label="AI Sage" value={settings?.ai ?? false} onChange={toggleAi} />
      <PixelButton label="Replay intro" accessibilityLabel="Replay Quest introduction" tone="parchment" onPress={onReplayIntro} />
      <PixelButton label="Credits" accessibilityLabel="View Quest art and license credits" tone="parchment" onPress={onCredits} />
      <PixelButton label="NPC names" accessibilityLabel="Edit NPC names" tone="parchment" onPress={() => setShowNames((v) => !v)} />
      {showNames && (['sage', 'merchant', 'scribe'] as const).map((id) => (
        <NameField key={`${id}:${settings?.npcNames[id] ?? ''}`} id={id} current={settings?.npcNames[id] ?? ''} label={npcName(id)} onSave={(name) => save({ npcNames: { ...settings?.npcNames, [id]: name } })} />
      ))}
      <PixelButton label="Reset NPC names" accessibilityLabel="Reset NPC names to defaults" tone="parchment" onPress={() => save({ npcNames: {} })} />
    </View>
  );
}

function NameField({ id, label, current, onSave }: { id: string; label: string; current: string; onSave(name: string): void }) {
  const [draft, setDraft] = useState(current);
  return (
    <PixelPanel tone="parchment" padding={2}>
      <PixelText size="sm">{label}</PixelText>
      <TextInput value={draft} onChangeText={setDraft} maxLength={24} returnKeyType="done"
        accessibilityLabel={`${id} name`} onEndEditing={() => onSave(draft.trim())}
        style={{ minHeight: 44, color: QUI.ink, fontSize: 16, borderBottomWidth: 1, borderColor: QUI.wood }} />
    </PixelPanel>
  );
}

function SettingRow({ icon, label, value, onChange }: { icon: string; label: string; value: boolean; onChange(v: boolean): void }) {
  return (
    <PixelPanel tone="parchment" padding={2}>
      <Row>
        <PixelText size="sm" bold color={QUI.goldDark}>{icon}</PixelText>
        <PixelText size="sm" style={{ flex: 1 }}>{label}</PixelText>
        <Switch value={value} onValueChange={onChange} accessibilityRole="switch" accessibilityLabel={label} style={{ minWidth: 44, minHeight: 44 }} />
      </Row>
    </PixelPanel>
  );
}
