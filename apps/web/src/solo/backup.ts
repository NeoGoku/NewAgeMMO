import { ACC_RE, ATTRS, CLASS_IDS, NAME_RE, validPropertyId, validPropertyOwnership, type ClassId } from '@nam/shared';
import { FURN, ITEMS, LOCS, RECIPES, SPECIES } from '@nam/game-data';

type Doc = Record<string, unknown>;
export type SoloData = Record<string, Record<string, Doc>>;
const FORMAT = 'newagemmo-solo';
const VERSION = 1;
const record = (value: unknown): value is Doc => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positiveInt = (value: unknown) => number(value) && Number.isSafeInteger(value) && value > 0;
const id = (value: unknown): value is string => text(value) && /^[a-z][a-z0-9]+$/.test(value);
const ownId = (table: object, value: unknown) => text(value) && Object.hasOwn(table, value);
const hex = (value: unknown, length: number) => text(value) && value.length === length && /^[a-f0-9]+$/i.test(value);
const list = (value: unknown, check: (value: unknown) => boolean) => Array.isArray(value) && value.every(check);
const dict = (value: unknown, check: (value: unknown, key: string) => boolean) =>
  record(value) && Object.entries(value).every(([key, entry]) => check(entry, key));
const docId = (value: unknown, key: string): value is Doc => record(value) && id(key) && value.id === key;
const fields = (value: Doc, keys: string[], check: (value: unknown) => boolean) => keys.every(key => check(value[key]));
const numbers = (value: Doc, keys: string[]) => fields(value, keys, number);
const rarity = (value: unknown) => number(value) && Number.isInteger(value) && value >= 0 && value <= 4;
const item = (value: unknown) => record(value) && id(value.uid) && ownId(ITEMS, value.id) &&
  rarity(value.rar) && positiveInt(value.qty) && (value.dur === undefined || number(value.dur));
const items = (value: unknown) => list(value, item);

function account(value: unknown, key: string): value is Doc {
  return record(value) && text(value.name) && ACC_RE.test(value.name) && key === value.name.toLowerCase() &&
    !Object.hasOwn(Object.prototype, key) && id(value.id) && hex(value.hash, 64) && hex(value.salt, 32) &&
    number(value.created) && list(value.tokens, token => record(token) && hex(token.h, 64) && number(token.exp)) &&
    (value.admin === undefined || typeof value.admin === 'boolean') && (value.banned === undefined || typeof value.banned === 'boolean');
}

function character(c: unknown, key: string, owners: Set<unknown>) {
  return docId(c, key) && owners.has(c.accountId) && text(c.name) && NAME_RE.test(c.name) &&
    CLASS_IDS.includes(c.cls as ClassId) && ownId(LOCS, c.loc) && positiveInt(c.level) &&
    numbers(c, ['exp', 'prestige', 'pexp', 'statPoints', 'bonusPoints', 'trainExp', 'hp', 'res', 'gold', 'x', 'y',
      'dailyReset', 'arenaPts', 'honor', 'created', 'lastSeen', 'playtime']) &&
    record(c.look) && ['m', 'f'].includes(String(c.look.gender)) && numbers(c.look, ['face', 'body', 'hair', 'tattoo']) &&
    text(c.look.hairColor) && /^#[\da-f]{6}$/i.test(c.look.hairColor) && text(c.look.skin) && /^#[\da-f]{6}$/i.test(c.look.skin) &&
    record(c.attrs) && numbers(c.attrs, ATTRS) && items(c.inventory) && items(c.stash) && dict(c.equipment, item) &&
    list(c.hotbar, value => value === null || text(value)) && fields(c, ['questsDone', 'friends', 'summons', 'discovered', 'titles'], value => list(value, text)) &&
    dict(c.quests, q => record(q) && ['active', 'done', 'turned'].includes(String(q.state)) && list(q.prog, number) && number(q.started) &&
      (q.region === undefined || (record(q.region) && number(q.region.lat) && Math.abs(q.region.lat) <= 85 &&
        number(q.region.lon) && Math.abs(q.region.lon) <= 180 && positiveInt(q.region.radius) &&
        text(q.region.label) && typeof q.region.virtualOnly === 'boolean'))) &&
    dict(c.rep, number) && dict(c.kills, number) && dict(c.choices, text) && dict(c.prof, p => record(p) && numbers(p, ['lvl', 'exp'])) &&
    list(c.pets, p => record(p) && id(p.uid) && ownId(SPECIES, p.species) && rarity(p.rar) && text(p.name) &&
      numbers(p, ['level', 'exp', 'stage', 'gen', 'energy']) && record(p.stats) && numbers(p.stats, ['atk', 'hp', 'spd'])) &&
    list(c.craftJobs, j => record(j) && id(j.id) && ownId(RECIPES, j.recipe) && positiveInt(j.qty) && numbers(j, ['start', 'end'])) &&
    list(c.mail, m => record(m) && id(m.id) && text(m.from) && text(m.subject) && numbers(m, ['gold', 't']) && items(m.items)) &&
    fields(c, ['activePet', 'guildId', 'houseId'], value => value === null || id(value)) &&
    (c.geoProperty === undefined || (id(c.houseId) && validPropertyOwnership(c.geoProperty))) &&
    record(c.settings) && fields(c.settings, ['autoPotion', 'autoLoot', 'autoQuest'], value => typeof value === 'boolean');
}

