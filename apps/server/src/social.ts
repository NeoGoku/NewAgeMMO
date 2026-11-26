import { saveCharacterDocument } from './character-save';
import { BAL, type ItemInst } from '@nam/shared';
import { ITEMS, LOCS } from '@nam/game-data';
import { G, now, uid, send, sys, toLoc, type Player, type Guild, type Party } from './state';
import { H } from './handlers';
import { takeUid, giveInst, recalc } from './chars';
import { leaveDungeon } from './world';
import { guildLevel, canPvp, locOf } from './game';
const S = (v: any, n = 64) => (typeof v === 'string' ? v.slice(0, n) : '');
const clean = (t: string) => t.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 200);
const find = (n: string) => G.byName.get(S(n, 16).toLowerCase());
const findOn = (n: string) => { const p = find(n); return p && p.online ? p : undefined; };
// ---- Chat ----
H.chat = (p, m) => {
  const text = clean(S(m.text, 300)); if (!text) return; if (now() - p.lastChat < 600) return 'Langsamer!'; p.lastChat = now(); const ch = S(m.ch, 8); const msg = { t: 'chat', ch, from: p.c.name, text, at: now(), cls: p.c.cls };
  if (ch === 'local') { if (p.houseId) { for (const q of G.houseOcc.get(p.houseId) || []) send(q, msg); } else toLoc(locOf(p), msg); }
  else if (ch === 'party') { if (!p.partyId) return 'Keine Gruppe'; for (const id of G.parties.get(p.partyId)!.members) send(G.players.get(id), msg); }
  else if (ch === 'guild') { const g = p.c.guildId && G.guilds.get(p.c.guildId); if (!g) return 'Keine Gilde'; for (const id of Object.keys(g.members)) send(G.players.get(id), msg); }
  else if (ch === 'global') { if (now() - ((p as any).lastGlobal || 0) < 4000) return 'Weltchat: kurz warten'; (p as any).lastGlobal = now(); for (const q of G.players.values()) send(q, msg); }
  else if (ch === 'whisper') { const to = findOn(m.to); if (!to) return 'Spieler nicht online'; send(to, { ...msg, to: to.c.name }); send(p, { ...msg, to: to.c.name }); }
  else return 'Kanal unbekannt';
};
// ---- Freunde ----
H.friendAdd = (p, m) => { const q = [...G.chars.values()].find(c => c.name.toLowerCase() === S(m.name, 16).toLowerCase()); if (!q || q.id === p.id) return 'Spieler nicht gefunden'; if (p.c.friends.includes(q.id)) return 'Bereits befreundet'; if (p.c.friends.length >= 100) return 'Liste voll'; p.c.friends.push(q.id); p.dirty = true; send(G.players.get(q.id), { t: 'chat', ch: 'sys', text: `${p.c.name} hat dich als Freund hinzugefügt.`, from: '', at: now() }); };
H.friendDel = (p, m) => { p.c.friends = p.c.friends.filter(i => i !== S(m.id)); p.dirty = true; };
H.friends = (p) => { send(p, { t: 'friends', list: p.c.friends.map(id => { const c = G.chars.get(id); const o = G.players.get(id); return c ? { id, name: c.name, cls: c.cls, level: c.level, online: !!o?.online, loc: o?.online ? LOCS[o.loc].name : '' } : null; }).filter(Boolean) }); };
// ---- Einladungen ----
function invite(from: Player, to: Player, kind: string, data?: any) { to.invites = to.invites.filter(i => !(i.kind === kind && i.from === from.id)); to.invites.push({ kind, from: from.id, until: now() + 60000, data }); send(to, { t: 'invite', kind, from: from.c.name, fromId: from.id, data }); }
const takeInvite = (p: Player, kind: string, from: string) => { const i = p.invites.find(x => x.kind === kind && x.from === from && x.until > now()); if (i) p.invites = p.invites.filter(x => x !== i); return i; };
// ---- Gruppe ----
const partySend = (pt: Party) => { const info = { t: 'partyInfo', id: pt.id, leader: pt.leader, expMode: pt.expMode, members: pt.members.map(id => ({ id, name: G.chars.get(id)?.name, lvl: G.chars.get(id)?.level, cls: G.chars.get(id)?.cls })) }; for (const id of pt.members) send(G.players.get(id), info); };
H.partyInvite = (p, m) => { const q = findOn(m.name); if (!q || q === p) return 'Spieler nicht online'; if (q.partyId) return 'Spieler ist bereits in einer Gruppe'; const pt = p.partyId ? G.parties.get(p.partyId) : null; if (pt && pt.leader !== p.id) return 'Nur der Anführer lädt ein'; if (pt && pt.members.length >= BAL.partyMax) return 'Gruppe voll (10)'; invite(p, q, 'party'); sys(p, `Einladung an ${q.c.name} gesendet.`); };
H.partyAccept = (p, m) => { const inv = takeInvite(p, 'party', S(m.from)); if (!inv) return 'Einladung abgelaufen'; const o = G.players.get(inv.from); if (!o || !o.online) return 'Einlader offline'; if (p.partyId) return 'Du bist bereits in einer Gruppe'; let pt = o.partyId ? G.parties.get(o.partyId) : null; if (!pt) { pt = { id: uid('pt'), leader: o.id, members: [o.id], expMode: 'even' }; G.parties.set(pt.id, pt); o.partyId = pt.id; } if (pt.members.length >= BAL.partyMax) return 'Gruppe voll'; pt.members.push(p.id); p.partyId = pt.id; partySend(pt); sys(o, `${p.c.name} ist der Gruppe beigetreten.`, 'party'); };
H.partyLeave = (p) => leaveParty(p);
export function leaveParty(p: Player) {
  leaveDungeon(p);
  const party = p.partyId ? G.parties.get(p.partyId) : undefined;
  if (!party) return;
  party.members = party.members.filter(id => id !== p.id);
  p.partyId = null;
  send(p, { t: 'partyInfo', id: null });
  if (party.members.length === 1) {
    const member = G.players.get(party.members[0]);
    if (member) {
      leaveDungeon(member);
      member.partyId = null;
      send(member, { t: 'partyInfo', id: null });
    }
  }
  if (party.members.length < 2) G.parties.delete(party.id);
  else {
    if (party.leader === p.id) party.leader = party.members[0];
    partySend(party);
  }
}
H.partyKick = (p, m) => { const pt = p.partyId ? G.parties.get(p.partyId) : null; if (!pt || pt.leader !== p.id) return 'Nur der Anführer'; const q = G.players.get(S(m.id)); if (!q || q.partyId !== pt.id || q === p) return 'Ungültig'; leaveParty(q); sys(q, 'Du wurdest aus der Gruppe entfernt.'); };
H.partyExp = (p, m) => { const pt = p.partyId ? G.parties.get(p.partyId) : null; if (!pt || pt.leader !== p.id) return 'Nur der Anführer'; pt.expMode = m.mode === 'level' ? 'level' : 'even'; partySend(pt); };
// ---- Gilden ----
const RANKS = ['Rekrut', 'Mitglied', 'Offizier', 'Anführer']; const GSK: Record<string, [string, number]> = { exp: ['+2 % EXP je Stufe', 800], dmg: ['+2 % Schaden je Stufe', 1000], hp: ['+2 % Leben je Stufe', 1000] };
const gOf = (p: Player) => (p.c.guildId ? G.guilds.get(p.c.guildId) : undefined);
const gView = (g: Guild) => ({ id: g.id, name: g.name, tag: g.tag, level: g.level, exp: g.exp, next: Math.floor(1000 * Math.pow(g.level, 1.8)), gold: g.gold, motd: g.motd, skills: g.skills, war: g.war, bank: g.bank, houseId: g.houseId, quest: g.quest, members: Object.entries(g.members).map(([id, mm]) => ({ id, ...mm, online: !!G.players.get(id)?.online })), ranks: RANKS, skillDefs: GSK });
export const guildSend = (g: Guild) => { const v = { t: 'guild', g: gView(g) }; for (const id of Object.keys(g.members)) send(G.players.get(id), v); };
const rankOf = (g: Guild, p: Player) => g.members[p.id]?.rank ?? -1;
async function saveG(g: Guild) { await G.store.put('guilds', g.id, g); }
H.guildInfo = (p) => { const g = gOf(p); send(p, { t: 'guild', g: g ? gView(g) : null, list: g ? undefined : [...G.guilds.values()].slice(0, 40).map(x => ({ id: x.id, name: x.name, tag: x.tag, level: x.level, members: Object.keys(x.members).length })) }); };
H.guildCreate = (p, m) => { if (p.c.guildId) return 'Du bist bereits in einer Gilde'; if (p.c.level < 10) return 'Benötigt Level 10'; const name = clean(S(m.name, 20)); const tag = S(m.tag, 4).toUpperCase().replace(/[^A-Z0-9]/g, ''); if (name.length < 3 || tag.length < 2) return 'Name (3+) und Kürzel (2–4 Zeichen) nötig'; if ([...G.guilds.values()].some(g => g.name.toLowerCase() === name.toLowerCase() || g.tag === tag)) return 'Name oder Kürzel vergeben'; if (p.c.gold < BAL.guildCreateCost) return `Kostet ${BAL.guildCreateCost} Gold`; p.c.gold -= BAL.guildCreateCost;
  const g: Guild = { id: uid('g'), name, tag, leader: p.id, created: now(), level: 1, exp: 0, gold: 0, members: { [p.id]: { name: p.c.name, rank: 3, joined: now(), contrib: 0 } }, bank: [], skills: {}, war: null, houseId: null, motd: 'Willkommen!', quest: { id: 'kills', prog: 0, day: Math.floor(Date.now() / 864e5) } }; G.guilds.set(g.id, g); p.c.guildId = g.id; recalc(p); saveG(g); guildSend(g); p.dirty = true; };
