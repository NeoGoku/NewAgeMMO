import { deferMessages, G, send, type Player } from './state';

export async function saveCharacter(p: Player, flush = false) {
  p.dirty = false;
  try {
    await G.store.put('chars', p.id, p.c);
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
