import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GEO, haversine, type GeoObj, type GeoPlayer } from '@nam/shared';
import { net } from '../net';
import { toast } from '../store';

const KEY = 'nam.geo.consent';
const BERLIN = { lat: 52.52, lon: 13.405 };
type Consent = 'gps' | 'virtual' | null;
type Mode = 'gps' | 'virtual';
interface Me { lat: number; lon: number; mode?: string; speed?: number; flags?: string[] }

const readConsent = (): Consent => { try { const v = localStorage.getItem(KEY); return v === 'gps' || v === 'virtual' ? v : null; } catch { return null; } };
const saveConsent = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* kein Storage */ } };

const COL: Record<string, string> = { mob: '#e5484d', node: '#46c46a', dungeon: '#9b59ff', city: '#22d3ee', house: '#f5c542', npc: '#ffe066', poi: '#ffffff' };
const GLYPH: Record<string, string> = { node: '◆', dungeon: '⛩', city: '🏛', house: '⌂', npc: '!', poi: '•' };

function circle(lat: number, lon: number, r: number, n = 64) {
  const pts: number[][] = []; const dLat = r / 111320; const dLon = r / (111320 * Math.max(0.05, Math.cos(lat * Math.PI / 180)));
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; pts.push([lon + Math.cos(a) * dLon, lat + Math.sin(a) * dLat]); }
  return pts;
}
const poly = (lat: number, lon: number, r: number, props: any = {}) => ({ type: 'Feature' as const, properties: props, geometry: { type: 'Polygon' as const, coordinates: [circle(lat, lon, r)] } });
const fc = (features: any[]) => ({ type: 'FeatureCollection' as const, features });

const CSS = `
.geo{position:fixed;inset:0;z-index:60;background:#0a0e1a;color:#e8ecff;font:14px system-ui,sans-serif;touch-action:none}
.geo .map{position:absolute;inset:0}
.geo .map canvas{filter:brightness(.82) saturate(.75) hue-rotate(8deg) contrast(1.05)}
.geo .map:after{content:"";position:absolute;inset:0;background:linear-gradient(rgba(20,30,90,.22),rgba(40,10,70,.22));pointer-events:none;mix-blend-mode:multiply}
.geo button{font:inherit;color:#e8ecff;background:rgba(18,24,48,.88);border:1px solid #3a4580;border-radius:12px;min-width:48px;min-height:48px;padding:0 14px;cursor:pointer;backdrop-filter:blur(4px)}
.geo button.on{background:#2b4bd0;border-color:#7a95ff}.geo button.danger{border-color:#c0394a;color:#ffb3bb}.geo button:disabled{opacity:.5}
.geo .top{position:absolute;left:0;right:0;top:0;padding:calc(8px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) 0 calc(8px + env(safe-area-inset-left));display:flex;gap:8px;align-items:flex-start;justify-content:space-between;pointer-events:none}
.geo .top>*{pointer-events:auto}
.geo .status{background:rgba(10,14,30,.85);border:1px solid #3a4580;border-radius:12px;padding:8px 12px;font-size:13px;line-height:1.4;flex:1;max-width:520px}
.geo .status .bad{color:#ff6b78;font-weight:700}
.geo .side{position:absolute;right:calc(8px + env(safe-area-inset-right));top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px}
.geo .bottom{position:absolute;left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));bottom:calc(8px + env(safe-area-inset-bottom));display:flex;gap:8px;flex-wrap:wrap;pointer-events:none}
.geo .bottom>*{pointer-events:auto}
.geo .pop{position:absolute;left:50%;bottom:calc(76px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(340px,calc(100% - 24px));background:rgba(12,16,36,.96);border:1px solid #7a95ff;border-radius:14px;padding:12px}
.geo .pop h3{margin:0 0 4px;font-size:16px}.geo .pop .dim{opacity:.7;font-size:13px}.geo .pop .row{display:flex;gap:8px;margin-top:10px}.geo .pop .row button{flex:1}
.geo .dlg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,8,20,.82);padding:16px;z-index:5}
.geo .dlg>div{background:#10163a;border:1px solid #7a95ff;border-radius:16px;padding:18px;max-width:420px;width:100%;max-height:90%;overflow:auto}
.geo .dlg h2{margin:0 0 8px}.geo .dlg p{margin:6px 0;line-height:1.45}.geo .dlg .col{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.geo .mk{display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:700;font-size:12px;color:#fff;border:2px solid rgba(255,255,255,.85);text-shadow:0 1px 2px #000;cursor:pointer;box-shadow:0 0 6px rgba(0,0,0,.7)}
.geo .mk.near{box-shadow:0 0 0 3px rgba(255,240,150,.9),0 0 16px 6px rgba(255,230,120,.8)}
.geo .mk.boss{animation:geopulse 1.1s ease-in-out infinite}
.geo .mk.pl{width:18px;height:18px;background:#3b82f6;cursor:default}
.geo .lbl{position:absolute;top:100%;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11px;text-shadow:0 0 3px #000,0 0 3px #000;pointer-events:none;font-weight:600}
.geo .me{width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:26px;color:#7dd3fc;filter:drop-shadow(0 0 6px #38bdf8);pointer-events:none}
.geo .maplibregl-ctrl-attrib{font-size:10px;background:rgba(10,14,30,.7)!important;color:#aab}
.geo .maplibregl-ctrl-attrib a{color:#8fb0ff}
@keyframes geopulse{0%,100%{transform:scale(1)}50%{transform:scale(1.25)}}
`;

