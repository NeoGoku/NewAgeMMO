import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GEO, haversine, type GeoObj, type GeoPlayer } from '@nam/shared';
import { set, useS } from '../store';
import { geoBus } from './bus';
import { net } from '../net';
import { toast } from '../store';

const KEY = 'nam.geo.consent';
const BERLIN = { lat: 52.52, lon: 13.405 };
type Consent = 'gps' | 'virtual' | null;
type Mode = 'gps' | 'virtual';
interface Me { lat: number; lon: number; mode?: string; speed?: number; etaSeconds?: number; dest?: { lat: number; lon: number } | null; flags?: string[] }
interface Destination { id: string; name: string; cost: number }

const readConsent = (): Consent => { try { const v = localStorage.getItem(KEY); return v === 'gps' || v === 'virtual' ? v : null; } catch { return null; } };
const saveConsent = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* kein Storage */ } };

const COL: Record<string, string> = { teleporter: '#65a8ff', station: '#f0a050', mob: '#e5484d', node: '#46c46a', dungeon: '#9b59ff', city: '#22d3ee', house: '#f5c542', npc: '#ffe066', poi: '#ffffff' };
const GLYPH: Record<string, string> = { teleporter: '⇄', station: '⚒', node: '◆', dungeon: '⛩', city: '🏛', house: '⌂', npc: '!', poi: '•' };

function circle(lat: number, lon: number, r: number, n = 64) {
  const pts: number[][] = []; const dLat = r / 111320; const dLon = r / (111320 * Math.max(0.05, Math.cos(lat * Math.PI / 180)));
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; pts.push([lon + Math.cos(a) * dLon, lat + Math.sin(a) * dLat]); }
  return pts;
}
const poly = (lat: number, lon: number, r: number, props: any = {}) => ({ type: 'Feature' as const, properties: props, geometry: { type: 'Polygon' as const, coordinates: [circle(lat, lon, r)] } });
const fc = (features: any[]) => ({ type: 'FeatureCollection' as const, features });

const CSS = `
.geo{position:absolute;inset:0;z-index:1;color:#d6f7ff;font:13px/1.3 system-ui,sans-serif}
.geo .map{position:absolute;inset:0}
.geo .maplibregl-ctrl-attrib{background:#0008!important;color:#8fa3b8!important;font-size:10px}
.geo .top{position:absolute;left:50%;top:calc(92px + var(--sat));transform:translateX(-50%);z-index:5;pointer-events:none;text-align:center}
.geo .status{background:#04101ccc;border:1px solid #1ee8ff55;border-radius:99px;padding:4px 12px;font-size:12px;letter-spacing:.02em;white-space:nowrap;box-shadow:0 0 14px #1ee8ff22}
.geo .status .bad{color:#ff6b7a;margin-top:2px}
.geo .side{position:absolute;right:calc(10px + var(--sar));top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px;z-index:5}
.geo button{background:#06121fe6;color:#cdeeff;border:1px solid #1ee8ff66;border-radius:12px;min-width:44px;min-height:44px;padding:0 10px;font:inherit;box-shadow:0 0 12px #1ee8ff22}
.geo button.on{background:#0c3a4acc;border-color:#5ef2ff;box-shadow:0 0 16px #5ef2ff66}
.geo .side button{width:44px;padding:0}
.geo .mk{border-radius:50%;border:2px solid #ffffffaa;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:12px;box-shadow:0 0 12px currentColor;position:relative;cursor:pointer}
.geo .mk.near{box-shadow:0 0 0 3px #5ef2ff,0 0 18px #5ef2ff}
.geo .mk .lbl{position:absolute;top:100%;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px;margin-top:2px;text-shadow:0 1px 2px #000,0 0 6px #000;pointer-events:none}
.geo .mk.boss{animation:gpulse 1.6s infinite}
@keyframes gpulse{50%{box-shadow:0 0 0 6px #c46cff55,0 0 24px #c46cff}}
.geo .me{width:22px;height:22px;border-radius:50%;background:#5ef2ff;border:3px solid #fff;box-shadow:0 0 0 6px #5ef2ff33,0 0 18px #5ef2ff;color:#04101c;font-size:12px;display:flex;align-items:center;justify-content:center}
.geo .pop{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--navh) + 150px + var(--sab));z-index:12;background:#04101cf2;border:1px solid #1ee8ff88;border-radius:14px;padding:12px 14px;width:min(320px,92vw);box-shadow:0 10px 40px #000a,0 0 24px #1ee8ff33}
.geo .pop h3{margin:0 0 2px;font-size:16px;color:#eaffff}
.geo .pop .dim{color:#7fa3b8;font-size:12px}
.geo .pop .row{display:flex;gap:8px;margin-top:10px}
.geo .pop .row button{flex:1}
.geo .portal-destinations{display:grid;gap:6px;margin-top:8px;max-height:28vh;overflow:auto}
.geo .dlg{position:absolute;inset:0;background:#02050acc;display:flex;align-items:center;justify-content:center;z-index:20;padding:16px}
.geo .dlg>div{background:#04101cf5;border:1px solid #1ee8ff88;border-radius:16px;padding:18px;max-width:420px;box-shadow:0 0 40px #1ee8ff33}
.geo .dlg h2{margin:0 0 8px;color:#eaffff;font-size:18px}
.geo .dlg p{color:#a9c4d6}
.geo .dlg .col{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.geo .dlg button{width:100%;min-height:46px}
`