H.guildInvite = (p, m) => { const g = gOf(p); if (!g || rankOf(g, p) < 2) return 'Keine Berechtigung'; const q = findOn(m.name); if (!q) return 'Spieler nicht online'; if (q.c.guildId) return 'Spieler hat bereits eine Gilde'; if (Object.keys(g.members).length >= BAL.guildMax) return 'Gilde voll'; invite(p, q, 'guild', { guild: g.name }); sys(p, 'Einladung gesendet.'); };
H.guildAccept = (p, m) => { const inv = takeInvite(p, 'guild', S(m.from)); if (!inv) return 'Einladung abgelaufen'; const o = G.players.get(inv.from); const g = o && gOf(o); if (!g) return 'Gilde existiert nicht'; if (p.c.guildId) return 'Bereits in einer Gilde'; g.members[p.id] = { name: p.c.name, rank: 0, joined: now(), contrib: 0 }; p.c.guildId = g.id; recalc(p); saveG(g); guildSend(g); p.dirty = true; for (const id of Object.keys(g.members)) sys(G.players.get(id), `${p.c.name} ist der Gilde beigetreten.`, 'guild'); };
H.guildLeave = (p) => { const g = gOf(p); if (!g) return; if (g.leader === p.id && Object.keys(g.members).length > 1) return 'Übertrage zuerst die Führung (Rang Anführer vergeben)'; delete g.members[p.id]; p.c.guildId = null; recalc(p); p.dirty = true; if (!Object.keys(g.members).length) { G.guilds.delete(g.id); G.store.del('guilds', g.id); } else { saveG(g); guildSend(g); } send(p, { t: 'guild', g: null }); };
H.guildKick = (p, m) => { const g = gOf(p); if (!g || rankOf(g, p) < 2) return 'Keine Berechtigung'; const id = S(m.id); const mm = g.members[id]; if (!mm || id === p.id || mm.rank >= rankOf(g, p)) return 'Nicht möglich'; delete g.members[id]; const q = G.players.get(id); const c = G.chars.get(id); if (c) { c.guildId = null; saveCharacterDocument(c); } if (q) { recalc(q); send(q, { t: 'guild', g: null }); sys(q, 'Du wurdest aus der Gilde geworfen.'); } saveG(g); guildSend(g); };
H.guildRank = (p, m) => { const g = gOf(p); if (!g || rankOf(g, p) < 3) return 'Nur der Anführer'; const id = S(m.id); const r = Math.max(0, Math.min(3, Number(m.rank) | 0)); if (!g.members[id] || id === p.id) return 'Ungültig'; if (r === 3) { g.members[p.id].rank = 2; g.leader = id; } g.members[id].rank = r; saveG(g); guildSend(g); };
H.guildMotd = (p, m) => { const g = gOf(p); if (!g || rankOf(g, p) < 2) return 'Keine Berechtigung'; g.motd = clean(S(m.text, 120)); saveG(g); guildSend(g); };
H.guildDeposit = (p, m) => { const g = gOf(p); if (!g) return 'Keine Gilde'; if (m.gold) { const a = Math.floor(Number(m.gold)); if (!(a > 0) || a > p.c.gold) return 'Ungültiger Betrag'; p.c.gold -= a; g.gold += a; g.exp += Math.floor(a / 20); guildLevel(g); g.members[p.id].contrib += Math.floor(a / 100); } else { const it = p.c.inventory.find(i => i.uid === S(m.uid)); if (!it || !ITEMS[it.id].tradable) return 'Nicht möglich'; const q = Math.max(1, Math.min(it.qty, Number(m.qty) | 0 || 1)); if (g.bank.length >= 100) return 'Gildenlager voll'; const x = takeUid(p.c.inventory, it.uid, q)!; giveInst(p.c, x, g.bank, 100); } p.dirty = true; saveG(g); guildSend(g); };
H.guildWithdraw = (p, m) => { const g = gOf(p); if (!g || rankOf(g, p) < 2) return 'Offizier-Rang nötig'; if (m.gold) { const a = Math.floor(Number(m.gold)); if (!(a > 0) || a > g.gold) return 'Ungültiger Betrag'; g.gold -= a; p.c.gold += a; } else { const it = takeUid(g.bank, S(m.uid), Math.max(1, Number(m.qty) | 0 || 1)); if (!it) return 'Fehlt'; if (!giveInst(p.c, it)) { giveInst(p.c, it, g.bank, 200); return 'Inventar voll'; } } p.dirty = true; saveG(g); guildSend(g); };
H.guildSkill = (p, m) => { const g = gOf(p); if (!g || rankOf(g, p) < 3) return 'Nur der Anführer'; const k = S(m.k, 6); const d = GSK[k]; if (!d) return 'Unbekannt'; const lv = g.skills[k] || 0; const cost = d[1] * (lv + 1); if (lv >= Math.floor(g.level / 2) + 1 || lv >= 10) return 'Gildenstufe zu niedrig'; if (g.gold < cost) return `Gildenkasse braucht ${cost} Gold`; g.gold -= cost; g.skills[k] = lv + 1; for (const id of Object.keys(g.members)) { const q = G.players.get(id); if (q) recalc(q); } saveG(g); guildSend(g); };
H.guildWar = (p, m) => { const g = gOf(p); if (!g || rankOf(g, p) < 3) return 'Nur der Anführer'; const o = [...G.guilds.values()].find(x => x.name.toLowerCase() === S(m.name, 20).toLowerCase()); if (!o || o === g) return 'Gilde nicht gefunden'; if (g.war && g.war.until > now()) return 'Bereits im Krieg'; if (o.war && o.war.until > now()) return 'Gegner ist im Krieg'; const until = now() + 24 * 3600e3; g.war = { vs: o.id, vsName: o.name, until, score: 0, theirScore: 0 }; o.war = { vs: g.id, vsName: g.name, until, score: 0, theirScore: 0 }; for (const x of [g, o]) { saveG(x); guildSend(x); for (const id of Object.keys(x.members)) sys(G.players.get(id), `⚔ Gildenkrieg: ${g.name} gegen ${o.name} (24 h). Kills in PvP-Zonen zählen!`, 'boss'); } };
export function guildWarCheck() { for (const g of G.guilds.values()) if (g.war && g.war.until < now()) { const w = g.war; g.war = null; const won = w.score > w.theirScore; if (won) { g.gold += 5000; g.exp += 2000; guildLevel(g); } saveG(g); guildSend(g); for (const id of Object.keys(g.members)) sys(G.players.get(id), `Gildenkrieg beendet: ${w.score}:${w.theirScore} – ${won ? 'Sieg! +5000 Gildengold' : w.score === w.theirScore ? 'Unentschieden' : 'Niederlage'}`, 'boss'); } }
// ---- Direkter Handel ----
const tradeOf = (p: Player) => p.trade; const other = (t: NonNullable<Player['trade']>, p: Player) => G.players.get(t.a === p.id ? t.b : t.a)!;
function tradeView(t: NonNullable<Player['trade']>) { const v = (id: string) => ({ name: G.chars.get(id)!.name, gold: t.offers[id].gold, items: t.offers[id].uids.map(u => G.players.get(id)!.c.inventory.find(i => i.uid === u)).filter(Boolean), ready: t.ready[id] }); return { t: 'trade', a: { id: t.a, ...v(t.a) }, b: { id: t.b, ...v(t.b) } }; }
const tradeSync = (t: NonNullable<Player['trade']>) => { const v = tradeView(t); send(G.players.get(t.a), v); send(G.players.get(t.b), v); };
H.tradeRequest = (p, m) => { const q = findOn(m.name); if (!q || q === p || locOf(q) !== locOf(p)) return 'Spieler nicht am Ort'; if (p.trade || q.trade) return 'Bereits im Handel'; invite(p, q, 'trade'); sys(p, 'Handelsanfrage gesendet.'); };
H.tradeAccept = (p, m) => { const inv = takeInvite(p, 'trade', S(m.from)); if (!inv) return 'Anfrage abgelaufen'; const o = G.players.get(inv.from); if (!o || !o.online || locOf(o) !== locOf(p) || o.trade || p.trade) return 'Nicht möglich'; const t = { id: uid('t'), a: o.id, b: p.id, offers: { [o.id]: { gold: 0, uids: [] as string[] }, [p.id]: { gold: 0, uids: [] as string[] } }, ready: { [o.id]: false, [p.id]: false } }; o.trade = p.trade = t; tradeSync(t); };
H.tradeOffer = (p, m) => { const t = tradeOf(p); if (!t) return 'Kein Handel'; const gold = Math.max(0, Math.min(p.c.gold, Math.floor(Number(m.gold) || 0))); const uids = (Array.isArray(m.uids) ? m.uids : []).map((x: any) => S(x)).filter((u: string, i: number, a: string[]) => a.indexOf(u) === i && p.c.inventory.some(i => i.uid === u && ITEMS[i.id].tradable)).slice(0, 12); t.offers[p.id] = { gold, uids }; t.ready = { [t.a]: false, [t.b]: false }; tradeSync(t); };
H.tradeConfirm = (p) => { const t = tradeOf(p); if (!t) return 'Kein Handel'; t.ready[p.id] = true; tradeSync(t); if (t.ready[t.a] && t.ready[t.b]) { const A = G.players.get(t.a)!, B = G.players.get(t.b)!; const oa = t.offers[A.id], ob = t.offers[B.id];
    const okSide = (X: Player, o: typeof oa) => X.c.gold >= o.gold && o.uids.every(u => X.c.inventory.some(i => i.uid === u)); if (!okSide(A, oa) || !okSide(B, ob)) { cancelTrade(t, 'Handel ungültig.'); return; }
    if (A.c.inventory.length - oa.uids.length + ob.uids.length > BAL.invSize || B.c.inventory.length - ob.uids.length + oa.uids.length > BAL.invSize) { cancelTrade(t, 'Inventar voll.'); return; }
    const ia = oa.uids.map(u => takeUid(A.c.inventory, u, A.c.inventory.find(i => i.uid === u)!.qty)!), ib = ob.uids.map(u => takeUid(B.c.inventory, u, B.c.inventory.find(i => i.uid === u)!.qty)!); A.c.gold += ob.gold - oa.gold; B.c.gold += oa.gold - ob.gold; for (const i of ib) giveInst(A.c, i); for (const i of ia) giveInst(B.c, i); A.trade = B.trade = null; A.dirty = B.dirty = true; send(A, { t: 'trade', done: true }); send(B, { t: 'trade', done: true }); sys(A, 'Handel abgeschlossen.'); sys(B, 'Handel abgeschlossen.'); saveCharacterDocument(A.c); saveCharacterDocument(B.c); } };
