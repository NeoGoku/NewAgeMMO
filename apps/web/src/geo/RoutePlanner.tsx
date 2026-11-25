import { useEffect, useState } from 'react';
import { GEO, haversine, type GeoCoord, type GeoRoute, type GeoRoutePreview, type GeoTravelMode, type GeoTravelView } from '@nam/shared';
import { net } from '../net';
import { toast } from '../store';
import { distanceLabel } from './quest-map';

export interface RouteTarget extends GeoCoord { name?: string; address?: string }
export type RouteLine = GeoRoute;

const transport: Record<GeoTravelMode, string> = {
  walk: 'Zu Fuß', run: 'Rennen', bike: 'Fahrrad', mount: 'Reittier',
  motorbike: 'Motorrad', car: 'Auto', fly: 'Flugreittier'
};
const modes = Object.keys(transport) as GeoTravelMode[];
const duration = (seconds: number) => {
  const n = Math.max(0, Math.ceil(seconds));
  if (n < 60) return n + ' Sek.';
  const minutes = Math.ceil(n / 60);
  return minutes < 60 ? minutes + ' Min.' : Math.floor(minutes / 60) + ' Std. ' + (minutes % 60) + ' Min.';
};

export function RoutePlanner({ target, start, available, onGeometry, onStarted, onClose }: {
  target: RouteTarget;
  start: GeoCoord;
  available: readonly GeoTravelMode[];
  onGeometry: (route: RouteLine | null) => void;
  onStarted: () => void;
  onClose: () => void;
}) {
  const [preferredMode, setMode] = useState<GeoTravelMode>('walk');
  const mode = available.includes(preferredMode) ? preferredMode : 'walk';
  const [preview, setPreview] = useState<GeoRoutePreview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [direct, setDirect] = useState(false);
  const [attempt, retry] = useState(0);
  const airDistance = haversine(start.lat, start.lon, target.lat, target.lon);
  const supportsDirect = mode === 'walk' || mode === 'run';
  const canUseDirect = supportsDirect && airDistance >= 1 && airDistance <= GEO.directTravelMaxM;
  const useDirect = direct && supportsDirect;
  useEffect(() => {
    let current = true;
    setPreview(null);
    onGeometry(null);
    setError('');
    setLoading(true);
    void net.req('geoRoutePreview', {
      lat: target.lat, lon: target.lon, mode, direct: useDirect, refresh: attempt > 0,
    }).then(reply => {
      if (!current) return;
      setLoading(false);
      if (reply.t === 'err') { setError(reply.err); return; }
      const next = reply.preview as GeoRoutePreview | undefined;
      if (!next || next.points?.length < 2) { setError('Für dieses Ziel ist keine Route verfügbar.'); return; }
      setPreview(next);
      onGeometry(next);
    });
    return () => { current = false; onGeometry(null); };
  }, [target.lat, target.lon, mode, useDirect, attempt, onGeometry]);

  const startTravel = async () => {
    if (loading || starting || !preview || preview.mode !== mode || !!preview.direct !== useDirect ||
      preview.target.lat !== target.lat || preview.target.lon !== target.lon) return;
    setStarting(true);
    setError('');
    const reply = await net.req('geoRouteStart', {
      lat: target.lat, lon: target.lon, mode, direct: useDirect, previewId: preview.id,
    });
    if (reply.t === 'err') { setError(reply.err); setStarting(false); return; }
    onStarted();
  };

  return <section className="route-panel" aria-label="Reise planen">
    <div className="row"><strong className="grow">{target.name ?? preview?.label ?? 'Ziel auf der Karte'}</strong><button type="button" aria-label="Reiseplanung schließen" onClick={onClose}>×</button></div>
    <div className="dim">{target.address || `${target.lat.toFixed(5)}, ${target.lon.toFixed(5)}`}</div>
    <label>Fortbewegung <select value={mode} onChange={e => { setDirect(false); setMode(e.target.value as GeoTravelMode); }} disabled={starting}>
      {modes.map(id => <option key={id} value={id} disabled={!available.includes(id)}>{transport[id]}{available.includes(id) ? '' : ' · gesperrt'}</option>)}
    </select></label>
    {preview
      ? <div>{preview.direct ? 'Direkte virtuelle Bewegung · Luftlinie' : mode === 'fly' ? 'Flugstrecke' : 'Straßen- und Wegenetz'} {distanceLabel(preview.totalM)} · {duration(preview.etaSeconds)}</div>
      : <div>Luftlinie {distanceLabel(airDistance)}</div>}
    {(loading || starting || error) && <div role="status">{loading ? 'Route wird berechnet …' : starting ? 'Reise wird gestartet …' : error}</div>}
    <div className="row wrap">
      <button type="button" className="on" disabled={!preview || loading || starting} onClick={() => void startTravel()}>Reise starten</button>
      <button type="button" disabled={starting || loading} onClick={() => retry(n => n + 1)}>Neu berechnen</button>
      {useDirect && <button type="button" disabled={starting} onClick={() => setDirect(false)}>Straßenroute versuchen</button>}
      {!useDirect && canUseDirect &&
        <button type="button" disabled={starting} onClick={() => setDirect(true)}>Virtuelle Luftlinie</button>}
    </div>
  </section>;
}

export function TravelStatus({ travel, onReroute }: { travel: GeoTravelView; onReroute: () => void }) {
  const [pending, setPending] = useState(false);
  const action = async (command: 'geoRoutePause' | 'geoRouteResume' | 'geoRouteCancel') => {
    setPending(true);
    try {
      const reply = await net.req(command);
      if (reply.t === 'err') toast(reply.err, 'err');
    } finally { setPending(false); }
  };
  return <section className="route-panel" aria-label="Aktuelle Reise">
    <strong>{travel.status === 'arrived' ? 'Ziel erreicht' : travel.status === 'paused' ? 'Reise pausiert' : 'Reise läuft'} · {transport[travel.mode]}{travel.direct ? ' · Luftlinie' : ''}</strong>
    {travel.status !== 'arrived' && <div>{distanceLabel(travel.remainingM)} von {distanceLabel(travel.totalM)} verbleibend · {duration(travel.etaSeconds)}</div>}
    <div className="row wrap">
      {travel.status === 'moving' && <button type="button" disabled={pending} onClick={() => void action('geoRoutePause')}>Pausieren</button>}
      {travel.status === 'paused' && <button type="button" disabled={pending} onClick={() => void action('geoRouteResume')}>Fortsetzen</button>}
      <button type="button" disabled={pending} onClick={onReroute}>Neues Ziel</button>
      <button type="button" disabled={pending} onClick={() => void action('geoRouteCancel')}>{travel.status === 'arrived' ? 'Schließen' : 'Abbrechen'}</button>
    </div>
  </section>;
}
