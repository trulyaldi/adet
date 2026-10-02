// Web: Skia-drawn screens load as async chunks, after CanvasKit (see SkiaGate.web.tsx).
// Native loads them with require() instead (screens.ts explains why).

export const loadQuestScreen = () => import('../../screens/Quest/QuestScreen');
// Dev builds only: __DEV__ folds to false in production, so the QA tools aren't bundled.
export const loadPlayground = __DEV__ ? () => import('../../screens/Quest/Playground') : null;
export const loadScene = () => import('../../screens/Quest/ceremonies/Scene');
export const loadLootSheet = () => import('../../screens/Quest/session/LootSheet');
export const loadStage = () => import('../../screens/Quest/session/TimerStage');
export const loadResultSheet = () => import('../../screens/Quest/session/ResultSheet');
export const loadCharacterArt = () => import('./CharacterArt');
