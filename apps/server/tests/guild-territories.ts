import assert from 'node:assert/strict';
import { GEO_ANCHORS } from '@nam/game-data';
import { GUILD_TERRITORY } from '@nam/shared';
import { registerGuildTerritories, restoreTerritories, saveTerritoryChanges, territoryObjects, tickTerritories } from '../src/guild-territories';
import { newChar } from '../src/chars';
import { H } from '../src/handlers';
import { G, type GeoState, type Guild, type Player } from '../src/state';
import { MemoryStore } from '../src/store';

G.store = new MemoryStore();
registerGuildTerritories();
await restoreTerritories();

function member(guildId: string, rank: number) {
  const id = guildId + 'leader';
  const [lat, lon] = GEO_ANCHORS.arena;
  const geo: GeoState = {
    on: true, gps: false, visible: true, lat, lon, has: true, regionLabel: '', steer: null, motionAt: 0, tripProgress: 0,
    strikes: [], lockUntil: 0, flags: [], lastPush: 0, visited: new Set(),
  };
  const c = newChar('aterritory', id, 'archer', { gender: 'f', face: 0, body: 0, hair: 0, hairColor: '#553311', tattoo: 0, skin: '#ddbb99' });
  c.guildId = guildId;
  const ws = { readyState: 1, send() {}, close() {}, on() {} };
  const fixture: Partial<Player> = { id, c, geo, online: true, ws, combatUntil: 0 };
  const player = fixture as Player;
  const guild: Guild = {
    id: guildId, name: guildId, tag: guildId.toUpperCase(), leader: id, created: 0, level: 1, exp: 0, gold: 0,
    members: { [id]: { name: id, rank, joined: 0, contrib: 0 } }, bank: [], skills: {}, war: null,
    houseId: null, motd: '', quest: { id: 'kills', prog: 0, day: 0 },
  };
  G.players.set(id, player);
  G.guilds.set(guildId, guild);
  return { player, guild, geo };
}

let time = 100_000;
const actualNow = Date.now;
Date.now = () => time;
try {
  const a = member('alpha', 1);
  const b = member('bravo', 3);
  const command = { id: 'colosseum' };
  assert.match(String(await H.guildTerritoryCapture(a.player, command)), /Offiziere/);
  a.guild.members[a.player.id].rank = 2;
  assert.match(String(await H.guildTerritoryCapture(a.player, { id: '__proto__' })), /Unbekannt/);
  assert.equal(await H.guildTerritoryCapture(a.player, command), undefined);
  assert.match(String(await H.guildTerritoryCapture(b.player, command)), /bereits/);
  a.geo.steer = { east: 0, north: 1, mode: 'walk', until: time + 500 };
  tickTerritories();
  assert.equal(await G.store.get('territories', command.id), null);
  a.geo.steer = null;
  assert.equal(await H.guildTerritoryCapture(a.player, command), undefined);
  time += GUILD_TERRITORY.holdMs;
  tickTerritories();
  await saveTerritoryChanges();
  assert.equal((await G.store.get('territories', command.id)).guildId, a.guild.id);
  await restoreTerritories();
  assert.equal(territoryObjects().find(o => o.def === command.id)?.extra.ownerName, a.guild.name);

  assert.match(String(await H.guildTerritoryCapture(b.player, command)), /Krieg/);
  a.guild.war = { vs: b.guild.id, vsName: b.guild.name, until: time + 2 * GUILD_TERRITORY.recaptureMs, score: 0, theirScore: 0 };
  b.guild.war = { ...a.guild.war, vs: a.guild.id, vsName: a.guild.name };
  assert.match(String(await H.guildTerritoryCapture(b.player, command)), /Eroberungsschutz/);
  time += GUILD_TERRITORY.recaptureMs;
  assert.equal(await H.guildTerritoryCapture(b.player, command), undefined);
  time += GUILD_TERRITORY.holdMs;
  tickTerritories();
  await saveTerritoryChanges();
  assert.equal((await G.store.get('territories', command.id)).guildId, a.guild.id);

  a.geo.lat += .01;
  tickTerritories();
  time += GUILD_TERRITORY.holdMs;
  tickTerritories();
  await saveTerritoryChanges();
  assert.equal((await G.store.get('territories', command.id)).guildId, b.guild.id);
} finally {
  Date.now = actualNow;
}
console.log('Gildengebiete: Rang, Bewegung, Speicherung, Schutzfrist und Verteidigung geprüft.');
