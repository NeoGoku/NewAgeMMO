import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';

const [source, destination, snapshot] = process.argv.slice(2);
if (!source || !destination || !Number.isFinite(Date.parse(snapshot))) throw new Error('OSM-Quelldatei, Ausgabe und Datenstand sind erforderlich.');

const forbidden = new Set(['no', 'private', 'customers', 'delivery', 'agricultural', 'forestry', 'permit']);
const footways = new Set(['footway', 'pedestrian', 'path', 'living_street', 'residential', 'service', 'unclassified',
  'tertiary', 'tertiary_link', 'secondary', 'secondary_link', 'primary', 'primary_link', 'track', 'steps']);
const footAllowed = new Set(['yes', 'designated', 'permissive']);
const nodes = new Map();
const index = new Map();
const points = [], edges = [];
const distinct = new Set();
function tagsOf(fields) {
  return new Map((fields.find(field => field.startsWith('T'))?.slice(1) || '').split(',').map(tag => tag.split('=')));
}
function coordinate(id) {
  if (!index.has(id)) {
    index.set(id, points.length / 2);
    points.push(...nodes.get(id));
  }
  return index.get(id);
}
for await (const line of createInterface({ input: createReadStream(source), crlfDelay: Infinity })) {
  const [id, ...fields] = line.split(' ');
  const tags = tagsOf(fields);
  if (id.startsWith('n')) {
    const x = Number(fields.find(f => f.startsWith('x'))?.slice(1));
    const y = Number(fields.find(f => f.startsWith('y'))?.slice(1));
    // Retain only inside the clipped region, and avoid crossing barriers without mapped foot access.
    if (x < 10.43 || x > 10.62 || y < 52.215 || y > 52.34 || !Number.isFinite(x + y) ||
      forbidden.has(tags.get('foot')) ||
      (!footAllowed.has(tags.get('foot')) && (forbidden.has(tags.get('access')) ||
        (tags.has('barrier') && !['bollard', 'cycle_barrier', 'stile', 'cattle_grid', 'kerb'].includes(tags.get('barrier')))))) continue;
    nodes.set(id, [Math.round(y * 1e6), Math.round(x * 1e6)]);
  } else if (id.startsWith('w')) {
    const highway = tags.get('highway'), foot = tags.get('foot');
    if (!highway || ['construction', 'proposed', 'motorway', 'motorway_link', 'trunk', 'trunk_link'].includes(highway) ||
      forbidden.has(foot) || tags.get('motorroad') === 'yes' || tags.has('foot:conditional') || tags.has('access:conditional') ||
      (!footAllowed.has(foot) && (!footways.has(highway) || forbidden.has(tags.get('access'))))) continue;
    const refs = fields.find(field => field.startsWith('N'))?.slice(1).split(',') ?? [];
    for (let i = 1; i < refs.length; i++) {
      const left = refs[i - 1], right = refs[i];
      if (left === right || !nodes.has(left) || !nodes.has(right)) continue;
      const a = coordinate(left), b = coordinate(right);
      const sign = tags.get('oneway:foot');
      for (const [from, to] of [[a, b], [b, a]]) {
        if ((sign === '-1' && from === a) || (['yes', '1', 'true'].includes(sign) && from === b)) continue;
        const key = from + ':' + to;
        if (distinct.has(key)) continue;
        distinct.add(key);
        edges.push(from, to);
      }
    }
  }
}
if (points.length < 2000 || points.length > 180000 || edges.length < 4000 || edges.length > 450000) {
  throw new Error(`Unplausibler Gehwegenetz-Extrakt (${points.length / 2} Knoten, ${edges.length / 2} Kanten).`);
}
const data = {
  version: 1, source: 'OpenStreetMap', snapshot, points, edges,
  attribution: '© OpenStreetMap contributors', sourceUrl: 'https://www.openstreetmap.org/copyright',
  importSource: 'https://download.geofabrik.de/europe/germany/niedersachsen.html',
  license: 'https://opendatacommons.org/licenses/odbl/1-0/',
};
await writeFile(destination, JSON.stringify(data) + '\n', { flag: 'wx' });
console.log(`${points.length / 2} Knoten und ${edges.length / 2} gerichtete Kanten (${snapshot}).`);