export function GeoScreen({ onClose }: { onClose: () => void }) {
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

  const myPos = () => meRef.current ?? (gpsPos.current ? { lat: gpsPos.current.lat, lon: gpsPos.current.lon } : null);

  // Karte
  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current!, center: [BERLIN.lon, BERLIN.lat], zoom: 15, maxZoom: 19, attributionControl: { compact: true },
      style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap-Mitwirkende' } },
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b1024' } }, { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.35, 'raster-brightness-max': 0.7, 'raster-hue-rotate': 200, 'raster-contrast': 0.1 } }] },
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
  function walkTo(lat: number, lon: number) {
    targetRef.current = { lat, lon }; setWalking(true); net.send('geoWalk', { lat, lon }); redraw.current();
  }

  // Zeichnen
  redraw.current = () => {
    const map = mapRef.current; if (!map) return;
    const me = myPos(); const objs = objsRef.current;
    const near = (o: GeoObj) => !!me && haversine(me.lat, me.lon, o.lat, o.lon) <= GEO.interactM;
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
      const tg = targetRef.current; if (tg && me && haversine(me.lat, me.lon, tg.lat, tg.lon) < 8) { targetRef.current = null; setWalking(false); }
      if (me && me.speed !== undefined && me.speed < 0.1 && walking && !tg) setWalking(false);
      setInfo({ n: objsRef.current.length, speed: me?.speed ?? 0, flags: me?.flags ?? [], hasMe: !!me });
      redraw.current(); bump(x => x + 1);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GPS
  useEffect(() => {
    if (mode !== 'gps' || consent === null) return;
    if (!('geolocation' in navigator)) { setGpsErr('GPS wird von diesem Gerät nicht unterstützt.'); toast('GPS nicht verfügbar – virtueller Modus', 'err'); setMode('virtual'); return; }
    setGpsErr(''); let last = 0;
    const id = navigator.geolocation.watchPosition(p => {
      const { latitude: lat, longitude: lon, accuracy: acc } = p.coords; gpsPos.current = { lat, lon, acc };
      if (!centered.current && mapRef.current) { centered.current = true; mapRef.current.jumpTo({ center: [lon, lat], zoom: 16 }); }
      const now = Date.now(); if (now - last >= 1000) { last = now; net.send('geoPos', { lat, lon, acc, mode: 'gps', t: now }); }
      redraw.current();
    }, err => {
      const msg = err.code === 1 ? 'Standortzugriff verweigert.' : err.code === 2 ? 'Standort nicht verfügbar.' : 'Zeitüberschreitung bei der Ortung.';
      setGpsErr(msg + ' Wechsle auf virtuellen Modus.'); toast(msg + ' Virtueller Modus aktiv.', 'err'); setMode('virtual');
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

  function choose(c: 'gps' | 'virtual') { saveConsent(c); setConsent(c); setMode(c); net.send('geoConsent', { on: true, visible: true }); }
  function wipe() {
    if (!window.confirm('Alle gespeicherten Standortdaten wirklich löschen?')) return;
    net.send('geoWipe', {}); try { localStorage.removeItem(KEY); } catch { /* */ }
    meRef.current = null; objsRef.current = []; targetRef.current = null; setWalking(false); setConsent(null); setInfo({ n: 0, speed: 0, flags: [], hasMe: false }); redraw.current(); toast('Standortdaten gelöscht');
  }
  function stop() { net.send('geoStop', {}); targetRef.current = null; setWalking(false); redraw.current(); }
  async function interact(id: string) {
    setBusy(true); try { const r = await net.req('geoInteract', { id }); if (r.t === 'err' || r.err) toast(r.err || 'Interaktion fehlgeschlagen', 'err'); } finally { setBusy(false); }
  }
  const zoom = (d: number) => mapRef.current?.zoomTo(mapRef.current.getZoom() + d, { duration: 250 });
  const toggleMode = () => { if (mode === 'gps') { setMode('virtual'); net.send('geoStop', {}); } else if (consent === 'gps') setMode('gps'); else choose('gps'); };

  const me = myPos();
  const o = sel ? objsRef.current.find(x => x.id === sel) : null; const dist = o && me ? haversine(me.lat, me.lon, o.lat, o.lon) : 0; const inRange = !!o && dist <= GEO.interactM;
  const rejected = info.flags.some(f => f === 'speed' || f === 'teleport');
  const KIND: Record<string, string> = { mob: 'Monster', node: 'Ressource', dungeon: 'Dungeon', city: 'Stadt', house: 'Haus', npc: 'NPC', poi: 'Ort' };

  return (
    <div className="geo">
      <style>{CSS}</style>
      <div className="map" ref={box} />
      <div className="top">
        <div className="status">
          <div>{mode === 'gps' ? '📡 GPS' : '🧭 Virtuell'} · {(info.speed * 3.6).toFixed(0)} km/h · {info.n} Objekte{walking ? ' · unterwegs' : ''}</div>
          {rejected && <div className="bad">⚠ Bewegung abgelehnt ({info.flags.join(', ')})</div>}
          {gpsErr && <div className="bad">{gpsErr}</div>}
          {!info.hasMe && consent !== null && <div>Warte auf Position…</div>}
        </div>
        <button onClick={onClose} aria-label="Schließen">✕</button>
      </div>
      <div className="side">
        <button onClick={() => zoom(1)} aria-label="Hineinzoomen">＋</button>
        <button onClick={() => zoom(-1)} aria-label="Herauszoomen">−</button>
        <button onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0 })} aria-label="Norden" style={{ transform: `rotate(${-bearing}deg)` }}>🧭</button>
        <button className={follow ? 'on' : ''} onClick={() => { setFollow(f => !f); const p = myPos(); if (p && !follow) mapRef.current?.easeTo({ center: [p.lon, p.lat] }); }} aria-label="Folgen">◎</button>
      </div>
      {o && (
        <div className="pop">
          <h3>{o.name}{o.lvl ? ` · Lv ${o.lvl}` : ''}</h3>
          <div className="dim">{KIND[o.k] || o.k}{o.fam ? ` · ${o.fam}` : ''}{o.role ? ` · ${o.role}` : ''}</div>
          <div style={{ marginTop: 6, color: inRange ? '#8affb0' : '#ffd27a' }}>{inRange ? 'In Reichweite' : `${Math.round(dist)} m entfernt`}</div>
          <div className="row">
            {inRange ? <button className="on" disabled={busy} onClick={() => interact(o.id)}>Interagieren</button>
              : mode === 'virtual' ? <button className="on" onClick={() => walkTo(o.lat, o.lon)}>Hinlaufen</button>
              : <button disabled>Zu weit entfernt</button>}
            <button onClick={() => setSel(null)}>Schließen</button>
          </div>
        </div>
      )}
      <div className="bottom">
        <button className={mode === 'gps' ? 'on' : ''} onClick={toggleMode}>{mode === 'gps' ? '📡 GPS' : '🧭 Virtuell'}</button>
        {mode === 'virtual' && <button className="danger" disabled={!walking} onClick={stop}>■ Stopp</button>}
        <button onClick={wipe} style={{ marginLeft: 'auto' }}>Meine Standortdaten löschen</button>
      </div>
      {consent === null && (
        <div className="dlg"><div>
          <h2>Standort & Datenschutz</h2>
          <p>Dein Standort wird nur für Spielfunktionen genutzt (Monster, Ressourcen und Orte in deiner Nähe).</p>
          <p>Andere Spieler sehen dich nur auf ca. 100 m gerundet, nie deine genaue Position.</p>
          <p>Du kannst deine Standortdaten jederzeit über „Meine Standortdaten löschen“ entfernen.</p>
          <div className="col">
            <button className="on" onClick={() => choose('gps')}>GPS verwenden</button>
            <button onClick={() => choose('virtual')}>Nur virtuell spielen</button>
            <button onClick={onClose}>Abbrechen</button>
          </div>
        </div></div>
      )}
    </div>
  );
}
