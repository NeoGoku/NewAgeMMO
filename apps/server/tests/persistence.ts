import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expToNext } from '@nam/shared';
import { createCore, type SockLike } from '../src/core';
import { damageMob, spawnMob } from '../src/game';
import { acceptQuest, recordRegionalVisit } from '../src/quests';
import { exitScene } from '../src/world';
import { G } from '../src/state';
import { makeStore } from '../src/store-node';

class Client implements SockLike {
  readyState = 1;
  private message?: (data: string) => void;
  private closed?: () => void;
  private rid = 0;
  private replies = new Map<number, (data: any) => void>();
  char: any;
  levelUps = 0;

  on(event: 'message' | 'close', fn: (data?: any) => void) {
    if (event === 'message') this.message = fn;
    else this.closed = fn;
  }
  send(data: string) {
    const msg = JSON.parse(data);
    if (msg.t === 'levelup') this.levelUps++;
    if (msg.t === 'char') this.char = msg.c;
    this.replies.get(msg.rid)?.(msg);
  }
  close() {
    this.readyState = 3;
    this.closed?.();
  }
  async request(t: string, fields = {}) {
    const rid = ++this.rid;
    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(t + ' timed out')), 3000);
      this.replies.set(rid, msg => {
        clearTimeout(timeout);
        this.replies.delete(rid);
        resolve(msg);
      });
      this.message?.(JSON.stringify({ t, rid, ...fields }));
    });
  }
}

const dir = mkdtempSync(join(tmpdir(), 'nam-persistence-'));
process.env.DATA_DIR = dir;
const progress = ({ gold, exp, level }: any) => ({ gold, exp, level });

async function main() {
  const core = await createCore(makeStore());
  const user = 'save_' + Date.now().toString(36);
  const pass = 'test-only';
  const a = new Client();
  core.onConnection(a);
  const reg = await a.request('register', { user, pass });
  assert.equal(reg.t, 'ok');
  const { id } = await a.request('createChar', {
    name: 'Hero ' + Date.now().toString(36),
    cls: 'dark_mage',
    look: { gender: 'm', face: 1, body: 1, hair: 2, hairColor: '#aa3311', tattoo: 0, skin: '#e0b090' }
  });
  assert.equal((await a.request('enter', { id })).t, 'ok');
  const player = G.players.get(id)!;
  const zone = G.locs.get('stadtpark')!;
  G.locs.get(player.loc)!.players.delete(player);
  player.loc = zone.id;
  zone.players.add(player);
  player.c.exp = expToNext(player.c.level) - 1;
  const mob = zone.mobs.find(m => m.def.id === 'rat')!;
  const gold = player.c.gold;
  damageMob(player, mob, mob.hp, false, 'arcane');
  damageMob(player, mob, 1, false, 'arcane');
  const expected = progress(player.c);
  assert.equal(expected.level, 2);
  assert.equal(player.c.kills.rat, 1);
  assert.equal(a.levelUps, 0, 'level-up must wait for storage');
  assert.ok(expected.gold > gold && expected.exp > 0);

  // Open an independent adapter so the file check reads the actual disk state.
  const saved = makeStore();
  await saved.init();
  const deadline = Date.now() + 3000;
  while (!a.char && Date.now() < deadline) await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(progress(a.char), expected);
  assert.equal(a.levelUps, 1);
  if (saved.kind === 'file') await saved.init();
  const durable = await saved.get('chars', id);
  assert.ok(durable, 'confirmed reward must already be durable');
  assert.deepEqual(progress(durable), expected);

  const b = new Client();
  core.onConnection(b);
  assert.equal((await b.request('resume', { token: reg.token })).t, 'ok');
  assert.equal((await b.request('enter', { id })).t, 'err', 'a second socket must not take over an active character');
  const [logout, reconnect] = await Promise.all([a.request('logout'), b.request('enter', { id })]);
  assert.equal(logout.t, 'ok');
  assert.deepEqual(progress(reconnect.char), expected);
  assert.equal((await a.request('stat', { attr: 'int', n: 1 })).t, 'err');
  assert.equal((await b.request('logout')).t, 'ok');
  if (saved.kind === 'file') await saved.init();
  assert.deepEqual(progress(await saved.get('chars', id)), expected);
  assert.equal((await b.request('enter', { id })).t, 'ok');
  const hunter = G.players.get(id)!;
  const home = G.locs.get(hunter.loc)!;
  hunter.c.questsDone.push('m1');
  acceptQuest(hunter, 'm2');
  hunter.inScene = true;
  const mapRat = spawnMob(home, 'rat', true);
  hunter.mapEncounter = mapRat.mapEncounter = { target: mapRat.uid, origin: hunter.loc, finish: () => exitScene(hunter) };
  const outsideRat = home.mobs.find(m => !m.mapEncounter && !m.dead)!;
  const outsideHP = outsideRat.hp;
  damageMob(hunter, outsideRat, outsideHP, false, 'arcane');
  assert.equal(outsideRat.hp, outsideHP, 'map fight cannot damage creatures outside its encounter');
  damageMob(hunter, mapRat, mapRat.hp, false, 'arcane');
  assert.equal(hunter.c.quests.m2?.prog[0], 1, 'map fight contributes to quest');
  assert.equal((await b.request('ping')).t, 'ok');
  assert.equal(hunter.inScene, false, 'completed map fight returns after its save');
  assert.equal((await b.request('geoConsent', { on: true, gps: false })).t, 'ok');
  assert.equal(acceptQuest(hunter, 'd_regional'), null);
  const regional = hunter.c.quests.d_regional;
  assert.ok(regional.region?.virtualOnly);
  assert.equal(recordRegionalVisit(hunter), false, 'starting position is outside the quest area');
  const geo = hunter.geo!;
  geo.lat = regional.region.lat;
  geo.lon = regional.region.lon;
  geo.gps = true;
  assert.equal(recordRegionalVisit(hunter), false, 'procedural targets do not reward real-world GPS visits');
  geo.gps = false;
  assert.equal(recordRegionalVisit(hunter), true);
  assert.equal(regional.state, 'done');
  assert.equal(recordRegionalVisit(hunter), false, 'regional visit is credited once');
  await b.request('logout');
  if (saved.kind === 'file') await saved.init();
  const regionalSave = await saved.get<any>('chars', id);
  assert.deepEqual(regionalSave.quests.d_regional.region, regional.region);
  assert.equal(regionalSave.quests.d_regional.state, 'done');
  await G.store.del('chars', id);
  await G.store.del('accounts', user);
  await core.shutdown();
  console.log('✓ Kampffortschritt, Levelaufstieg, dauerhafte Speicherung und Reconnect (' + saved.kind + ')');
}

main().then(() => process.exitCode = 0, err => {
  console.error(err);
  process.exitCode = 1;
}).finally(() => {
  rmSync(dir, { recursive: true, force: true });
  process.exit(process.exitCode);
});
