// Every Skia-drawn screen, loaded at first use. Native: a plain require()
// inside the loader. Metro evaluates the module only when it is called, so Skia
// still stays off the start-up path, and nothing is fetched as a separate
// bundle. In Expo Go a dynamic import() fetches an async chunk through the dev
// server, and once that connection has dropped (phone locked, Metro restarted)
// its HMR client calls window.location.reload(), which doesn't exist on native.
// That was the red screen. Web: screens.web.ts keeps import(), which CanvasKit needs.
/* eslint-disable @typescript-eslint/no-require-imports */

type QuestScreenModule = typeof import('../../screens/Quest/QuestScreen');
type PlaygroundModule = typeof import('../../screens/Quest/Playground');
type SceneModule = typeof import('../../screens/Quest/ceremonies/Scene');
type LootSheetModule = typeof import('../../screens/Quest/session/LootSheet');
type BattleStripModule = typeof import('../../screens/Quest/session/BattleStrip');

export const loadQuestScreen = (): QuestScreenModule => require('../../screens/Quest/QuestScreen');
// Dev builds only: __DEV__ folds to false in production, so the QA tools aren't bundled.
export const loadPlayground = __DEV__ ? (): PlaygroundModule => require('../../screens/Quest/Playground') : null;
export const loadScene = (): SceneModule => require('../../screens/Quest/ceremonies/Scene');
export const loadLootSheet = (): LootSheetModule => require('../../screens/Quest/session/LootSheet');
export const loadBattleStrip = (): BattleStripModule => require('../../screens/Quest/session/BattleStrip');
