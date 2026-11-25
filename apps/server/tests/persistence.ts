import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { placeNear } from '@nam/game-data';
import { expToNext } from '@nam/shared';
import { createCore, type SockLike } from '../src/core';
import { damageMob, locOf, partyHere, spawnMob } from '../src/game';
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
  hunter.mapEncounter = mapRat.mapEncounter = { target: mapRat.uid, origin: hunter.loc, mobPosition: { lat: 52.522, lon: 13.413 }, finish: () => { exitScene(hunter); hunter.combatUntil = 0; } };
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
  assert.equal(acceptQuest(hunter, 'd_regional_survey'), null);
  const survey = hunter.c.quests.d_regional_survey;
  assert.ok(survey.region?.virtualOnly);
  assert.equal((await b.request('geoQuestSurvey', survey.region)).t, 'err', 'field survey requires an active quest id');
  assert.equal((await b.request('geoQuestSurvey', { id: 'd_regional_survey', ...survey.region })).t, 'err', 'survey does not trust client coordinates');
  Object.assign(geo, { lat: survey.region.lat, lon: survey.region.lon, gps: true });
  assert.equal((await b.request('geoQuestSurvey', { id: 'd_regional_survey' })).t, 'err', 'GPS cannot complete a virtual-only survey');
  geo.gps = false;
  assert.equal((await b.request('geoQuestSurvey', { id: 'd_regional_survey' })).t, 'ok');
  assert.equal((await b.request('geoQuestSurvey', { id: 'd_regional_survey' })).t, 'err', 'a survey can be recorded only once');
  assert.equal(acceptQuest(hunter, 'd_regional_hunt'), null);
  const patrol = hunter.c.quests.d_regional_hunt;
  assert.ok(patrol.region);
  const patrolScene = G.locs.get(hunter.loc)!;
  const hunt = async (mobPosition: { lat: number; lon: number }) => {
    hunter.inScene = true;
    const rat = spawnMob(patrolScene, 'rat', true);
    hunter.mapEncounter = rat.mapEncounter = { target: rat.uid, origin: hunter.loc, mobPosition, finish: () => exitScene(hunter) };
    damageMob(hunter, rat, rat.hp, false, 'arcane');
    await b.request('ping');
  };
  await hunt({ ...patrol.region, lat: patrol.region.lat + .05 });
  assert.equal(patrol.state, 'active', 'map encounters outside the target area do not complete patrols');
  await hunt(patrol.region);
  assert.equal(patrol.state, 'done', 'winning a map encounter in the area completes the patrol');

  assert.equal(recordRegionalVisit(hunter), false, 'regional visit is credited once');
  const { id: allyId } = await a.request('createChar', {
    name: 'Ally ' + Date.now().toString(36),
    cls: 'healer',
    look: { gender: 'm', face: 1, body: 1, hair: 2, hairColor: '#aa3311', tattoo: 0, skin: '#e0b090' },
  });
  assert.equal((await a.request('enter', { id: allyId })).t, 'ok');
  const ally = G.players.get(allyId)!;
  assert.equal((await a.request('geoConsent', { on: true, gps: false })).t, 'ok');
  const door = { id: 'x:d:daemonenkluft', group: true };
  const [lat, lon] = placeNear('daemonenkluft', 'dungeon:daemonenkluft');
  const outside = hunter.c.loc;
  const realm = G.locs.get('daemonenkluft')!;
  hunter.c.level = ally.c.level = 30;
  hunter.combatUntil = 0;
  Object.assign(geo, { lat, lon });
  Object.assign(ally.geo!, { lat, lon });
  assert.equal((await b.request('geoInteract', door)).t, 'err', 'private dungeon requires a party');
  assert.equal((await b.request('partyInvite', { name: ally.c.name })).t, 'ok');
  assert.equal((await a.request('partyAccept', { from: hunter.id })).t, 'ok');
  assert.equal((await b.request('geoInteract', door)).t, 'ok');
  assert.equal(hunter.c.loc, outside, 'save keeps the original map location during a private run');
  const dungeon = locOf(hunter);
  assert.notEqual(dungeon, realm);
  assert.deepEqual(partyHere(hunter), [hunter]);
  assert.equal((await a.request('geoInteract', door)).t, 'ok');
  assert.equal(locOf(ally), dungeon, 'party members use the same instance');
  assert.deepEqual(partyHere(hunter).map(p => p.id), [hunter.id, ally.id]);
  const publicMob = realm.mobs[0];
  const originalHP = publicMob.hp;
  damageMob(hunter, publicMob, originalHP, false, 'arcane');
  assert.equal(publicMob.hp, originalHP, 'instance attacks cannot hit the public dungeon');
  const boss = dungeon.mobs.find(m => m.def.role === 'boss')!;
  damageMob(hunter, boss, boss.hp, false, 'arcane');
  assert.equal((await b.request('ping')).t, 'ok');
  assert.equal(ally.c.kills[boss.def.id], 1, 'party in the same instance shares boss credit');
  assert.equal((await a.request('logout')).t, 'ok');
  assert.equal(hunter.dungeon, undefined, 'dissolving the party removes the final member');
  assert.equal(G.dungeons.size, 0, 'empty instance is reclaimed');
  assert.equal(hunter.loc, outside);
  await G.store.del('chars', allyId);
  G.chars.delete(allyId);

  await b.request('logout');
  if (saved.kind === 'file') await saved.init();
  const regionalSave = await saved.get<any>('chars', id);
  assert.deepEqual(regionalSave.quests.d_regional.region, regional.region);
  assert.equal(regionalSave.quests.d_regional.state, 'done');
  assert.equal(regionalSave.quests.d_regional_survey.state, 'done');
  assert.deepEqual(regionalSave.quests.d_regional_survey.region, survey.region);
  assert.equal(regionalSave.quests.d_regional_hunt.state, 'done');
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
