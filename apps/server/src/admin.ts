import { ITEMS } from '@nam/game-data';
import { NAME_RE, type AdminAuditEntry } from '@nam/shared';
import { saveCharacter } from './character-save';
import { invAdd } from './chars';
import { respawnAll } from './game';
import { G, now, send, sys, uid, type Account } from './state';
import type { Store } from './store';
import { WriteOrder } from './write-order';

const AUDIT_COLLECTION = 'admin_audit';
const AUDIT_KEY = 'latest';
const AUDIT_LIMIT = 200;
const RECENT_LIMIT = 20;
const ROSTER_LIMIT = 100;
const NO_ACCESS = 'Keine Berechtigung';
type AdminRequest = Record<string, unknown>;

export function createAdmin(store: Store, configuredUsers: () => string | undefined) {
  const order = new WriteOrder();
  const allows = (username: string) => !!username && (configuredUsers() ?? '').split(',')
    .some(user => user.trim().toLowerCase() === username.toLowerCase());

  const readAudit = async () => (await store.get<AdminAuditEntry[]>(AUDIT_COLLECTION, AUDIT_KEY)) ?? [];

  async function record(entry: AdminAuditEntry) {
    const previous = await readAudit();
    try {
      await store.put(AUDIT_COLLECTION, AUDIT_KEY, [entry, ...previous].slice(0, AUDIT_LIMIT));
      await store.flush();
    } catch (error) {
      // File storage changes its in-memory document before flushing.
      if (store.kind === 'file') await store.put(AUDIT_COLLECTION, AUDIT_KEY, previous);
      throw error;
    }
  }

  async function handle(actor: Account, request: AdminRequest, validSession: () => Promise<boolean>) {
    return order.run('admin', async () => {
      if (!allows(actor.name) || !await validSession() || !allows(actor.name)) return NO_ACCESS;

      const players = [...G.players.values()].filter(player => player.online && player.ws.readyState === 1);
      const stats = { online: players.length, tickMs: G.stats.tickMs, msgs: G.stats.msgs };
      if (request.cmd === 'stats') return stats;
      if (request.cmd === 'dashboard') {
        return {
          ...stats, saves: G.stats.saves, uptime: Math.floor((now() - G.startedAt) / 1000), store: store.kind,
          players: players.slice(0, ROSTER_LIMIT).map(p => ({ id: p.id, name: p.c.name, level: p.c.level })),
          audit: (await readAudit()).slice(0, RECENT_LIMIT),
        };
      }
      if (request.cmd === 'backup') return { dir: 'siehe Server-Log' };

      // Persist the authorized request before applying any change.
      const log = (action: AdminAuditEntry['action'], detail?: string, target?: string) =>
        record({
          id: uid('audit'), at: now(), actor: actor.name, action,
          ...(detail !== undefined && { detail }),
          ...(target !== undefined && { target })
        });
      if (request.cmd === 'announce') {
        const text = typeof request.text === 'string' ? request.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200) : '';
        if (!text) return 'Bitte eine Ankündigung eingeben.';
        await log('announce', text);
        if (!allows(actor.name)) return NO_ACCESS;
        for (const p of G.players.values()) sys(p, '📢 ' + text, 'boss');
        return {};
      }
      if (request.cmd === 'respawn') {
        await log('respawn');
        if (!allows(actor.name)) return NO_ACCESS;
        respawnAll();
        return {};
      }
      if (request.cmd !== 'kick' && request.cmd !== 'gold' && request.cmd !== 'give') return 'Unbekannter Admin-Befehl';

      const name = typeof request.name === 'string' && NAME_RE.test(request.name.trim()) ? request.name.trim().toLowerCase() : '';
      const player = typeof request.target === 'string' ? G.players.get(request.target) : G.byName.get(name);
      const current = () => player?.online && player.ws.readyState === 1 && G.players.get(player.id) === player;
      if (!player || !current()) return 'Spieler offline';
      const target = player.c.name;
      if (request.cmd === 'kick') {
        await log('kick', undefined, target);
        if (!allows(actor.name)) return NO_ACCESS;
        if (!current()) return 'Spieler offline';
        send(player, { t: 'kicked' });
        player.ws.close();
        return {};
      }

      const raw = request.n ?? (request.cmd === 'give' ? 1 : 0);
      const amount = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
      if (!Number.isSafeInteger(amount)) return 'Ungültige Menge';
      if (request.cmd === 'gold') {
        const validGold = () => Number.isSafeInteger(player.c.gold + amount) && player.c.gold + amount >= 0;
        if (!validGold()) return 'Ungültiger Goldbestand';
        await log('gold', String(amount), target);
        if (!allows(actor.name)) return NO_ACCESS;
        if (!current()) return 'Spieler offline';
        if (!validGold()) return 'Ungültiger Goldbestand';
        player.c.gold += amount;
      } else {
        const item = request.id;
        if (typeof item !== 'string' || !Object.prototype.hasOwnProperty.call(ITEMS, item) || amount <= 0) return 'Ungültiger Gegenstand oder Menge';
        await log('give', item + ' × ' + amount, target);
        if (!allows(actor.name)) return NO_ACCESS;
        if (!current()) return 'Spieler offline';
        invAdd(player.c, item, amount);
      }
      await saveCharacter(player, true);
      send(player, { t: 'char', c: player.c });
      return {};
    });
  }

  return { allows, handle };
}
