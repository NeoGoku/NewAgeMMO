import type { Character } from '@nam/shared';
import { deferMessages, G, send, type Player } from './state';

const characterTransactions = new Map<string, Promise<void>>();

export function pendingCharacterTransaction(id: string) { return characterTransactions.get(id); }

export async function saveCharacterDocument(c: Character) {
  let pending: Promise<void> | undefined;
  while ((pending = pendingCharacterTransaction(c.id))) await pending;
  await G.store.put('chars', c.id, c);
}

export async function commitCharacterChanges(characters: readonly Character[], apply: () => void) {
  const ids = characters.map(c => c.id);
  if (ids.some(id => pendingCharacterTransaction(id))) return false;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  for (const id of ids) characterTransactions.set(id, pending);
  try {
    await G.store.putCharacters(characters);
    apply();
    G.stats.saves += ids.length;
    return true;
  } finally {
    for (const id of ids) characterTransactions.delete(id);
    release();
  }
}

export async function saveCharacter(p: Player, flush = false) {
  p.dirty = false;
  try {
    await saveCharacterDocument(p.c);
    if (flush) await G.store.flush();
    G.stats.saves++;
  } catch (error) {
    p.dirty = true;
    throw error;
  }
}

const rewards = new WeakMap<Player, Promise<void>>();
export function pendingReward(p: Player) { return rewards.get(p); }
export function publishProgress(p: Player, update?: () => void, afterSave?: () => void) {
  const notify = update && deferMessages(p, update);
  const snapshot = structuredClone(p.c);
  const saved = saveCharacter(p, true);
  rewards.set(p, saved);
  void saved.then(
    () => {
      notify?.();
      if (p.online) afterSave?.();
      send(p, { t: 'char', c: snapshot });
    },
    error => console.error('character_progress_save', error)
  ).finally(() => {
    if (rewards.get(p) === saved) rewards.delete(p);
  });
}
