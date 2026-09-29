// The Quest tab's entry: the map loads lazily (Skia never runs at app start).
// Until the server has Quest Mode's tables (migration 006) the tab shows a
// friendly note instead, and nothing is written.

import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Glyph } from '../../components/Glyph';
import { SkiaGate } from '../../game/render/SkiaGate';
import { useQuestTables } from '../../sync/questTables';
import { useTheme } from '../../theme/ThemeProvider';

function Note({ title, body, busy }: { title: string; body: string; busy?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: colors.bg }}>
      {busy ? <ActivityIndicator color={colors.sub} /> : <Glyph name="quest" size={40} color={colors.sub} label={title} />}
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 15, color: colors.sub, textAlign: 'center', maxWidth: 300 }}>{body}</Text>
    </View>
  );
}

const loadQuestScreen = () => import('./QuestScreen');
const loadPlayground = () => import('./Playground');

export function QuestTab() {
  const tables = useQuestTables();
  const [playground, setPlayground] = useState(false);
  if (tables === 'missing') {
    return <Note title="The journey is almost ready" body={__DEV__ ? 'Run supabase/migrations/006_quest.sql in the Supabase SQL editor, then come back.' : 'Quest Mode is still being set up. Your focus time is safe and will count.'} />;
  }
  if (tables === 'unknown') return <Note title="Finding the path…" body="Connecting once to set up the journey." busy />;
  const fallback = <Note title="Finding the path…" body="" busy />;
  return (
    <>
      <SkiaGate load={loadQuestScreen} props={{ onPlayground: () => setPlayground(true) }} fallback={fallback} />
      {__DEV__ && playground && <SkiaGate load={loadPlayground} props={{ onClose: () => setPlayground(false) }} />}
    </>
  );
}
