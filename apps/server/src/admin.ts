import { ITEMS } from '@nam/game-data';
import { ACC_RE, NAME_RE, type AdminAuditEntry } from '@nam/shared';
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
interface Restriction { account: string; muted: boolean; banned?: boolean; revokedTokens?: string[] }
interface AdminState { audit: AdminAuditEntry[]; restrictions: Record<string, Restriction> }
type AuditDocument = AdminAuditEntry[] | AdminState;

export async function createAdmin(
  store: Store,
  configuredUsers: () => string | undefined,
  accounts: WriteOrder,
  disconnect: (accountId: string) => void,
) {
  const order = new WriteOrder();
  const allows = (username: string) => !!username && (configuredUsers() ?? '').split(',')
    .some(user => user.trim().toLowerCase() === username.toLowerCase());

  const readDocument = () => store.get<AuditDocument>(AUDIT_COLLECTION, AUDIT_KEY);
  const entries = (doc: AuditDocument | null) => Array.isArray(doc) ? doc : doc?.audit ?? [];
  const initial = await readDocument();
  let restrictions = Array.isArray(initial) ? {} : initial?.restrictions ?? {};
  const isMuted = (account: Account) => restrictions[account.id]?.muted ?? false;
  const isBanned = (account: Account) => restrictions[account.id]?.banned ?? account.banned ?? false;
  const mayResume = (account: Account, hash: string) => !isBanned(account) && !restrictions[account.id]?.revokedTokens?.includes(hash);

  async function record(entry: AdminAuditEntry, next = restrictions) {
    const previous = await readDocument();
    const audit = [entry, ...entries(previous)].slice(0, AUDIT_LIMIT);
    // A moderation change and its audit entry share a single durable write.
    const document = Object.keys(next).length ? { audit, restrictions: next } : audit;
    try {
      await store.put(AUDIT_COLLECTION, AUDIT_KEY, document);
      await store.flush();
    } catch (error) {
      // File storage changes its in-memory document before flushing.
      if (store.kind === 'file') {
        if (previous) await store.put(AUDIT_COLLECTION, AUDIT_KEY, previous);
        else await store.del(AUDIT_COLLECTION, AUDIT_KEY);
      }
      throw error;
    }
    restrictions = next;
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
          restrictions: Object.values(restrictions).filter(r => r.muted || r.banned)
            .map(({ account, muted, banned }) => ({ account, muted, banned: !!banned })),
          audit: entries(await readDocument()).slice(0, RECENT_LIMIT),
        };
      }
      if (request.cmd === 'backup') return { dir: 'siehe Server-Log' };

      // Persist the authorized request before applying any change.
      const log = (action: AdminAuditEntry['action'], detail?: string, target?: string, next?: AdminState['restrictions']) =>
        record({
          id: uid('audit'), at: now(), actor: actor.name, action,
          ...(detail !== undefined && { detail }),
          ...(target !== undefined && { target })
        }, next);
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
      const cmd = request.cmd;
      if (cmd === 'mute' || cmd === 'unmute' || cmd === 'ban' || cmd === 'unban') {
        const name = typeof request.name === 'string' ? request.name.trim() : '';
        const accountName = typeof request.account === 'string' ? request.account.trim() : '';
        const character = typeof request.target === 'string' ? G.chars.get(request.target) :
          !accountName && NAME_RE.test(name) ? [...G.chars.values()].find(c => c.name.toLowerCase() === name.toLowerCase()) : undefined;
        const accountKey = character
          ? (G.players.get(character.id)?.acc ?? (await store.all<Account>('accounts')).find(a => a.id === character.accountId))?.name.toLowerCase()
          : request.target === undefined && ACC_RE.test(accountName) ? accountName.toLowerCase() : undefined;
        if (!accountKey) return 'Account nicht gefunden';
        return accounts.run(accountKey, async () => {
          const account = await store.get<Account>('accounts', accountKey);
          if (!account || (character && account.id !== character.accountId)) return 'Account nicht gefunden';
          if (!allows(actor.name) || !await validSession() || !allows(actor.name)) return NO_ACCESS;
          if (cmd === 'ban' && actor.id === account.id) return 'Der eigene Account kann nicht gesperrt werden.';
          const current = restrictions[account.id];
          const restriction: Restriction = { ...(current ?? { account: account.name, muted: false }) };
          if (cmd === 'mute' || cmd === 'unmute') {
            if (restriction.muted === (cmd === 'mute')) return 'Die Chat-Sperre ist bereits im gewünschten Zustand.';
            restriction.muted = cmd === 'mute';
          } else {
            if (isBanned(account) === (cmd === 'ban')) return 'Die Account-Sperre ist bereits im gewünschten Zustand.';
            restriction.banned = cmd === 'ban';
            if (cmd === 'ban') restriction.revokedTokens = account.tokens.filter(t => t.exp > now()).map(t => t.h);
          }
          const next = { ...restrictions, [account.id]: restriction };
          if (!restriction.muted && !restriction.banned && !account.banned && !restriction.revokedTokens?.length) delete next[account.id];
          await log(cmd, character ? `Charakter ${character.name}` : undefined, account.name, next);
          if (cmd === 'ban') disconnect(account.id);
          return {};
        });
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

  return { allows, handle, isMuted, isBanned, mayResume };
}
