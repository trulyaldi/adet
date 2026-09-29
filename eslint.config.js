// Lint: Expo's rules. Quest Mode code must pass with zero errors; everything
// else reports the same rules as warnings, so no unrelated file has to change.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const QUEST = [
  'src/domain/game/**',
  'src/game/**',
  'src/screens/Quest/**',
  'src/services/sage.ts',
  'src/services/sageClient.ts',
  'supabase/functions/**',
];

const warn = (rules) =>
  Object.fromEntries(
    Object.entries(rules ?? {}).map(([name, v]) => {
      const level = Array.isArray(v) ? v[0] : v;
      if (level !== 'error' && level !== 2) return [name, v];
      return [name, Array.isArray(v) ? ['warn', ...v.slice(1)] : 'warn'];
    })
  );

module.exports = defineConfig([
  { ignores: ['dist/**', 'node_modules/**', 'worker/node_modules/**', '.expo/**', 'src/game/assets/frames.generated.ts'] },
  expoConfig,
  // Outside Quest: every error-level rule, as a warning.
  ...expoConfig
    .filter((c) => c.rules)
    .map((c) => ({ ...(c.files ? { files: c.files } : {}), ignores: QUEST, rules: warn(c.rules) })),
]);
