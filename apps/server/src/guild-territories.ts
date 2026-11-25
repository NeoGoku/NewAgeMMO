import { GEO_ANCHORS, GEO_TERRITORIES, validGeoTerritoryId, type GeoTerritoryId } from '@nam/game-data';
import { GUILD_TERRITORY, haversine, type GeoObj } from '@nam/shared';
import { H, NO_CHAR } from './handlers';
import { G, now, sys, type Guild, type Player } from './state';
import { WriteOrder } from './write-order';

interface Claim { id: GeoTerritoryId; guildId: string; capturedAt: number }
interface Capture { playerId: string; guildId: string; heldSince: number; contested: boolean }
const COLLECTION = 'territories';
const territoryIds = Object.keys(GEO_TERRITORIES) as GeoTerritoryId[];
const claims = new Map<GeoTerritoryId, Claim>();
const captures = new Map<GeoTerritoryId, Capture>();
const committing = new Set<GeoTerritoryId>();
const writes = new WriteOrder();

export async function restoreTerritories() {
  claims.clear();
  captures.clear();
  committing.clear();
  for (const claim of await G.store.all<Claim>(COLLECTION)) {
    if (validGeoTerritoryId(claim?.id) && typeof claim.guildId === 'string' && Number.isSafeInteger(claim.capturedAt) &&
        claim.capturedAt > 0) claims.set(claim.id, claim);
  }
}

export const saveTerritoryChanges = () => writes.drain();

function ownerAt(id: GeoTerritoryId) {
  const claim = claims.get(id);
  return claim && G.guilds.get(claim.guildId);
}

function coordinates(id: GeoTerritoryId) {
  const [lat, lon] = GEO_ANCHORS[GEO_TERRITORIES[id].loc];
  return { lat, lon };
}

function playerDistance(p: Player, { lat, lon }: { lat: number; lon: number }, time: number) {
  const geo = p.geo;
  if (!p.online || p.dead || p.houseId || p.inScene || p.travel || !geo?.on || !geo.has || geo.lockUntil > time) return;
  if (geo.gps && (!geo.fix || time - geo.fix.at > GUILD_TERRITORY.gpsFreshMs)) return;
  return haversine(lat, lon, geo.lat, geo.lon);
}

function captureError(p: Player, id: GeoTerritoryId, g: Guild | undefined, time: number) {
  if (!g || (g.members[p.id]?.rank ?? -1) < 2) return 'Nur Offiziere oder der Gildenanführer können ein Gebiet erobern';
  const distance = playerDistance(p, coordinates(id), time);
  if (distance === undefined || distance > GEO_TERRITORIES[id].radius) return 'Begib dich mit aktivem Standort in den markierten Gebietsradius';
  if (p.duel || p.combatUntil > time || p.geo?.steer || p.c.geo?.trip?.startedAt != null || p.geo?.routePlanning) {
    return 'Beende zuerst Kampf und Bewegung';
  }
  const owner = ownerAt(id);
  if (owner?.id === g.id) return 'Deine Gilde kontrolliert dieses Gebiet bereits';
  if (owner && (g.war?.vs !== owner.id || g.war.until <= time || owner.war?.vs !== g.id || owner.war.until <= time)) {
    return 'Für die Übernahme ist ein aktiver Krieg gegen die kontrollierende Gilde erforderlich';
  }
  if (owner && claims.get(id)!.capturedAt + GUILD_TERRITORY.recaptureMs > time) return 'Das Gebiet steht noch unter Eroberungsschutz';
}

function defending(id: GeoTerritoryId, time: number) {
  const owner = ownerAt(id);
  if (!owner) return false;
  const point = coordinates(id);
  const radius = GEO_TERRITORIES[id].radius;
  return Object.keys(owner.members).some(playerId => {
    const player = G.players.get(playerId);
    return player && (playerDistance(player, point, time) ?? Infinity) <= radius;
  });
}

function notifyGuild(guild: Guild | undefined, message: string) {
  if (!guild) return;
  for (const member of Object.keys(guild.members)) sys(G.players.get(member), message, 'guild');
}

export function territoryObjects(): GeoObj[] {
  return territoryIds.map(id => {
    const territory = GEO_TERRITORIES[id];
    const owner = ownerAt(id);
    return {
      id: 'x:territory:' + id, k: 'territory', def: id, name: territory.name, ...coordinates(id),
      r: territory.radius, extra: { ownerName: owner?.name, ownerTag: owner?.tag },
    };
  });
}