function guild(g: unknown, key: string) {
  return docId(g, key) && fields(g, ['name', 'tag', 'leader', 'motd'], text) &&
    numbers(g, ['created', 'level', 'exp', 'gold']) && items(g.bank) && dict(g.skills, number) &&
    dict(g.members, (member, idKey) => id(idKey) && record(member) && text(member.name) && numbers(member, ['rank', 'joined', 'contrib'])) &&
    record(g.quest) && text(g.quest.id) && numbers(g.quest, ['prog', 'day']);
}

function house(h: unknown, key: string) {
  return docId(h, key) && ['player', 'guild'].includes(String(h.kind)) && fields(h, ['ownerId', 'ownerName', 'style', 'visit'], text) &&
    (h.propertyId === undefined || (h.kind === 'player' && validPropertyId(h.propertyId))) &&
    numbers(h, ['slot', 'floors', 'created']) && items(h.stash) &&
    list(h.furniture, f => record(f) && id(f.id) && ownId(FURN, f.furn) && numbers(f, ['x', 'y', 'rot', 'floor']));
}

function listing(l: unknown, key: string) {
  return docId(l, key) && fields(l, ['seller', 'sellerName'], text) && numbers(l, ['price', 'created', 'expires']) &&
    (l.kind === 'order' ? record(l.want) && ownId(ITEMS, l.want.id) && positiveInt(l.want.qty) :
      (l.kind === 'ah' || l.kind === 'stall') && item(l.item));
}

function validData(value: unknown): value is SoloData {
  if (!record(value) || !record(value.accounts) || !Object.keys(value.accounts).length || !dict(value.accounts, account)) return false;
  const owners = new Set(Object.values(value.accounts).filter(record).map(value => value.id));
  if (owners.size !== Object.keys(value.accounts).length) return false;
  return Object.entries(value).every(([collection, docs]) => {
    switch (collection) {
      case 'accounts': return true;
      case 'chars': return dict(docs, (c, key) => character(c, key, owners));
      case 'guilds': return dict(docs, guild);
      case 'houses': return dict(docs, house);
      case 'market': return dict(docs, listing);
      default: return false;
    }
  });
}

export function serializeSoloBackup(data: SoloData): string {
  if (!Object.keys(data.accounts ?? {}).length) throw new Error('Auf diesem Gerät ist kein Solo-Spielstand gespeichert.');
  return JSON.stringify({ format: FORMAT, version: VERSION, data }, null, 2);
}

export function parseSoloBackup(json: string): SoloData {
  let backup: unknown;
  try { backup = JSON.parse(json); } catch { throw new Error('Diese Datei enthält keine lesbare Sicherung.'); }
  if (!record(backup) || backup.format !== FORMAT) throw new Error('Diese Datei ist keine NewAgeMMO-Solo-Sicherung.');
  if (backup.version !== VERSION) throw new Error('Diese Version der Solo-Sicherung wird nicht unterstützt.');
  if (!validData(backup.data)) throw new Error('Der Spielstand in der Solo-Sicherung ist unvollständig oder beschädigt.');
  return backup.data;
}
