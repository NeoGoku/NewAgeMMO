import React, { useEffect, useState } from 'react';
import { GEO, PROPERTY_SOURCE, type GeoPropertyOffer } from '@nam/shared';
import { call } from '../game';
import { geoDo } from '../geo/bus';
import { matchesProperty, propertyBuildingNames as buildingNames } from '../geo/property-filter';
import { net } from '../net';
import { set, toast, useS } from '../store';
import { fmt, Win } from './kit';
import { PropertyFilterFields } from './PropertyFilterFields';

interface Catalog {
  region: string;
  regionalStatus?: 'disabled' | 'unavailable' | 'ready';
  snapshot?: string;
  activePosition: boolean;
  virtual: boolean;
  hasHome: boolean;
  list: GeoPropertyOffer[];
}

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
  const [tab, setTab] = useState<'market' | 'travel' | 'rentals'>('market');
  const propertyFilters = useS(state => state.propertyFilters);
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

  async function action(t: string, property: GeoPropertyOffer, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const result = await call(t, { id: t === 'houseEnter' ? property.houseId : property.id, ...extra });
      if (!result) return;
      if (t === 'geoPropertyTravel') {
        set({ panel: null });
        geoDo('recenter');
      } else if (t === 'houseEnter') set({ panel: null });
      else {
        const feedback: Record<string, string> = {
          geoPropertyBuild: 'Grundstück bebaut', geoPropertyBuy: 'Immobilie gekauft',
          geoPropertyRent: 'Mietvertrag abgeschlossen', geoPropertyRenew: 'Mietvertrag verlängert',
          geoPropertyEndLease: 'Mietvertrag beendet', geoPropertyLeaseOffer: extra.on ? 'Mietangebot veröffentlicht' : 'Mietangebot zurückgezogen',
          geoPropertySell: `Immobilie verkauft · +${fmt(result.gold ?? 0)} Gold`,
        };
        toast(feedback[t], 'ok');
        setConfirmSale('');
        refresh();
      }
    } finally { setBusy(false); }
  }

  function plan(property: GeoPropertyOffer) {
    set({ panel: null });
    geoDo('walkTo', { lat: property.lat, lon: property.lon, name: buildingNames[property.building] || 'Wohngebäude' });
  }

  const displayed = catalog?.list.filter(property => {
    if (tab === 'travel') return property.status === 'mine' && !property.rentalManagement?.until;
    if (tab === 'rentals') return !!(property.rentUntil || property.rentalManagement);
    return id || matchesProperty(property, propertyFilters);
  }) ?? [];

  return <Win title="Immobilien" icon="⌂" w={610} onClose={() => set({ panel: null })}>
    <div className="row wrap">
      <strong className="grow">{catalog?.region ?? 'In deiner Region'}</strong>
      {id && <button className="btn sm" onClick={() => set({ selected: null })}>Übersicht</button>}
      <button className="btn sm" disabled={busy} onClick={refresh}>Aktualisieren</button>
      <button className="btn sm" onClick={() => { void call('houseList'); set({ panel: 'houses', selected: null }); }}>Parzellen</button>
    </div>
    <div className="row wrap" aria-label="Immobilienansicht">
      <button className={'btn sm' + (tab === 'market' ? ' on' : '')} aria-pressed={tab === 'market'} onClick={() => setTab('market')}>Markt</button>
      <button className={'btn sm' + (tab === 'rentals' ? ' on' : '')} aria-pressed={tab === 'rentals'} onClick={() => { setTab('rentals'); if (id) set({ selected: null }); }}>Mietverträge</button>
      <button className={'btn sm' + (tab === 'travel' ? ' on' : '')} aria-pressed={tab === 'travel'} onClick={() => { setTab('travel'); if (id) set({ selected: null }); }}>Schnellreise</button>
    </div>
    {tab === 'market' && !id && <PropertyFilterFields />}
    {error ? <p className="err" role="alert">{error}</p> : !catalog ? <p role="status">Immobilien werden geladen …</p> : <>
      {!displayed.length && <p className="dim">
        {tab === 'travel' ? 'Dein Charakter hat noch keinen Immobilien-Schnellreisepunkt.' :
          tab === 'rentals' ? 'Dein Charakter hat noch keine Immobilie zur Vermietung und keinen Mietvertrag.' : catalog.list.length ? 'Keine Immobilien passen zu diesen Filtern.' :
          !catalog.activePosition ? 'Aktiviere einen Standort auf der Karte, um Immobilien in der Nähe zu sehen.' :
          !catalog.snapshot && catalog.regionalStatus === 'disabled' ? 'Live-Import ist auf diesem Server nicht eingerichtet.' :
          !catalog.snapshot && catalog.regionalStatus === 'unavailable' ? 'Der regionale Gebäudekatalog ist vorübergehend nicht erreichbar. Versuche es später erneut.' :
            'Im Umkreis deiner Position sind keine Immobilien im Katalog.'}
      </p>}
      <div className="col scroll" style={{ maxHeight: '55vh' }}>{displayed.map(property => {
        const name = property.unitAreaM2 ? 'Wohnung im Mehrfamilienhaus' : buildingNames[property.building] || 'Wohngebäude';
        const nearby = inRange(property);
        const canBuy = property.marketStatus === 'sale' || property.marketStatus === 'plot';
        const canRent = (property.marketStatus === 'rentable' || property.marketStatus === 'sale') && property.rentGold !== undefined;
        const management = property.rentalManagement;
        const status = property.status === 'mine' ? property.rentUntil ? 'Gemietet' :
          management?.until ? 'Dein Eigentum · Vermietet' : 'Dein Eigentum' :
          property.status === 'owned' ? 'Belegt' : canBuy && canRent ? 'Kauf oder Miete' : canRent ? 'Miete verfügbar' : 'Kauf verfügbar';
        return <article key={property.id} className="card col">
          <div className="row wrap"><b className="grow">{name}</b><span className="pill">{status}</span></div>
          <div className="sm">
            {fmt(property.footprintM2)} m² {property.building === 'virtual_plot' ? 'Grundstücksfläche · Ausbau im Spiel' :
              `Grundfläche · ca. ${fmt(property.floorAreaM2)} m² Geschossfläche · ${property.levels} Geschosse`}
            {property.levelsEstimated ? ' (geschätzt)' : ''}
            {property.estimatedRooms > 0 && <> · ca. {fmt(property.estimatedRooms)} Zimmer (geschätzt)</>}
          </div>
          {!!property.usableAreaEstimateM2 && <div className="sm dim">{fmt(property.usableAreaEstimateM2)} m² {
            ['commercial', 'office', 'retail'].includes(property.building) ? 'Nutzfläche' : 'Wohnfläche'} (geschätzt)</div>}
          {property.footprint && <PropertyFootprint footprint={property.footprint} />}
          <div className="row wrap sm dim">
            {property.distanceM !== undefined && <span>{fmt(property.distanceM)} m entfernt</span>}
            <a href={`https://www.openstreetmap.org/${property.osmId}`} target="_blank" rel="noreferrer">{PROPERTY_SOURCE}</a>
            {canBuy && <span className="gold">{fmt(property.buyGold)} Gold</span>}
            {canRent && <span className="gold">Miete {fmt(property.rentGold!)} Gold/Woche</span>}
            {property.rentUntil && <span>Miete bis {new Date(property.rentUntil).toLocaleDateString('de-DE')}{property.rentOverdue ? ' · überfällig' : ''}</span>}
            {management?.until && <span>Vermietet{management.tenantName ? ' an ' + management.tenantName : ''} bis {new Date(management.until).toLocaleDateString('de-DE')}</span>}
          </div>
          <div className="row wrap">
            {!id && <button className="btn sm" onClick={() => set({ selected: { id: property.id } })}>Besichtigen</button>}
            {!nearby && <button className="btn sm" disabled={busy || !catalog.activePosition || !catalog.virtual} onClick={() => plan(property)}>Route planen</button>}
            {canBuy && <button className="btn sm pri"
              disabled={busy || !nearby || catalog.hasHome || (char?.gold ?? 0) < property.buyGold}
              onClick={() => void action('geoPropertyBuy', property)}>Kaufen</button>}
            {canRent && <button className="btn sm"
              disabled={busy || !nearby || catalog.hasHome || (char?.gold ?? 0) < property.rentGold!}
              onClick={() => void action('geoPropertyRent', property)}>Mieten</button>}
            {property.status === 'mine' && !!property.rentUntil && !!property.rentGold && <button className="btn sm" disabled={busy || (char?.gold ?? 0) < property.rentGold}
              onClick={() => void action('geoPropertyRenew', property)}>Miete verlängern ({fmt(property.rentGold)} Gold)</button>}
            {property.buildGold !== undefined && <button className="btn sm" disabled={busy || !nearby || (char?.gold ?? 0) < property.buildGold}
              onClick={() => void action('geoPropertyBuild', property)}>Für {fmt(property.buildGold)} Gold bebauen</button>}
            {property.houseId && nearby && <button className="btn sm pri" disabled={busy}
              onClick={() => void action('houseEnter', property)}>Betreten</button>}
            {property.status === 'mine' && !management?.until && <button className="btn sm" disabled={busy || !catalog.virtual}
              onClick={() => void action('geoPropertyTravel', property)}>Nach Hause reisen</button>}
            {management && <button className="btn sm" disabled={busy}
              onClick={() => void action('geoPropertyLeaseOffer', property, { on: !management.listed })}>
              {management.listed ? 'Mietangebot zurückziehen' : `Für ${fmt(management.weeklyGold)} Gold/Woche anbieten`}
            </button>}
            {(property.rentUntil || property.sellGold !== undefined) && confirmSale !== property.id && <button className="btn sm dng" disabled={busy}
              onClick={() => setConfirmSale(property.id)}>{property.rentUntil ? 'Mietvertrag beenden' : `Für ${fmt(property.sellGold ?? 0)} Gold verkaufen`}</button>}
            {property.status === 'mine' && confirmSale === property.id && <>
              <button className="btn sm dng" disabled={busy} onClick={() => void action(property.rentUntil ? 'geoPropertyEndLease' : 'geoPropertySell', property)}>{property.rentUntil ? 'Beenden bestätigen' : 'Verkauf bestätigen'}</button>
              <button className="btn sm" disabled={busy} onClick={() => setConfirmSale('')}>Abbrechen</button>
            </>}
          </div>
          {property.status === 'available' && catalog.hasHome && <div className="xs dim">Dein Charakter besitzt bereits ein Haus.</div>}
          {property.status === 'available' && !catalog.hasHome && !nearby && <div className="xs dim">{canBuy && canRent ? 'Kauf und Miete sind' : canBuy ? 'Der Kauf ist' : 'Die Miete ist'} innerhalb von {GEO.interactM} m möglich.</div>}
          {management?.listed && <div className="xs dim">Mietangebot für {fmt(management.weeklyGold)} Gold pro Woche aktiv.</div>}
          {property.rentOverdue && <div className="xs dim">Verlängere den Vertrag oder hole deine Einrichtung und Vorräte ab.</div>}
          {property.status === 'mine' && !catalog.virtual && <div className="xs dim">Die Heimreise ist im virtuellen Kartenmodus verfügbar.</div>}
        </article>;
      })}</div>
      {(catalog.snapshot || !!catalog.list.length) && <p className="xs dim">
        Gebäudedaten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap-Mitwirkende</a>
        {catalog.snapshot ? ` · Datenstand ${catalog.snapshot.slice(0, 10)}` : ''}. Preise und Mieten gelten nur im Spiel; es entstehen keine realen Eigentums- oder Mietrechte.
      </p>}
    </>}
  </Win>;
}
