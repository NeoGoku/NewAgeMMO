import { useEffect, useState } from 'react';
import { haversine, type GeoCoord, type GeoTravelMode, type GeoTravelView } from '@nam/shared';
import { net } from '../net';
import { toast } from '../store';
import { distanceLabel } from './quest-map';

export interface RouteTarget extends GeoCoord { name?: string; address?: string }
export interface RouteLine { id: string; points: GeoCoord[] }
interface Preview extends RouteLine {
  target: GeoCoord;
  mode: GeoTravelMode;
  totalM: number;
  etaSeconds: number;
  label?: string;
}

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
  const [mode, setMode] = useState<GeoTravelMode>('walk');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState('Route wird berechnet …');
  const [starting, setStarting] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let current = true;
    setPreview(null);
    onGeometry(null);
    setStatus('Route wird berechnet …');
    void net.req('geoRoutePreview', { lat: target.lat, lon: target.lon, mode }).then(reply => {
      if (!current) return;
      if (reply.t === 'err') { setStatus(reply.err); return; }
      const next = reply.preview as Preview | undefined;
      if (!next || next.points?.length < 2) { setStatus('Für dieses Ziel ist keine Route verfügbar.'); return; }
      setPreview(next);
      onGeometry(next);
      setStatus('');
    });
    return () => { current = false; onGeometry(null); };
  }, [target.lat, target.lon, mode, attempt, onGeometry]);

  const startTravel = async () => {
    if (!preview) return;
    setStarting(true);
    const reply = await net.req('geoRouteStart', { lat: target.lat, lon: target.lon, mode, previewId: preview.id });
    if (reply.t === 'err') { setStatus(reply.err); setStarting(false); return; }
    onStarted();
  };

  return <section className="route-panel" aria-label="Reise planen">
    <div className="row"><strong className="grow">{target.name ?? preview?.label ?? 'Ziel auf der Karte'}</strong><button type="button" aria-label="Reiseplanung schließen" onClick={onClose}>×</button></div>
    <div className="dim">{target.address || `${target.lat.toFixed(5)}, ${target.lon.toFixed(5)}`}</div>
    <label>Fortbewegung <select value={mode} onChange={e => setMode(e.target.value as GeoTravelMode)} disabled={starting}>
      {modes.map(id => <option key={id} value={id} disabled={!available.includes(id)}>{transport[id]}{available.includes(id) ? '' : ' · gesperrt'}</option>)}
    </select></label>
    {preview
      ? <div>{mode === 'fly' ? 'Flugstrecke' : 'Route'} {distanceLabel(preview.totalM)} · {duration(preview.etaSeconds)}</div>
      : <div>Luftlinie {distanceLabel(haversine(start.lat, start.lon, target.lat, target.lon))}</div>}
    {status && <div role="status">{status}</div>}
    <div className="row wrap">
      <button type="button" className="on" disabled={!preview || starting} onClick={() => void startTravel()}>Reise starten</button>
      {status && !status.endsWith(' …') && <button type="button" disabled={starting} onClick={() => retry(n => n + 1)}>Neu berechnen</button>}
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
    <strong>{travel.status === 'arrived' ? 'Ziel erreicht' : travel.status === 'paused' ? 'Reise pausiert' : 'Reise läuft'} · {transport[travel.mode]}</strong>
    {travel.status !== 'arrived' && <div>{distanceLabel(travel.remainingM)} verbleibend · {duration(travel.etaSeconds)}</div>}
    <div className="row wrap">
      {travel.status === 'moving' && <button type="button" disabled={pending} onClick={() => void action('geoRoutePause')}>Pausieren</button>}
      {travel.status === 'paused' && <button type="button" disabled={pending} onClick={() => void action('geoRouteResume')}>Fortsetzen</button>}
      <button type="button" disabled={pending} onClick={onReroute}>Neues Ziel</button>
      <button type="button" disabled={pending} onClick={() => void action('geoRouteCancel')}>{travel.status === 'arrived' ? 'Schließen' : 'Abbrechen'}</button>
    </div>
  </section>;
}