export function registerGuildTerritories() {
  H.guildTerritories = p => {
    const time = now();
    const guild = p.c.guildId ? G.guilds.get(p.c.guildId) : undefined;
    return { virtual: p.geo?.on === true && !p.geo.gps, territories: territoryIds.map(id => {
      const claim = claims.get(id);
      const owner = ownerAt(id);
      const active = captures.get(id);
      const distance = playerDistance(p, coordinates(id), time);
      return {
        id, ...GEO_TERRITORIES[id], ...coordinates(id), distanceM: distance === undefined ? undefined : Math.round(distance),
        canCapture: !active && !committing.has(id) && !captureError(p, id, guild, time),
        ownerId: owner?.id, ownerName: owner?.name, ownerTag: owner?.tag,
        protectionSeconds: owner && claim ? Math.max(0, Math.ceil((claim.capturedAt + GUILD_TERRITORY.recaptureMs - time) / 1000)) : 0,
        captureGuild: active ? G.guilds.get(active.guildId)?.name : undefined,
        ownCapture: active?.playerId === p.id,
        contested: active?.contested ?? false,
        saving: committing.has(id),
        remainingSeconds: active ? Math.max(0, Math.ceil((GUILD_TERRITORY.holdMs - (time - active.heldSince)) / 1000)) : 0,
      };
    }) };
  };

  H.guildTerritoryCapture = (p, message) => {
    const id = message.id;
    if (!validGeoTerritoryId(id)) return 'Unbekanntes Gildengebiet';
    if (committing.has(id) || captures.has(id)) return 'Hier läuft bereits eine Eroberung';
    if ([...captures.values()].some(capture => capture.playerId === p.id)) return 'Du eroberst bereits ein anderes Gebiet';
    const guild = p.c.guildId ? G.guilds.get(p.c.guildId) : undefined;
    const time = now();
    const error = captureError(p, id, guild, time);
    if (error || !guild) return error;
    captures.set(id, { playerId: p.id, guildId: guild.id, heldSince: time, contested: defending(id, time) });
    notifyGuild(ownerAt(id), `${guild.name} greift ${GEO_TERRITORIES[id].name} an.`);
  };

  H.guildTerritoryCancel = (p, message) => {
    const id = message.id;
    if (!validGeoTerritoryId(id) || captures.get(id)?.playerId !== p.id) return 'Du eroberst dieses Gebiet gerade nicht';
    captures.delete(id);
  };

  for (const command of ['guildTerritories', 'guildTerritoryCapture', 'guildTerritoryCancel']) NO_CHAR.add(command);
}

export function tickTerritories() {
  const time = now();
  for (const [id, capture] of captures) {
    const player = G.players.get(capture.playerId);
    const guild = G.guilds.get(capture.guildId);
    if (!player || !guild || player.c.guildId !== guild.id || captureError(player, id, guild, time)) {
      captures.delete(id);
      sys(player, 'Gebietseroberung abgebrochen.', 'guild');
      continue;
    }
    const contested = defending(id, time);
    if (contested || capture.contested) capture.heldSince = time;
    capture.contested = contested;
    if (time - capture.heldSince < GUILD_TERRITORY.holdMs) continue;
    captures.delete(id);
    committing.add(id);
    const previous = claims.get(id);
    const previousOwner = ownerAt(id);
    const claim = { id, guildId: guild.id, capturedAt: time };
    const territoryName = GEO_TERRITORIES[id].name;
    void writes.run(id, async () => {
      try {
        await G.store.put(COLLECTION, id, claim);
        await G.store.flush();
        claims.set(id, claim);
        notifyGuild(guild, `${territoryName} erobert.`);
        notifyGuild(previousOwner, `${territoryName} ging an ${guild.name} verloren.`);
      } catch (error) {
        console.error('guild_territory_save', error);
        try {
          if (previous) await G.store.put(COLLECTION, id, previous);
          else await G.store.del(COLLECTION, id);
          await G.store.flush();
        } catch (rollbackError) { console.error('guild_territory_restore', rollbackError); }
        sys(player, 'Die Eroberung konnte nicht gespeichert werden.', 'guild');
      } finally {
        committing.delete(id);
      }
    });
  }
}