export function cancelTrade(t: NonNullable<Player['trade']>, why = 'Handel abgebrochen.') { for (const id of [t.a, t.b]) { const q = G.players.get(id); if (q) { q.trade = null; send(q, { t: 'trade', done: true, cancelled: true }); sys(q, why); } } }
H.tradeCancel = (p) => { if (p.trade) cancelTrade(p.trade); };
// ---- Duell ----
H.duel = (p, m) => { const q = findOn(m.name); if (!q || q === p || locOf(q) !== locOf(p)) return 'Spieler nicht am Ort'; if (LOCS[p.loc].safe && LOCS[p.loc].kind !== 'city') { /* erlaubt */ } if (p.dungeon || q.dungeon) return 'Duell in einer Gruppeninstanz nicht möglich'; if (p.duel || q.duel) return 'Bereits im Duell'; if (p.dead || q.dead) return 'Nicht möglich'; invite(p, q, 'duel'); sys(p, 'Duellanfrage gesendet.'); };
H.duelAccept = (p, m) => { const inv = takeInvite(p, 'duel', S(m.from)); if (!inv) return 'Anfrage abgelaufen'; const o = G.players.get(inv.from); if (!o || !o.online || locOf(o) !== locOf(p) || o.dungeon || p.dungeon || o.duel || p.duel) return 'Nicht möglich'; const until = now() + 5 * 60e3; o.duel = { opp: p.id, until }; p.duel = { opp: o.id, until }; for (const x of [o, p]) { recalc(x); x.c.hp = x.pvpSt!.maxHp; x.c.res = x.pvpSt!.maxRes; x.target = x === o ? p.id : o.id; x.auto = true; sys(x, '⚔ Duell! Werte sind normalisiert. Viel Erfolg!', 'boss'); } };
void canPvp;