export function GeoScreen({ hidden, onClose }: { hidden?: boolean; onClose?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const meRef = useRef<Me | null>(null);
  const gpsPos = useRef<{ lat: number; lon: number; acc: number } | null>(null);
  const objsRef = useRef<GeoObj[]>([]);
  const mkObj = useRef(new Map<string, { m: maplibregl.Marker; el: HTMLElement; sig: string }>());
  const mkPl = useRef(new Map<string, maplibregl.Marker>());
  const meMk = useRef<maplibregl.Marker | null>(null);
  const followRef = useRef(true);
  const modeRef = useRef<Mode>('virtual');
  const targetRef = useRef<{ lat: number; lon: number } | null>(null);
  const redraw = useRef<() => void>(() => { /* init */ });
  const selRef = useRef<string | null>(null);
  const centered = useRef(false);

  const gold = useS(s => s.char?.gold ?? 0);
  const [destinations, setDestinations] = useState<{ portal: string; rows: Destination[] } | null>(null);
  const [eta, setEta] = useState(0);
  const [consent, setConsent] = useState<Consent>(readConsent);
  const [mode, setMode] = useState<Mode>(readConsent() === 'gps' ? 'gps' : 'virtual');
  const [follow, setFollow] = useState(true);
  const [bearing, setBearing] = useState(0);
  const [info, setInfo] = useState({ n: 0, speed: 0, flags: [] as string[], hasMe: false });
  const [sel, setSel] = useState<string | null>(null);
  const [, bump] = useState(0);
  const [gpsErr, setGpsErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [walking, setWalking] = useState(false);

  followRef.current = follow; modeRef.current = mode; selRef.current = sel;
  useEffect(() => { if (!hidden) setTimeout(() => mapRef.current?.resize(), 50); }, [hidden]);
  useEffect(() => {
    const onMode = () => { choose(modeRef.current === 'gps' ? 'virtual' : 'gps'); };
    const onStop = () => { net.send('geoStop', {}); targetRef.current = null; setWalking(false); redraw.current(); };
    const onWipe = () => wipe();
    const onRecenter = () => { const p = myPos(); if (p) { setFollow(true); mapRef.current?.easeTo({ center: [p.lon, p.lat], zoom: 16, bearing: 0 }); } };
    const onWalk = (e: Event) => { const d = (e as CustomEvent).detail; if (d) walkTo(d.lat, d.lon); };
    const L: [string, EventListener][] = [['toggleMode', onMode], ['stop', onStop], ['wipe', onWipe], ['recenter', onRecenter], ['walkTo', onWalk]];
    L.forEach(([t, f]) => geoBus.addEventListener(t, f)); return () => L.forEach(([t, f]) => geoBus.removeEventListener(t, f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { geoBus.dispatchEvent(new CustomEvent('state', { detail: { mode, walking } })); }, [mode, walking]);

  const myPos = () => meRef.current ?? (gpsPos.current ? { lat: gpsPos.current.lat, lon: gpsPos.current.lon } : null);

  // Karte
  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current!, center: [BERLIN.lon, BERLIN.lat], zoom: 15, maxZoom: 19, attributionControl: { compact: true },
      style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap-Mitwirkende' } },
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#04070d' } }, { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.72, 'raster-brightness-max': 0.5, 'raster-hue-rotate': 185, 'raster-contrast': 0.28 } }] },
    });
    mapRef.current = map;
    map.on('load', () => {
      for (const id of ['cities', 'ranges', 'line']) map.addSource(id, { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'cities-fill', type: 'fill', source: 'cities', paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.08 } });
      map.addLayer({ id: 'cities-line', type: 'line', source: 'cities', paint: { 'line-color': '#22d3ee', 'line-width': 2, 'line-dasharray': [3, 2] } });
      map.addLayer({ id: 'ranges-fill', type: 'fill', source: 'ranges', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['get', 'o'] } });
      map.addLayer({ id: 'ranges-line', type: 'line', source: 'ranges', paint: { 'line-color': ['get', 'c'], 'line-width': 1.5, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'route', type: 'line', source: 'line', paint: { 'line-color': '#ffd24a', 'line-width': 3, 'line-dasharray': [2, 2] } });
      redraw.current();
    });
    map.on('rotate', () => setBearing(map.getBearing()));
    map.on('dragstart', () => { if (followRef.current) setFollow(false); });
    map.on('click', e => {
      if ((e.originalEvent.target as HTMLElement).closest('.mk')) return;
      setSel(null);
      if (modeRef.current === 'virtual' && consentOk()) { void walkTo(e.lngLat.lat, e.lngLat.lng); }
    });
    return () => { mkObj.current.forEach(o => o.m.remove()); mkObj.current.clear(); mkPl.current.forEach(m => m.remove()); mkPl.current.clear(); meMk.current?.remove(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const consentRef = useRef<Consent>(consent); consentRef.current = consent;
  function consentOk() { return consentRef.current !== null; }
  async function walkTo(lat: number, lon: number) {
    const result = await net.req('geoWalk', { lat, lon });
    if (result.t === 'err') toast(result.err, 'err');
  }

  // Zeichnen
  redraw.current = () => {
    const map = mapRef.current; if (!map) return;
    const me = myPos(); const objs = objsRef.current;
    const near = (o: GeoObj) => !!me && haversine(me.lat, me.lon, o.lat, o.lon) <= GEO.interactM + (o.r || 0);
    // Objekt-Marker
    const seen = new Set<string>();
    for (const o of objs) {
      seen.add(o.id); const isN = near(o); const boss = o.extra?.boss || o.extra?.rank === 'boss' || o.role === 'boss'; const elite = boss || o.extra?.elite || o.extra?.rank === 'elite' || o.role === 'elite';
      const sig = `${o.name}|${o.lvl}|${isN}|${boss}|${elite}`; let rec = mkObj.current.get(o.id);
      if (!rec) {
        const el = document.createElement('div'); const m = new maplibregl.Marker({ element: el }).setLngLat([o.lon, o.lat]).addTo(map);
        el.addEventListener('click', ev => { ev.stopPropagation(); setSel(o.id); }); rec = { m, el, sig: '' }; mkObj.current.set(o.id, rec);
      }
      rec.m.setLngLat([o.lon, o.lat]);
      if (rec.sig !== sig) {
        rec.sig = sig; const sz = o.k === 'city' ? 40 : o.k === 'mob' ? (boss ? 44 : elite ? 36 : 28) : 28; const c = COL[o.k] || '#fff';
        rec.el.className = `mk${isN ? ' near' : ''}${boss ? ' boss' : ''}`;
        rec.el.style.cssText = `width:${sz}px;height:${sz}px;background:${c}${o.k === 'mob' ? 'cc' : 'bb'};${elite ? 'border-color:#ffd24a;border-width:3px;' : ''}${o.k === 'poi' || o.k === 'npc' ? 'color:#111;text-shadow:none;' : ''}${o.k === 'node' ? 'border-radius:6px;transform:rotate(45deg);' : ''}`;
        rec.el.innerHTML = '';
        const t = document.createElement('span'); t.textContent = o.k === 'mob' ? String(o.lvl ?? '?') : GLYPH[o.k] || '•'; if (o.k === 'node') t.style.transform = 'rotate(-45deg)'; rec.el.appendChild(t);
        const l = document.createElement('div'); l.className = 'lbl'; l.style.color = c; l.textContent = o.name; if (o.k === 'node') l.style.transform = 'translateX(-50%) rotate(-45deg)'; if (o.k !== 'node') rec.el.appendChild(l);
      }
    }
    for (const [id, rec] of mkObj.current) if (!seen.has(id)) { rec.m.remove(); mkObj.current.delete(id); }
    // Eigene Figur
    if (me) {
      if (!meMk.current) { const el = document.createElement('div'); el.className = 'me'; el.textContent = '➤'; meMk.current = new maplibregl.Marker({ element: el, rotationAlignment: 'map' }).setLngLat([me.lon, me.lat]).addTo(map); }
      meMk.current.setLngLat([me.lon, me.lat]);
    }
    // GeoJSON
    const ranges: any[] = []; if (me) { ranges.push(poly(me.lat, me.lon, GEO.interactM, { c: '#7dd3fc', o: 0.1 })); if (modeRef.current === 'gps' && gpsPos.current && gpsPos.current.acc > 5) ranges.push(poly(gpsPos.current.lat, gpsPos.current.lon, Math.min(gpsPos.current.acc, 500), { c: '#3b82f6', o: 0.12 })); }
    const cities = objs.filter(o => o.k === 'city' && o.r).map(o => poly(o.lat, o.lon, o.r!));
    const tg = targetRef.current; const line = tg && me ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[me.lon, me.lat], [tg.lon, tg.lat]] } }] : [];
    (map.getSource('ranges') as maplibregl.GeoJSONSource | undefined)?.setData(fc(ranges));
    (map.getSource('cities') as maplibregl.GeoJSONSource | undefined)?.setData(fc(cities));
    (map.getSource('line') as maplibregl.GeoJSONSource | undefined)?.setData(fc(line));
    if (me && followRef.current) map.easeTo({ center: [me.lon, me.lat], duration: 400 });
  };

  // Server-Pakete
  useEffect(() => {
    const off = net.on(m => {
      if (m.t !== 'geo') return;
      const me = m.me as Me | undefined; if (me && typeof me.lat === 'number') meRef.current = me;
      objsRef.current = (m.objs as GeoObj[]) || [];
      const pls = (m.players as GeoPlayer[]) || []; const map = mapRef.current;
      if (map) {
        const seen = new Set<string>();
        for (const p of pls) {
          seen.add(p.id); let mk = mkPl.current.get(p.id);
          if (!mk) { const el = document.createElement('div'); el.className = 'mk pl'; el.title = `${p.name} · Lv ${p.lvl}`; const l = document.createElement('div'); l.className = 'lbl'; l.style.color = '#93c5fd'; l.textContent = p.name; el.appendChild(l); mk = new maplibregl.Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(map); mkPl.current.set(p.id, mk); }
          mk.setLngLat([p.lon, p.lat]);
        }
        for (const [id, mk] of mkPl.current) if (!seen.has(id)) { mk.remove(); mkPl.current.delete(id); }
      }
      if (me && !centered.current && map) { centered.current = true; map.jumpTo({ center: [me.lon, me.lat], zoom: 16 }); }
      targetRef.current = me?.dest ?? null;
      setWalking(!!me?.dest);
      setEta(me?.etaSeconds ?? 0);
      setInfo({ n: objsRef.current.length, speed: me?.speed ?? 0, flags: me?.flags ?? [], hasMe: !!me });
      redraw.current(); bump(x => x + 1);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GPS
  useEffect(() => {
    if (mode !== 'gps' || consent === null) return;
    if (!('geolocation' in navigator)) { setGpsErr('GPS wird von diesem Gerät nicht unterstützt.'); toast('GPS nicht verfügbar – virtueller Modus', 'err'); choose('virtual'); return; }
    setGpsErr(''); let last = 0;
    const id = navigator.geolocation.watchPosition(p => {
      const { latitude: lat, longitude: lon, accuracy: acc } = p.coords; gpsPos.current = { lat, lon, acc };
      if (!centered.current && mapRef.current) { centered.current = true; mapRef.current.jumpTo({ center: [lon, lat], zoom: 16 }); }
      const now = Date.now(); if (now - last >= 1000) { last = now; net.send('geoPos', { lat, lon, acc, mode: 'gps', t: now }); }
      redraw.current();
    }, err => {
      const msg = err.code === 1 ? 'Standortzugriff verweigert.' : err.code === 2 ? 'Standort nicht verfügbar.' : 'Zeitüberschreitung bei der Ortung.';
      setGpsErr(msg + ' Wechsle auf virtuellen Modus.'); toast(msg + ' Virtueller Modus aktiv.', 'err'); choose('virtual');
    }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [mode, consent]);

  // Virtuell ohne Position: Startpunkt
  useEffect(() => {
    if (mode === 'virtual' && consent !== null && !meRef.current && !gpsPos.current) {
      const t = setTimeout(() => { if (!meRef.current) { meRef.current = { lat: BERLIN.lat, lon: BERLIN.lon, mode: 'virtual' }; mapRef.current?.jumpTo({ center: [BERLIN.lon, BERLIN.lat], zoom: 16 }); centered.current = true; setInfo(i => ({ ...i, hasMe: true })); redraw.current(); } }, 2500);
      return () => clearTimeout(t);
    }
  }, [mode, consent]);

  useEffect(() => { redraw.current(); }, [follow, mode]);

  function choose(c: 'gps' | 'virtual') { saveConsent(c); setConsent(c); setMode(c); net.send('geoConsent', { on: true, visible: true, gps: c === 'gps' }); }
  function wipe() {
    if (!window.confirm('Alle gespeicherten Standortdaten wirklich löschen?')) return;
    net.send('geoWipe', {}); try { localStorage.removeItem(KEY); } catch { /* */ }
    meRef.current = null; objsRef.current = []; targetRef.current = null; setWalking(false); setConsent(null); setInfo({ n: 0, speed: 0, flags: [], hasMe: false }); redraw.current(); toast('Standortdaten gelöscht');
  }
  function stop() { net.send('geoStop', {}); targetRef.current = null; setWalking(false); redraw.current(); }
  async function interact(id: string, to?: string) {
    setBusy(true);
    try {
      const r = await net.req('geoInteract', { id, to });
      if (r.t === 'err') { toast(r.err || 'Interaktion fehlgeschlagen', 'err'); return; }
      if (r.destinations) { setDestinations({ portal: id, rows: r.destinations }); return; }
      if (r.teleported) { toast('Angekommen: ' + r.teleported); setDestinations(null); }
      else if (r.station) set({ stationProf: r.station, panel: 'craft' });
      else if (r.house) { net.send('houseList'); set({ panel: 'houses' }); }
      else if (r.city) toast(r.text ? r.text.slice(0, 140) : 'Ort betreten');
      else if (r.gathered) toast('Gesammelt');
      setSel(null);
    } finally { setBusy(false); }
  }
  const zoom = (d: number) => mapRef.current?.zoomTo(mapRef.current.getZoom() + d, { duration: 250 });

  const me = myPos();
  const o = sel ? objsRef.current.find(x => x.id === sel) : null; const dist = o && me ? haversine(me.lat, me.lon, o.lat, o.lon) : 0; const inRange = !!o && dist <= GEO.interactM + (o.r || 0);
  const rejected = info.flags.some(f => f === 'speed' || f === 'teleport');
  const portal = o && destinations?.portal === o.id ? destinations : null;
  const KIND: Record<string, string> = { teleporter: 'Teleportportal', mob: 'Monster', node: 'Ressource', dungeon: 'Dungeon', city: 'Stadt', house: 'Haus', npc: 'NPC', poi: 'Ort' };

  return (
    <div className="geo" style={hidden ? { display: 'none' } : undefined}>
      <style>{CSS}</style>
      <div className="map" ref={box} />
      <div className="top">
        <div className="status">
          <div>{mode === 'gps' ? 'GPS' : 'Virtuell'} · {(info.speed * 3.6).toFixed(0)} km/h · {info.n} Objekte{walking ? ' · ' + (eta > 60 ? Math.ceil(eta / 60) + ' Min.' : eta + ' Sek.') : ''}</div>
          {rejected && <div className="bad">⚠ Bewegung abgelehnt ({info.flags.join(', ')})</div>}
          {gpsErr && <div className="bad">{gpsErr}</div>}
          {!info.hasMe && consent !== null && <div>Warte auf Position…</div>}
        </div>
        {onClose && <button onClick={onClose} aria-label="Schließen">✕</button>}
      </div>
      <div className="side">
        <button onClick={() => zoom(1)} aria-label="Hineinzoomen">＋</button>
        <button onClick={() => zoom(-1)} aria-label="Herauszoomen">−</button>
        <button onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0 })} aria-label="Norden" style={{ transform: `rotate(${-bearing}deg)` }}>N</button>
        <button className={follow ? 'on' : ''} onClick={() => { setFollow(f => !f); const p = myPos(); if (p && !follow) mapRef.current?.easeTo({ center: [p.lon, p.lat] }); }} aria-label="Folgen">◎</button>
      </div>
      {o && (
        <div className="pop">
          <h3>{o.name}{o.lvl ? ` · Lv ${o.lvl}` : ''}</h3>
          <div className="dim">{KIND[o.k] || o.k}{o.fam ? ` · ${o.fam}` : ''}{o.role ? ` · ${o.role}` : ''}</div>
          <div style={{ marginTop: 6, color: inRange ? '#8affb0' : '#ffd27a' }}>{inRange ? 'In Reichweite' : `${Math.round(dist)} m entfernt`}</div>
          {portal && inRange && (
            <div className="portal-destinations">
              {mode === 'gps' && <p>Zum Teleportieren in den virtuellen Modus wechseln.</p>}
              {portal.rows.length === 0 && <p>Entdecke weitere Orte, um sie als Ziele freizuschalten.</p>}
              {portal.rows.map(d => <button key={d.id} disabled={busy || mode === 'gps' || d.cost > gold} onClick={() => interact(o.id, d.id)}>{d.name} · {d.cost} Gold</button>)}
            </div>
          )}
          <div className="row">
            {inRange ? !portal && <button className="on" disabled={busy} onClick={() => interact(o.id)}>{o.k === 'teleporter' ? 'Ziele anzeigen' : 'Interagieren'}</button>
              : mode === 'virtual' ? <button className="on" onClick={() => walkTo(o.lat, o.lon)}>Hinlaufen</button>
              : <button disabled>Zu weit entfernt</button>}
            <button onClick={() => { setSel(null); setDestinations(null); }}>Schließen</button>
          </div>
        </div>
      )}
      {consent === null && (
        <div className="dlg"><div>
          <h2>Standort & Datenschutz</h2>
          <p>Dein Standort wird nur für Spielfunktionen genutzt (Monster, Ressourcen und Orte in deiner Nähe).</p>
          <p>Andere Spieler sehen dich nur auf ca. 100 m gerundet, nie deine genaue Position.</p>
          <p>Du kannst deine Standortdaten jederzeit über „Meine Standortdaten löschen“ entfernen.</p>
          <div className="col">
            <button className="on" onClick={() => choose('gps')}>GPS verwenden</button>
            <button onClick={() => choose('virtual')}>Nur virtuell spielen</button>
          </div>
        </div></div>
      )}
    </div>
  );
}
