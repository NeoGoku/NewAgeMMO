import assert from 'node:assert/strict';
import { GEO_ANCHORS } from '@nam/game-data';
import { createCore, type SockLike } from '../src/core';
import { damageMob, worldTick } from '../src/game';
import { geoObjects } from '../src/geo-world';
import { setTerrainTile, T, tileXY } from '../src/geo-terrain';
import { acceptQuest, recordRegionalEvent, turnIn } from '../src/quests';
import { G } from '../src/state';
import { MemoryStore } from '../src/store';

class Client implements SockLike {
  readyState = 1;
  private receive?: (data: string) => void;
  private sequence = 0;
  private replies = new Map<number, (reply: any) => void>();
  on(event: 'message' | 'close', listener: (data?: any) => void) {
    if (event === 'message') this.receive = listener;
  }
  close() { this.readyState = 3; }
  send(data: string) {
    const reply = JSON.parse(data);
    this.replies.get(reply.rid)?.(reply);
  }
  request(t: string, fields = {}): Promise<any> {
    const rid = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error(t + ' timed out')), 2000);
      this.replies.set(rid, result => {
        clearTimeout(timeout);
        this.replies.delete(rid);
        resolve(result);
      });
      this.receive?.(JSON.stringify({ t, rid, ...fields }));
    });
  }
}

const store = new MemoryStore();
const core = await createCore(store);
const [lat, lon] = GEO_ANCHORS.daemonenkluft;
const tile = tileXY(lat, lon);
for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) setTerrainTile({
  x: tile.x + dx, y: tile.y + dy, grid: new Uint8Array(4096).fill(T.grass),
  pois: [], places: [], buildings: 200, shares: [], at: Date.now(),
});
const boss = geoObjects(lat, lon).find(o => o.id === 'x:boss:azgoroth');
assert(boss);
const players = [];
const wallClock = Date.now;
try {
  for (const name of ['Mirae', 'Tarvek', 'Borin']) {
    const client = new Client();
    core.onConnection(client);
    assert.equal((await client.request('register', { user: name, pass: 'test-pass' })).t, 'ok');
    const { id } = await client.request('createChar', { name, cls: 'archer', look: { gender: 'm', face: 1, body: 1, hair: 2, hairColor: '#aa3311', tattoo: 0, skin: '#e0b090' } });
    assert.equal((await client.request('enter', { id })).t, 'ok');
    const p = G.players.get(id)!;
    p.c.level = 40;
    await client.request('geoConsent', { on: true, gps: true });
    assert.equal((await client.request('geoPos', { lat: boss.lat, lon: boss.lon, acc: 10, mode: 'gps' })).t, 'ok');
    players.push({ client, p, gold: p.c.gold });
  }
  for (const { client } of players) assert.equal((await client.request('geoInteract', { id: boss.id })).t, 'ok');
  const [a, b, passive] = players;
  const instance = a.p.dungeon?.dungeon;
  assert(instance && b.p.dungeon?.dungeon === instance && passive.p.dungeon?.dungeon === instance, 'world boss joins a single geographic instance');
  const mob = instance.mobs.find(m => m.def.id === boss.def)!;
  a.p.auto = b.p.auto = passive.p.auto = false;
  damageMob(a.p, mob, Math.round(mob.maxHp / 2), false, 'phys');
  damageMob(b.p, mob, mob.hp, false, 'phys');
  await Promise.all(players.map(({ client }) => client.request('ping')));
  const savedA = await store.get('chars', a.p.id);
  const savedB = await store.get('chars', b.p.id);
  assert(savedA.gold > a.gold && savedB.gold > b.gold, 'both contributors are rewarded');
  assert.equal(passive.p.c.gold, passive.gold, 'passive participants receive no payout');
  assert(!a.p.inScene && !b.p.inScene && !passive.p.inScene, 'all participants return to the map');
  assert(!geoObjects(lat, lon).some(o => o.id === boss.id), 'completion removes the geographic marker for its window');
  G.geoTaken.delete(boss.id); // Reconstruct a marker after an in-memory world reset.
  assert.equal((await a.client.request('logout')).t, 'ok');
  assert.equal((await a.client.request('enter', { id: a.p.id })).t, 'ok');
  const relogged = G.players.get(a.p.id)!;
  relogged.c.level = 40;
  await a.client.request('geoConsent', { on: true, gps: true });
  await a.client.request('geoPos', { lat: boss.lat, lon: boss.lon, acc: 10, mode: 'gps' });
  assert.match((await a.client.request('geoInteract', { id: boss.id })).err, /bereits/);

  const window = Array.from({ length: 6 }, (_, i) => {
    const at = wallClock() + i * 10 * 60e3;
    const storm = geoObjects(lat, lon, 1200, at).find(o => o.extra?.regionalEvent === 'aetherstorm' && o.extra.endsAt - at > 60e3);
    return storm && { at, storm };
  }).find(Boolean);
  assert(window, 'loaded land contains a timed event');
  const { at, storm } = window;
  Date.now = () => at;
  const questId = 'd_regional_storm';
  Object.assign(passive.p.geo!, { lat: storm.lat, lon: storm.lon });
  assert.equal(acceptQuest(passive.p, questId), null);
  await passive.client.request('ping');
  assert.deepEqual((await store.get('chars', passive.p.id)).quests[questId].region, passive.p.c.quests[questId].region);
  recordRegionalEvent(passive.p, { lat: storm.lat + 1, lon: storm.lon });
  assert.equal(passive.p.c.quests[questId].state, 'active', 'events outside the assigned area do not count');
  assert.equal((await passive.client.request('geoInteract', { id: storm.id })).t, 'ok');
  const target = passive.p.dungeon!.dungeon.mobs[0];
  damageMob(passive.p, target, target.hp, false, 'phys');
  await passive.client.request('ping');
  assert.equal((await store.get('chars', passive.p.id)).quests[questId].state, 'done');
  assert.equal(turnIn(passive.p, questId), null);
  await passive.client.request('ping');
  assert((await store.get('chars', passive.p.id)).questsDone.includes(questId));
  assert.match(turnIn(passive.p, questId) ?? '', /nicht aktiv/);

  G.geoTaken.delete(storm.id);
  Object.assign(b.p.geo!, { lat: storm.lat, lon: storm.lon });
  assert.equal((await b.client.request('geoInteract', { id: storm.id })).t, 'ok');
  const beforeExpiry = b.p.c.gold;
  Date.now = () => storm.extra.endsAt;
  worldTick();
  assert(!b.p.inScene && b.p.c.gold === beforeExpiry, 'expired event returns participants with no reward');
  console.log('Shared world boss, durable quest and boss rewards, reload exclusion and event expiry passed.');
} finally {
  Date.now = wallClock;
  await core.shutdown();
}
