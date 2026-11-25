import crypto from 'node:crypto';
import { ACC_RE } from '@nam/shared';
import { G, now, uid, type Account } from './state';
const scrypt = (pw: string, salt: string) => crypto.scryptSync(pw, salt, 32, { N: 16384 }).toString('hex');
const hex = (t: string) => [...new TextEncoder().encode(t)].map(b => b.toString(16).padStart(2, '0')).join(''); const unhex = (h: string) => { try { return new TextDecoder().decode(new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)))); } catch { return ''; } };
const safeEq = (a: string, b: string) => { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const fails = new Map<string, { n: number; until: number }>();
export async function register(user: string, pw: string): Promise<{ acc?: Account; token?: string; err?: string }> {
  if (!ACC_RE.test(user)) return { err: 'Benutzername: 3–20 Zeichen (A–Z, 0–9, _ -)' }; if (typeof pw !== 'string' || pw.length < 6 || pw.length > 64) return { err: 'Passwort: 6–64 Zeichen' };
  const key = user.toLowerCase(); if (await G.store.get('accounts', key)) return { err: 'Benutzername bereits vergeben' };
  const salt = crypto.randomBytes(16).toString('hex'); const acc: Account = { id: uid('a'), name: user, hash: scrypt(pw, salt), salt, created: now(), tokens: [], admin: ((((globalThis as any).process?.env?.ADMIN_USERS) || '').split(',').map((s: string) => s.trim().toLowerCase()).includes(key)) };
  const token = mkToken(acc); await G.store.put('accounts', key, acc); return { acc, token };
}
export async function login(user: string, pw: string, ip: string): Promise<{ acc?: Account; token?: string; err?: string }> {
  const key = String(user || '').toLowerCase(); const f = fails.get(key + ip) || fails.get(key); if (f && f.until > now()) return { err: 'Zu viele Fehlversuche. Bitte kurz warten.' };
  const acc = await G.store.get<Account>('accounts', key); const ok = acc && typeof pw === 'string' && safeEq(scrypt(pw, acc.salt), acc.hash);
  if (!ok || !acc) { const n = (fails.get(key)?.n || 0) + 1; fails.set(key, { n, until: n >= 5 ? now() + 30000 : 0 }); return { err: 'Benutzername oder Passwort falsch' }; }
  if (acc.banned) return { err: 'Account gesperrt' }; fails.delete(key); const token = mkToken(acc); await G.store.put('accounts', key, acc); return { acc, token };
}
export async function resume(token: string): Promise<{ acc?: Account; err?: string }> {
  if (typeof token !== 'string' || token.length < 20) return { err: 'Sitzung ungültig' }; const [name] = token.split('.'); const acc = await G.store.get<Account>('accounts', unhex(name || ''));
  if (!acc || acc.banned) return { err: 'Sitzung ungültig' }; const h = sha(token); const t = acc.tokens.find(x => x.h === h && x.exp > now()); return t ? { acc } : { err: 'Sitzung abgelaufen' };
}
function mkToken(acc: Account) { const token = hex(acc.name.toLowerCase()) + '.' + crypto.randomBytes(24).toString('hex'); acc.tokens = acc.tokens.filter(t => t.exp > now()).slice(-4); acc.tokens.push({ h: sha(token), exp: now() + 30 * 864e5 }); return token; }
