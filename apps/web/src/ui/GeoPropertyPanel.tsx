import React, { useEffect, useState } from 'react';
import { GEO, PROPERTY_SOURCE, type GeoPropertyOffer } from '@nam/shared';
import { call } from '../game';
import { geoDo } from '../geo/bus';
import { net } from '../net';
import { set, toast, useS } from '../store';
import { fmt, Win } from './kit';

interface Catalog {
  region: string;
  regionalStatus?: 'disabled' | 'unavailable' | 'ready';
  snapshot?: string;
  activePosition: boolean;
  virtual: boolean;
  hasHome: boolean;
  list: GeoPropertyOffer[];
}

const buildingNames: Record<string, string> = {
  apartments: 'Mehrfamilienhaus', detached: 'Einfamilienhaus', house: 'Haus', residential: 'Wohngebäude',
  semidetached_house: 'Doppelhaushälfte', terrace: 'Reihenhaus', bungalow: 'Bungalow', dormitory: 'Wohnheim', commercial: 'Gewerbeimmobilie', retail: 'Ladenlokal', office: 'Bürogebäude',
};
const inRange = (property: GeoPropertyOffer) => property.distanceM !== undefined && property.distanceM <= GEO.interactM;

function PropertyFootprint({ footprint }: { footprint: NonNullable<GeoPropertyOffer['footprint']> }) {
  const polygons = footprint.type === 'Polygon' ? [footprint.coordinates] : footprint.coordinates;
  const rings = polygons.flat();
  const points = rings.flat();
  const west = Math.min(...points.map(p => p[0]));
  const east = Math.max(...points.map(p => p[0]));
  const south = Math.min(...points.map(p => p[1]));
  const north = Math.max(...points.map(p => p[1]));
  const aspect = Math.cos((south + north) * Math.PI / 360);
  const scale = 82 / Math.max((east - west) * aspect, north - south, 0.000001);
  return <svg role="img" aria-label="Gebäudegrundriss aus OpenStreetMap" viewBox="0 0 100 100" width="110" height="110">
    <path fillRule="evenodd" fill="#124c59" stroke="#72eff1" strokeWidth="1"
      d={rings.map(ring => ring.map(([lon, lat], i) => `${i ? 'L' : 'M'}${9 + (lon - west) * aspect * scale} ${9 + (north - lat) * scale}`).join(' ') + 'Z').join(' ')} />
  </svg>;
}

