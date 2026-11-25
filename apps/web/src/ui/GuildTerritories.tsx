import { useEffect, useState } from 'react';
import { GUILD_TERRITORY } from '@nam/shared';
import { type GeoTerritoryId } from '@nam/game-data';
import { geoDo } from '../geo/bus';
import { call } from '../game';
import { set } from '../store';
import { fmtT } from './kit';

interface Territory {
  id: GeoTerritoryId;
  lat: number;
  lon: number;
  name: string;
  radius: number;
  distanceM?: number;
  canCapture: boolean;
  ownerId?: string;
  ownerName?: string;
  ownerTag?: string;
  protectionSeconds: number;
  captureGuild?: string;
  ownCapture: boolean;
  contested: boolean;
  saving: boolean;
  remainingSeconds: number;
}

export function GuildTerritories({ guildId, rank, selected }: {
  guildId?: string;
  rank: number;
  selected?: GeoTerritoryId;
}) {
  const [area, setArea] = useState<{ virtual: boolean; territories: Territory[] }>();
  const territories = area?.territories;
  const [pending, setPending] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      const reply = await call('guildTerritories', {}, true);
      if (closed) return;
      if (reply?.territories) setArea({ virtual: reply.virtual === true, territories: reply.territories });
      timer = setTimeout(refresh, 2000);
    }
    void refresh();
    return () => { closed = true; clearTimeout(timer); };
  }, [reload]);

  async function change(id: GeoTerritoryId, command: 'guildTerritoryCapture' | 'guildTerritoryCancel') {
    setPending(true);
    try {
      await call(command, { id });
      setReload(attempt => attempt + 1);
    } finally {
      setPending(false);
    }
  }

  function routeTo(territory: Territory) {
    set({ panel: null, selected: null });
    geoDo('walkTo', { lat: territory.lat, lon: territory.lon, name: territory.name });
  }

  const displayed = territories && [...territories].sort((a, b) =>
    Number(b.id === selected) - Number(a.id === selected) || (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  return <div className="col" aria-label="Gildengebiete">
    <p className="dim sm">Offiziere und Anführer können Gebiete erobern. Halte den markierten Radius {GUILD_TERRITORY.holdMs / 1000} Sekunden ohne Kampf und Bewegung. Besetzte Gebiete sind während eines Gildenkriegs eroberbar. Verteidiger vor Ort setzen die Haltezeit zurück.</p>
    {!displayed && <p className="dim" role="status">Gebiete werden geladen …</p>}
    {displayed?.map(territory => {
      const own = !!guildId && territory.ownerId === guildId;
      const controls = territory.ownerName ? `[${territory.ownerTag}] ${territory.ownerName}` : 'Unbesetzt';
      return <article className="card col" key={territory.id}>
        <div className="row wrap"><b className="grow">{territory.name}</b><span className="pill">{controls}</span></div>
        <div className="dim sm">
          {territory.distanceM !== undefined
            ? `${territory.distanceM >= 1000 ? (territory.distanceM / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' km' : territory.distanceM + ' m'} entfernt`
            : 'Aktiviere die Kartenposition'} · Radius {territory.radius} m
        </div>
        {territory.protectionSeconds > 0 && <div className="dim sm">Eroberungsschutz {fmtT(territory.protectionSeconds * 1000)}</div>}
        {territory.saving && <div role="status">Kontrollwechsel wird gespeichert …</div>}
        {territory.captureGuild && <div role="status">{territory.captureGuild} erobert das Gebiet · {territory.contested ? 'Durch Verteidiger umkämpft' : `${territory.remainingSeconds} Sek. verbleibend`}</div>}
        <div className="row wrap">
          <button type="button" className="btn sm" disabled={!area?.virtual} onClick={() => routeTo(territory)}>Virtuelle Route planen</button>
          {rank >= 2 && !own && !territory.ownCapture && <button type="button" className="btn sm pri" disabled={pending || !territory.canCapture} onClick={() => void change(territory.id, 'guildTerritoryCapture')}>Gebiet erobern</button>}
          {territory.ownCapture && <button type="button" className="btn sm dng" disabled={pending} onClick={() => void change(territory.id, 'guildTerritoryCancel')}>Eroberung abbrechen</button>}
        </div>
      </article>;
    })}
  </div>;
}
