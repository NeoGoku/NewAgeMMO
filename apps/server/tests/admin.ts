import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCore, type SockLike } from '../src/core';
import { makeStore } from '../src/store-node';
import { MemoryStore } from '../src/store';

class Client implements SockLike {
  readyState = 1;
  events: Array<Record<string, unknown>> = [];
  private message!: (data: string) => void;
  private onClose!: () => void;
  private rid = 0;

  on(event: 'message' | 'close', fn: (data?: string) => void) {
    if (event === 'message') this.message = fn;
    else this.onClose = fn;
  }

  send(data: string) { this.events.push(JSON.parse(data)); }
  close() { this.readyState = 3; this.onClose(); }

  async request(t: string, payload: Record<string, unknown> = {}) {
    const rid = ++this.rid;
    this.message(JSON.stringify({ t, rid, ...payload }));
    const deadline = Date.now() + 1500;
    while (Date.now() < deadline) {
      const response = this.events.find(event => event.rid === rid);
      if (response) return response;
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error(t + ' timed out');
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'nam-admin-'));
const oldDataDir = process.env.DATA_DIR;
const oldEnvironment = process.env.ADMIN_USERS;
process.env.DATA_DIR = tmp;
process.env.ADMIN_USERS = 'Reserved';
const store = makeStore();
const core = await createCore(store, { adminUsers: () => process.env.ADMIN_USERS });

try {
  const unauthenticated = new Client();
  core.onConnection(unauthenticated);
  assert.equal((await unauthenticated.request('admin', { cmd: 'stats', admin: true })).t, 'err');
  assert.equal((await unauthenticated.request('register', { user: 'Reserved', pass: 'test-only' })).t, 'err');

  const keeper = new Client();
  const visitor = new Client();
  core.onConnection(keeper);
  core.onConnection(visitor);
  const account = await keeper.request('register', { user: 'Keeper', pass: 'test-only' });
  assert.equal(account.admin, false);
  const stored = await store.get('accounts', 'keeper');
  await store.put('accounts', 'keeper', { ...stored, admin: true });
  assert.equal((await keeper.request('login', { user: 'Keeper', pass: 'test-only' })).admin, false);
  assert.equal((await keeper.request('admin', { cmd: 'stats' })).t, 'err');

  assert.equal((await visitor.request('register', { user: 'Visitor', pass: 'test-only' })).t, 'ok');
  const { id } = await visitor.request('createChar', {
    name: 'Visitor', cls: 'archer',
    look: { gender: 'f', face: 0, body: 0, hair: 0, hairColor: '#552211', tattoo: 0, skin: '#ddaabb' }
  });
  assert.equal((await visitor.request('enter', { id })).t, 'ok');
  assert.equal((await visitor.request('admin', { cmd: 'kick', name: 'Visitor' })).t, 'err');

  process.env.ADMIN_USERS = '  kEEpEr , Reserved ';
  assert.equal((await keeper.request('admin', { cmd: 'stats' })).online, 1);
  assert.equal((await keeper.request('admin', { cmd: 'give', name: 'Visitor', id: 'constructor' })).t, 'err');
  assert.equal((await keeper.request('admin', { cmd: 'announce', text: '  ' })).t, 'err');
  assert.equal((await keeper.request('admin', { cmd: 'announce', text: 'Testnachricht' })).t, 'ok');
  assert.ok(visitor.events.some(e => e.t === 'chat' && String(e.text).endsWith('Testnachricht')));
  const readDisk = makeStore();
  await readDisk.init();
  const announcement = await readDisk.get('admin_audit', 'latest');
  if (store.kind === 'file') {
    assert.equal(announcement.length, 1, 'a successful announcement has an audit entry on disk');
    assert.equal(announcement[0].actor, 'Keeper');
    assert.equal(announcement[0].action, 'announce');
    const flush = store.flush;
    store.flush = async () => { throw new Error('test storage failure'); };
    try {
      assert.equal((await keeper.request('admin', { cmd: 'announce', text: 'Speicherfehler' })).t, 'err');
      assert.ok(!visitor.events.some(e => e.t === 'chat' && String(e.text).endsWith('Speicherfehler')));
      assert.deepEqual(await store.get('admin_audit', 'latest'), announcement, 'failed append leaves the previous audit intact');
    } finally { store.flush = flush; }
  }
  const active = await keeper.request('admin', { cmd: 'dashboard' });
  assert.equal(active.t, 'ok');
  assert.deepEqual(active.players, [{ id, name: 'Visitor', level: 1 }]);

  const oldEntries = Array.from({ length: 199 }, (_, i) => ({ ...announcement[0], id: 'old' + i }));
  await store.put('admin_audit', 'latest', [...announcement, ...oldEntries]);
  await store.flush();
  assert.equal((await keeper.request('admin', { cmd: 'kick', target: id })).t, 'ok');
  assert.equal(visitor.readyState, 3);
  assert.ok(visitor.events.some(e => e.t === 'kicked'));
  process.env.ADMIN_USERS = '';
  assert.equal((await keeper.request('admin', { cmd: 'dashboard' })).t, 'err', 'revocation applies to an active session');
  process.env.ADMIN_USERS = 'Keeper';
  const latest = await keeper.request('admin', { cmd: 'dashboard' }) as { audit: { action: string }[] };
  assert.equal(latest.audit.length, 20);
  assert.deepEqual(latest.audit.slice(0, 2).map(entry => entry.action), ['kick', 'announce']);
  const retained = await store.get('admin_audit', 'latest');
  assert.equal(retained.length, 200);
  assert.equal(retained[199].id, 'old197', 'only the oldest persisted audit entry was evicted');

  const expired = await store.get('accounts', 'keeper');
  await store.put('accounts', 'keeper', { ...expired, tokens: [] });
  assert.equal((await keeper.request('admin', { cmd: 'dashboard' })).t, 'err', 'the server rechecks the active admin token');

  await core.shutdown();
  const soloStore = new MemoryStore();
  await soloStore.put('accounts', 'keeper', { ...stored, admin: true });
  const soloCore = await createCore(soloStore);
  try {
    const solo = new Client();
    soloCore.onConnection(solo, 'solo');
    assert.equal((await solo.request('login', { user: 'Keeper', pass: 'test-only' })).admin, false);
    assert.equal((await solo.request('admin', { cmd: 'stats' })).t, 'err');
  } finally { await soloCore.shutdown(); }
} finally {
  await core.shutdown();
  if (oldDataDir === undefined) delete process.env.DATA_DIR; else process.env.DATA_DIR = oldDataDir;
  if (oldEnvironment === undefined) delete process.env.ADMIN_USERS; else process.env.ADMIN_USERS = oldEnvironment;
  rmSync(tmp, { recursive: true, force: true });
}
console.log('✓ Online admin permissions, moderation and durable audit');
