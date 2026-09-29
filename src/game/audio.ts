// Quest audio: a licensed pack can be mapped here when added. The existing
// UI tap is the only available Quest SFX today; other IDs are silent no-ops.
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { AppState } from 'react-native';

import { hasSfxFile, SfxId } from './feedback/gate';

const sources: Partial<Record<SfxId, number>> = { ui_tap: require('../../assets/sounds/tap.wav') };
const players: Partial<Record<SfxId, AudioPlayer>> = {};
let configured = false;

function prepare() {
  if (!configured) {
    configured = true;
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
  }
  for (const [id, source] of Object.entries(sources) as [SfxId, number][]) {
    if (players[id]) continue;
    try { players[id] = createAudioPlayer(source); } catch { /* silent fallback */ }
  }
}

export const preloadQuestSounds = prepare;

AppState.addEventListener('change', (state) => {
  if (state !== 'active') {
    for (const p of Object.values(players)) p?.remove();
    for (const id of Object.keys(players) as SfxId[]) delete players[id];
  }
});

export function playQuestSound(id: SfxId): void {
  if (!hasSfxFile(id)) return;
  prepare();
  const p = players[id];
  if (!p) return;
  try { p.seekTo(0).catch(() => {}); p.play(); } catch { /* silent fallback */ }
}

// No music files are present in the licensed pack folder yet. Keep the API
// ready without inserting synthetic audio into the player's focus flow.
export function setQuestMusicBiome(_id: string | null): void {}
