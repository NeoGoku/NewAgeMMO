import assert from 'node:assert/strict';
import { newChar } from '../../server/src/chars';
import * as backups from '../src/solo/backup';

const character = newChar('a123', 'Aria', 'archer', {
  gender: 'f', face: 0, body: 0, hair: 0, hairColor: '#553311', tattoo: 0, skin: '#ddbb99',
});
character.level = 12;
character.questsDone = ['q_home'];
const data = {
  accounts: { player: { id: 'a123', name: 'Player', hash: 'a'.repeat(64), salt: 'b'.repeat(32), created: 123, tokens: [] } },
  chars: { [character.id]: character },
};

const encoded = backups.serializeSoloBackup(data);
assert.deepEqual(backups.parseSoloBackup(encoded), data, 'preserve local credentials, characters, items, and quests');
assert.throws(() => backups.parseSoloBackup('{invalid'), /Sicherung/);
const corrupt = JSON.parse(encoded);
corrupt.data.chars[character.id].inventory = {};
assert.throws(() => backups.parseSoloBackup(JSON.stringify(corrupt)), /Spielstand/);
const orphan = JSON.parse(encoded);
orphan.data.accounts = {};
assert.throws(() => backups.parseSoloBackup(JSON.stringify(orphan)), /Spielstand/);
const unsupported = JSON.parse(encoded);
unsupported.version = 2;
assert.throws(() => backups.parseSoloBackup(JSON.stringify(unsupported)), /Version/);
const online = JSON.parse(encoded);
online.format = 'newagemmo-online';
assert.throws(() => backups.parseSoloBackup(JSON.stringify(online)), /Solo/);
console.log('Solo backup validation passed');