export function GeoPropertyPanel({ id }: { id?: string }) {
  const char = useS(s => s.char);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmSale, setConfirmSale] = useState('');
  const [tab, setTab] = useState<'market' | 'travel'>('market');
  const [type, setType] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minArea, setMinArea] = useState('');
  const [maxDistance, setMaxDistance] = useState('');
  const refresh = () => setVersion(n => n + 1);
  useEffect(() => {
    let current = true;
    setCatalog(null);
    setError('');
    void net.req('geoPropertyList', id ? { id } : {}).then(result => {
      if (!current) return;
      if (result.t === 'err') setError(result.err);
      else setCatalog(result as unknown as Catalog);
    });
    return () => { current = false; };
  }, [id, version]);

  async function action(t: string, property: GeoPropertyOffer) {
    setBusy(true);
    try {
      const result = await call(t, { id: t === 'houseEnter' ? property.houseId : property.id });
      if (!result) return;
      if (t === 'geoPropertyTravel') {
        set({ panel: null });
        geoDo('recenter');
      } else if (t === 'houseEnter') set({ panel: null });
      else {
        toast(t === 'geoPropertyBuy' ? 'Immobilie gekauft' : `Immobilie verkauft · +${fmt(result.gold)} Gold`, 'ok');
        setConfirmSale('');
        refresh();
      }
    } finally { setBusy(false); }
  }

  function plan(property: GeoPropertyOffer) {
    set({ panel: null });
    geoDo('walkTo', { lat: property.lat, lon: property.lon, name: buildingNames[property.building] || 'Wohngebäude' });
  }

  const displayed = catalog?.list.filter(property => tab === 'travel' ? property.status === 'mine' :
    (!type || property.building === type) &&
    (!maxPrice || property.buyGold <= Number(maxPrice)) &&
    (!minArea || property.floorAreaM2 >= Number(minArea)) &&
    (!maxDistance || (property.distanceM !== undefined && property.distanceM <= Number(maxDistance)))) ?? [];

  return <Win title="Immobilien" icon="⌂" w={610} onClose={() => set({ panel: null })}>
    <div className="row wrap">
      <strong className="grow">{catalog?.region ?? 'In deiner Region'}</strong>
      {id && <button className="btn sm" onClick={() => set({ selected: null })}>Übersicht</button>}
      <button className="btn sm" disabled={busy} onClick={refresh}>Aktualisieren</button>
      <button className="btn sm" onClick={() => { void call('houseList'); set({ panel: 'houses', selected: null }); }}>Parzellen</button>
    </div>
    <div className="row wrap" aria-label="Immobilienansicht">
      <button className={'btn sm' + (tab === 'market' ? ' on' : '')} aria-pressed={tab === 'market'} onClick={() => setTab('market')}>Markt</button>
      <button className={'btn sm' + (tab === 'travel' ? ' on' : '')} aria-pressed={tab === 'travel'} onClick={() => { setTab('travel'); if (id) set({ selected: null }); }}>Schnellreise</button>
    </div>
    {tab === 'market' && !id && <details className="card">
      <summary>Immobilien filtern</summary>
      <div className="row wrap">
        <label>Typ <select value={type} onChange={e => setType(e.target.value)}><option value="">Alle</option>
          {Object.entries(buildingNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select></label>
        <label>Preis bis (Gold) <input inputMode="numeric" type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} /></label>
        <label>Ab Geschossfläche (m²) <input inputMode="numeric" type="number" min="0" value={minArea} onChange={e => setMinArea(e.target.value)} /></label>
        <label>Entfernung bis (m) <input inputMode="numeric" type="number" min="0" value={maxDistance} onChange={e => setMaxDistance(e.target.value)} /></label>
      </div>
    </details>}
    {error ? <p className="err" role="alert">{error}</p> : !catalog ? <p role="status">Immobilien werden geladen …</p> : <>
      {!displayed.length && <p className="dim">
        {tab === 'travel' ? 'Dein Charakter hat noch keinen Immobilien-Schnellreisepunkt.' : catalog.list.length ? 'Keine Immobilien passen zu diesen Filtern.' :
          !catalog.activePosition ? 'Aktiviere einen Standort auf der Karte, um Immobilien in der Nähe zu sehen.' :
          !catalog.snapshot && catalog.regionalStatus === 'disabled' ? 'Live-Import ist auf diesem Server nicht eingerichtet.' :
          !catalog.snapshot && catalog.regionalStatus === 'unavailable' ? 'Der regionale Gebäudekatalog ist vorübergehend nicht erreichbar. Versuche es später erneut.' :
            'Im Umkreis deiner Position sind keine Immobilien im Katalog.'}
      </p>}
      <div className="col scroll" style={{ maxHeight: '55vh' }}>{displayed.map(property => {
        const name = buildingNames[property.building] || 'Wohngebäude';
        const nearby = inRange(property);
        const status = property.status === 'mine' ? 'Dein Eigentum' : property.status === 'owned' ? 'Vergeben' : 'Kauf verfügbar';
        return <article key={property.id} className="card col">
          <div className="row wrap"><b className="grow">{name}</b><span className="pill">{status}</span></div>
          <div className="sm">
            {fmt(property.footprintM2)} m² Grundfläche · ca. {fmt(property.floorAreaM2)} m² Geschossfläche · {property.levels} Geschosse
            {property.levelsEstimated ? ' (geschätzt)' : ''}
            {' · ca. '}{fmt(property.estimatedRooms)} Zimmer (geschätzt)
          </div>
          {property.footprint && <PropertyFootprint footprint={property.footprint} />}
          <div className="row wrap sm dim">
            {property.distanceM !== undefined && <span>{fmt(property.distanceM)} m entfernt</span>}
            <a href={`https://www.openstreetmap.org/${property.osmId}`} target="_blank" rel="noreferrer">{PROPERTY_SOURCE}</a>
            {property.status === 'available' && <span className="gold">{fmt(property.buyGold)} Gold</span>}
          </div>
          <div className="row wrap">
            {!id && <button className="btn sm" onClick={() => set({ selected: { id: property.id } })}>Besichtigen</button>}
            {!nearby && <button className="btn sm" disabled={busy || !catalog.activePosition || !catalog.virtual} onClick={() => plan(property)}>Route planen</button>}
            {property.status === 'available' && <button className="btn sm pri"
              disabled={busy || !nearby || catalog.hasHome || (char?.gold ?? 0) < property.buyGold}
              onClick={() => void action('geoPropertyBuy', property)}>Kaufen</button>}
            {property.houseId && nearby && <button className="btn sm pri" disabled={busy}
              onClick={() => void action('houseEnter', property)}>Betreten</button>}
            {property.status === 'mine' && <button className="btn sm" disabled={busy || !catalog.virtual}
              onClick={() => void action('geoPropertyTravel', property)}>Nach Hause reisen</button>}
            {property.status === 'mine' && confirmSale !== property.id && <button className="btn sm dng" disabled={busy}
              onClick={() => setConfirmSale(property.id)}>Für {fmt(property.sellGold ?? 0)} Gold verkaufen</button>}
            {property.status === 'mine' && confirmSale === property.id && <>
              <button className="btn sm dng" disabled={busy} onClick={() => void action('geoPropertySell', property)}>Verkauf bestätigen</button>
              <button className="btn sm" disabled={busy} onClick={() => setConfirmSale('')}>Abbrechen</button>
            </>}
          </div>
          {property.status === 'available' && catalog.hasHome && <div className="xs dim">Dein Charakter besitzt bereits ein Haus.</div>}
          {property.status === 'available' && !catalog.hasHome && !nearby && <div className="xs dim">Der Kauf ist innerhalb von {GEO.interactM} m möglich.</div>}
          {property.status === 'mine' && !catalog.virtual && <div className="xs dim">Die Heimreise ist im virtuellen Kartenmodus verfügbar.</div>}
        </article>;
      })}</div>
      {(catalog.snapshot || !!catalog.list.length) && <p className="xs dim">
        Gebäudedaten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap-Mitwirkende</a>
        {catalog.snapshot ? ` · Datenstand ${catalog.snapshot.slice(0, 10)}` : ''}. Preise gelten im Spiel.
      </p>}
    </>}
  </Win>;
}
