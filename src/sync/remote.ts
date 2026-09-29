// Network side of sync, bound to the app's Supabase client (see remoteCore.ts).

import type { Change, SyncTable } from '../domain/sync';
import { pullChangesWith, pushChangesWith } from './remoteCore';
import { supabase } from './supabase';

export const pushChanges = (changes: Change[], userId: string, onConfirmed: (confirmed: Change[]) => void) =>
  pushChangesWith(supabase, changes, userId, onConfirmed);

export const pullChanges = (cursors: Partial<Record<SyncTable, number>>, userId: string) => pullChangesWith(supabase, cursors, userId);
