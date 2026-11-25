import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { GEO, haversine, type GeoObj, type GeoPlayer } from '@nam/shared';
import { set, useS } from '../store';
import { MOBS, QUESTS } from '@nam/game-data';
import { mobIconUrl, portraitUrl } from '../render';
import { Joystick } from './Joystick';
import { applyMapPreferences, mapPreferences, mapStyle, saveMapPreferences, type MapKind } from './map-style';
import { distanceLabel, pinLabels, questPins, type QuestPinRole } from './quest-map';
import { geoBus } from './bus';
import { net } from '../net';
import { toast } from '../store';
import { audio } from '../audio';

const KEY = 'nam.geo.consent';
type Consent = 'gps' | 'virtual';
type Mode = 'gps' | 'virtual';
interface Me { lat: number; lon: number; mode?: string; regionLabel?: string; speed?: number; etaSeconds?: number; dest?: { lat: number; lon: number } | null; flags?: string[] }
interface Destination { id: string; name: string; cost: number }

const readConsent = (): Consent => { try { const v = localStorage.getItem(KEY); return v === 'gps' ? 'gps' : 'virtual'; } catch { return 'virtual'; } };
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
.geo .top{position:absolute;left:50%;top:calc(76px + var(--sat));transform:translateX(-50%);max-width:calc(100% - 24px);width:max-content;z-index:5;pointer-events:none;text-align:center}
.geo .status{background:#04101ccc;border:1px solid #1ee8ff55;border-radius:99px;padding:4px 12px;font-size:12px;letter-spacing:.02em;overflow-wrap:anywhere;box-shadow:0 0 14px #1ee8ff22}
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
.geo .me{width:37px;height:37px;z-index:4;border-radius:50%;background:#073745 center/cover;border:2px solid #affcff;box-shadow:0 0 0 4px #06cef640,0 0 15px #16dcfa;pointer-events:none}
.geo .me::after{content:'';position:absolute;bottom:-7px;left:50%;width:8px;height:8px;transform:translateX(-50%) rotate(45deg);background:#affcff}
.geo .mk{padding:0;min-width:0;min-height:0}
.geo .mob-token{border-radius:11px;z-index:2;box-shadow:0 2px 8px #07111b,0 0 8px #ff526477}
.geo .mob-token img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;animation:mob-idle 2s ease-in-out infinite}
.geo .mob-token .level{position:absolute;right:-7px;bottom:-5px;padding:1px 4px;background:#110b16;border:1px solid #ffc2c4;border-radius:6px;color:#fff;font-size:10px;line-height:1.2}
.geo .mob-token .lbl{display:none}
.geo .mob-token:hover .lbl,.geo .mob-token:focus-visible .lbl{display:block}
@keyframes mob-idle{50%{transform:translateY(-3px)}}
@media(prefers-reduced-motion:reduce){.geo .mob-token img,.geo .mk.boss{animation:none}}
.geo button.geo-stick{position:absolute;left:calc(14px + var(--sal));bottom:calc(var(--navh) + 16px + var(--sab));width:88px;height:88px;padding:0;border-radius:50%;touch-action:none;background:#05132156;border:1px solid #66e6fbaf;display:grid;place-items:center;z-index:6}
.geo-stick span{width:31px;height:31px;border-radius:100%;background:#38dcf6a0;border:1px solid #abf9ff;box-shadow:0 0 14px #22c5e466;pointer-events:none}
.geo .settings{position:absolute;z-index:10;right:calc(62px + var(--sar));top:50%;transform:translateY(-50%);width:min(238px,calc(100% - 82px));display:grid;gap:10px;background:#051421f2;border:1px solid #67d7e8;border-radius:12px;padding:12px}
.geo .settings label{display:grid;gap:4px}
.geo .quest-track{position:absolute;left:50%;transform:translateX(-50%);width:min(330px,calc(100% - 26px));bottom:calc(var(--navh) + 120px + var(--sab));z-index:5;border:1px solid #ffd87090;background:#111d27ed;border-radius:12px;padding:8px 10px;font-size:12px}
.geo .quest-track .row{gap:4px;flex-wrap:wrap}
.geo .quest-track button{min-width:0;min-height:32px;padding:0 7px}
.geo .quest-pin{min-width:0;min-height:0;width:26px;height:26px;border-radius:50%;padding:0;z-index:3;box-shadow:0 2px 8px #04111a}
.geo .quest-pin.giver{border-color:#ffda65;color:#ffda65}
.geo .quest-pin.objective{border-color:#80f6b2;color:#80f6b2}
.geo .quest-pin.turnin{border-color:#d7a6ff;color:#d7a6ff}
.geo .pop{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(var(--navh) + 150px + var(--sab));z-index:12;background:#04101cf2;border:1px solid #1ee8ff88;border-radius:14px;padding:12px 14px;width:min(320px,92vw);box-shadow:0 10px 40px #000a,0 0 24px #1ee8ff33}
.geo .pop h3{margin:0 0 2px;font-size:16px;color:#eaffff}
.geo .pop .dim{color:#7fa3b8;font-size:12px}
.geo .pop .row{display:flex;gap:8px;margin-top:10px}
.geo .pop .row button{flex:1}
.geo .portal-destinations{display:grid;gap:6px;margin-top:8px;max-height:28vh;overflow:auto}
`

export function GeoScreen({ hidden, controlsBlocked }: { hidden?: boolean; controlsBlocked?: boolean }) {
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
  const lastStepAt = useRef(0);
  const moveAvatar = useRef<(me: Me | null) => void>(() => {});
  const questMarkers = useRef(new Map<string, maplibregl.Marker>());
  const focusedQuest = useRef<object | null>(null);
  const blockedRef = useRef(controlsBlocked);
  blockedRef.current = controlsBlocked || hidden;
  const [preferences, setPreferences] = useState(mapPreferences);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const [mapSettings, setMapSettings] = useState(false);
  const [mapError, setMapError] = useState('');
  const [questTrack, setQuestTrack] = useState<{ id: string; role: QuestPinRole; navigate: boolean } | null>(null);
  const questStates = useS(s => s.char?.quests);
  const conn = useS(s => s.conn);
  const char = useS(s => s.char);
  const avatar = char ? portraitUrl(char.cls, char.look, {}, 56) : '';
  const avatarRef = useRef(avatar);
  avatarRef.current = avatar;
  const centered = useRef(false);

  const gold = useS(s => s.char?.gold ?? 0);
  const [destinations, setDestinations] = useState<{ portal: string; rows: Destination[] } | null>(null);
  const [eta, setEta] = useState(0);
  const [mode, setMode] = useState<Mode>(readConsent);
  const [follow, setFollow] = useState(true);
  const [bearing, setBearing] = useState(0);
  const [info, setInfo] = useState({ n: 0, speed: 0, flags: [] as string[], hasMe: false });
  const [sel, setSel] = useState<string | null>(null);
  const [, bump] = useState(0);
  const [gpsErr, setGpsErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [walking, setWalking] = useState(false);

  followRef.current = follow; modeRef.current = mode;
  useEffect(() => { if (!hidden) setTimeout(() => mapRef.current?.resize(), 50); }, [hidden]);
  useEffect(() => {
    const onMode = () => { choose(modeRef.current === 'gps' ? 'virtual' : 'gps'); };
    const onStop = () => { net.send('geoStop', {}); targetRef.current = null; setWalking(false); redraw.current(); };
    const onWipe = () => { void wipe(); };
    const onRecenter = () => { const p = myPos(); if (p && mapRef.current) { followRef.current = true; setFollow(true); mapRef.current.easeTo({ center: [p.lon, p.lat], zoom: mapRef.current.getZoom() }); } };
    const onWalk = (e: Event) => { const d = (e as CustomEvent).detail; if (d) void walkTo(d.lat, d.lon); };
    const onQuest = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string; role: QuestPinRole; navigate: boolean };
      if (!QUESTS[detail.id]) return;
      setQuestTrack(detail);
    };
    const L: [string, EventListener][] = [['toggleMode', onMode], ['stop', onStop], ['wipe', onWipe], ['recenter', onRecenter], ['walkTo', onWalk], ['quest', onQuest]];
    L.forEach(([t, f]) => geoBus.addEventListener(t, f)); return () => L.forEach(([t, f]) => geoBus.removeEventListener(t, f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const region = meRef.current?.regionLabel;
  useEffect(() => { geoBus.dispatchEvent(new CustomEvent('state', { detail: { mode, walking, region } })); }, [mode, walking, region]);

  const myPos = () => meRef.current;

  // Karte
  useEffect(() => {
    const map = new maplibregl.Map({
      container: box.current!, center: [0, 18], zoom: 2, maxZoom: 19, maxPitch: 65,
      bearing: preferencesRef.current.bearing, pitch: preferencesRef.current.pitch, attributionControl: { compact: true },
      style: mapStyle(preferencesRef.current)
    });
    mapRef.current = map;
    map.on('load', () => {
      for (const id of ['cities', 'ranges', 'line', 'quest-area', 'quest-route']) map.addSource(id, { type: 'geojson', data: fc([]) });
      map.addLayer({ id: 'cities-fill', type: 'fill', source: 'cities', paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.08 } });
      map.addLayer({ id: 'cities-line', type: 'line', source: 'cities', paint: { 'line-color': '#22d3ee', 'line-width': 2, 'line-dasharray': [3, 2] } });
      map.addLayer({ id: 'ranges-fill', type: 'fill', source: 'ranges', paint: { 'fill-color': ['get', 'c'], 'fill-opacity': ['get', 'o'] } });
      map.addLayer({ id: 'ranges-line', type: 'line', source: 'ranges', paint: { 'line-color': ['get', 'c'], 'line-width': 1.5, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'route', type: 'line', source: 'line', paint: { 'line-color': '#ffd24a', 'line-width': 3, 'line-dasharray': [2, 2] } });
      map.addLayer({ id: 'quest-area-fill', type: 'fill', source: 'quest-area', paint: { 'fill-color': '#78ffb4', 'fill-opacity': 0.18 } });
      map.addLayer({ id: 'quest-area-border', type: 'line', source: 'quest-area', paint: { 'line-color': '#78ffb4', 'line-width': 2, 'line-dasharray': [2, 2] } });
      map.addLayer({ id: 'quest-line', type: 'line', source: 'quest-route', paint: { 'line-color': '#73f9b6', 'line-width': 3, 'line-dasharray': [1.5, 2] } });
      applyMapPreferences(map, preferencesRef.current);
      redraw.current();
    });
    map.on('error', () => setMapError('Kartendaten teilweise nicht verfügbar.'));
    map.on('sourcedata', event => { if (event.isSourceLoaded && ['osm', 'satellite', 'buildings'].includes(event.sourceId ?? '')) setMapError(''); });
    map.on('moveend', () => {
      if (!centered.current) return;
      const current = preferencesRef.current;
      const values = { ...current, zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
      if (current.zoom === values.zoom && current.pitch === values.pitch && current.bearing === values.bearing) return;
      preferencesRef.current = values;
      setPreferences(values);
    });
    map.on('rotate', () => setBearing(map.getBearing()));
    map.on('dragstart', () => { if (followRef.current) setFollow(false); });
    map.on('click', e => {
      if (blockedRef.current || (e.originalEvent.target as HTMLElement).closest('.mk,.quest-pin')) return;
      setSel(null);
      if (modeRef.current === 'virtual' && meRef.current) { void walkTo(e.lngLat.lat, e.lngLat.lng); }
    });
    return () => { mkObj.current.forEach(o => o.m.remove()); mkObj.current.clear(); mkPl.current.forEach(m => m.remove()); mkPl.current.clear(); meMk.current?.remove(); meMk.current = null; questMarkers.current.forEach(m => m.remove()); questMarkers.current.clear(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    saveMapPreferences(preferences);
    if (mapRef.current?.isStyleLoaded()) applyMapPreferences(mapRef.current, preferences);
  }, [preferences]);

  function setMapKind(kind: MapKind) {
    setMapError('');
    const next = { ...preferencesRef.current, kind };
    preferencesRef.current = next;
    setPreferences(next);
    if (mapRef.current?.getLayer('osm')) applyMapPreferences(mapRef.current, next);
    if (kind === 'buildings' && next.pitch < 25) mapRef.current?.easeTo({ pitch: 48, zoom: Math.max(mapRef.current.getZoom(), 15) });
  }
  async function walkTo(lat: number, lon: number) {
    const result = await net.req('geoWalk', { lat, lon });
    if (result.t === 'err') toast(result.err, 'err');
  }

  moveAvatar.current = me => {
    const map = mapRef.current;
    if (!map) return;
    if (!me) { meMk.current?.remove(); meMk.current = null; return; }
    if (!meMk.current) {
      const el = document.createElement('div');
      el.className = 'me';
      el.setAttribute('aria-label', 'Deine Spielfigur');
      el.style.backgroundImage = avatarRef.current ? 'url("' + avatarRef.current + '")' : '';
      meMk.current = new maplibregl.Marker({ element: el }).setLngLat([me.lon, me.lat]).addTo(map);
    }
    meMk.current.setLngLat([me.lon, me.lat]);
    if (!centered.current) {
      centered.current = true;
      map.jumpTo({ center: [me.lon, me.lat], zoom: preferencesRef.current.zoom });
    } else if (followRef.current && !map.isZooming() && !map.isRotating()) {
      map.easeTo({ center: [me.lon, me.lat], duration: 140, easing: t => t });
    }
  };

  const trackedQuest = questTrack ? QUESTS[questTrack.id] : undefined;
  const questProgress = trackedQuest ? questStates?.[trackedQuest.id]?.prog ?? [] : [];
  const pins = trackedQuest ? questPins(trackedQuest, questProgress, objsRef.current, myPos() ?? undefined) : [];
  const questTarget = pins.find(p => p.role === questTrack?.role) ?? pins[0];

  function focusQuestPin(role: QuestPinRole, navigate: boolean) {
    setQuestTrack(track => track ? { ...track, role, navigate } : null);
  }

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
        const el = document.createElement('button'); el.type = 'button'; el.setAttribute('aria-label', o.name); const m = new maplibregl.Marker({ element: el }).setLngLat([o.lon, o.lat]).addTo(map);
        el.addEventListener('click', ev => { ev.stopPropagation(); setSel(o.id); }); rec = { m, el, sig: '' }; mkObj.current.set(o.id, rec);
      }
      rec.m.setLngLat([o.lon, o.lat]);
      if (rec.sig !== sig) {
        rec.sig = sig;
        const mob = o.k === 'mob' ? MOBS[o.def] : undefined;
        const sz = o.k === 'city' ? 34 : mob ? (boss ? 58 : elite ? 47 : 38) : 28;
        const color = COL[o.k] || '#fff';
        rec.el.classList.toggle('mk', true);
        rec.el.classList.toggle('near', isN);
        rec.el.classList.toggle('boss', !!boss);
        rec.el.classList.toggle('mob-token', !!mob);
        Object.assign(rec.el.style, { width: sz + 'px', height: sz + 'px', background: mob ? '#091620' : color + 'e6', borderColor: elite ? '#ffce72' : '' });
        const badge = document.createElement('span');
        badge.textContent = mob ? String(o.lvl ?? mob.lvl) : GLYPH[o.k] || '•';
        const label = document.createElement('span');
        label.className = 'lbl';
        label.style.color = color;
        label.textContent = o.name;
        if (mob) {
          const art = document.createElement('img');
          art.src = mobIconUrl(mob.art);
          art.alt = '';
          badge.className = 'level';
          rec.el.replaceChildren(art, badge, label);
        } else {
          rec.el.replaceChildren(badge, label);
        }
      }
    }
    for (const [id, rec] of mkObj.current) if (!seen.has(id)) { rec.m.remove(); mkObj.current.delete(id); }
    moveAvatar.current(me);
    // GeoJSON
    const ranges: any[] = []; if (me) { ranges.push(poly(me.lat, me.lon, GEO.interactM, { c: '#7dd3fc', o: 0.1 })); if (modeRef.current === 'gps' && gpsPos.current && gpsPos.current.acc > 5) ranges.push(poly(gpsPos.current.lat, gpsPos.current.lon, Math.min(gpsPos.current.acc, 500), { c: '#3b82f6', o: 0.12 })); }
    const cities = objs.filter(o => o.k === 'city' && o.r).map(o => poly(o.lat, o.lon, o.r!));
    const routeLine = (target: { lat: number; lon: number } | null | undefined) => target && me ?
      [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[me.lon, me.lat], [target.lon, target.lat]] } }] : [];
    const line = routeLine(targetRef.current);
    (map.getSource('ranges') as maplibregl.GeoJSONSource | undefined)?.setData(fc(ranges));
    (map.getSource('cities') as maplibregl.GeoJSONSource | undefined)?.setData(fc(cities));
    (map.getSource('line') as maplibregl.GeoJSONSource | undefined)?.setData(fc(line));
    (map.getSource('quest-area') as maplibregl.GeoJSONSource | undefined)?.setData(fc(pins.filter(p => p.radius).map(p => poly(p.lat, p.lon, p.radius!))));
    (map.getSource('quest-route') as maplibregl.GeoJSONSource | undefined)?.setData(fc(questTrack?.navigate ? routeLine(questTarget) : []));

    const mapPins = new Set<string>();
    for (const pin of pins) {
      const key = trackedQuest!.id + '|' + pin.key;
      mapPins.add(key);
      let marker = questMarkers.current.get(key);
      if (!marker) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'quest-pin ' + pin.role;
        el.textContent = pin.role === 'giver' ? '!' : pin.role === 'turnin' ? '✓' : '◎';
        el.addEventListener('click', event => { event.stopPropagation(); focusQuestPin(pin.role, false); });
        const offset: [number, number] = pin.role === 'giver' ? [-17, -20] : pin.role === 'turnin' ? [17, -20] : [0, -27];
        marker = new maplibregl.Marker({ element: el, offset }).setLngLat([pin.lon, pin.lat]).addTo(map);
        questMarkers.current.set(key, marker);
      }
      marker.getElement().setAttribute('aria-label', pinLabels[pin.role] + ' · ' + pin.name);
      marker.setLngLat([pin.lon, pin.lat]);
    }
    for (const [key, marker] of questMarkers.current) {
      if (mapPins.has(key)) continue;
      marker.remove();
      questMarkers.current.delete(key);
    }
    if (!questTrack) focusedQuest.current = null;
    else if (questTarget && focusedQuest.current !== questTrack) {
      if (questTrack.navigate && !me) return;
      focusedQuest.current = questTrack;
      const distance = me ? haversine(me.lat, me.lon, questTarget.lat, questTarget.lon) : 0;
      if (questTrack.navigate && me && modeRef.current === 'virtual' && distance <= 200000) {
        followRef.current = true;
        setFollow(true);
        void walkTo(questTarget.lat, questTarget.lon);
      } else {
        followRef.current = false;
        setFollow(false);
        map.easeTo({ center: [questTarget.lon, questTarget.lat], zoom: questTarget.radius ? 14.5 : 16, duration: 420 });
      }
    }
  };

  // Server-Pakete
  useEffect(() => {
    const off = net.on(m => {
      if (m.t === 'geoMotion') {
        const me = m.position as Me | undefined;
        if (me && (!me.mode || me.mode === modeRef.current)) {
          meRef.current = me;
          moveAvatar.current(me);
          const time = performance.now();
          if (me.speed && time - lastStepAt.current > 340 && !blockedRef.current) {
            lastStepAt.current = time;
            audio.sfx('step');
          }
        }
        return;
      }
      if (m.t !== 'geo') return;
      const me = m.me as Me | undefined;
      if (me && me.mode && me.mode !== modeRef.current) return;
      if (m.off || m.pending) {
        meRef.current = null;
        centered.current = false;
      } else if (me && typeof me.lat === 'number') meRef.current = me;
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
      targetRef.current = me?.dest ?? null;
      setWalking(!!me?.dest);
      setEta(me?.etaSeconds ?? 0);
      setInfo({ n: objsRef.current.length, speed: me?.speed ?? 0, flags: me?.flags ?? [], hasMe: !!me });
      redraw.current(); bump(x => x + 1);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new character or connection always needs a new server-side mode handshake.
  useEffect(() => {
    if (conn !== 'ok' || !char?.id) return;
    net.send('geoConsent', { on: true, visible: mode === 'virtual', gps: mode === 'gps' });
  }, [mode, conn, char?.id]);

  const [gpsRetry, setGpsRetry] = useState(0);
  useEffect(() => {
    if (mode !== 'gps' || conn !== 'ok') return;
    if (!navigator.geolocation) { setGpsErr('Dieses Gerät unterstützt keine Standortbestimmung.'); return; }
    setGpsErr('');
    let last = 0;
    let active = true;
    const watch = navigator.geolocation.watchPosition(p => {
      if (!active || modeRef.current !== 'gps') return;
      const { latitude: lat, longitude: lon, accuracy: acc } = p.coords;
      gpsPos.current = { lat, lon, acc };
      if (acc > 150) { setGpsErr('GPS-Signal zu ungenau. Warte auf eine genauere Position.'); return; }
      const now = Date.now();
      if (now - last < 950) return;
      last = now;
      void net.req('geoPos', { lat, lon, acc, mode: 'gps' }).then(result => {
        if (!active || modeRef.current !== 'gps') return;
        setGpsErr(result.t === 'err' ? result.err : '');
      });
    }, error => {
      if (!active) return;
      setGpsErr(error.code === 1 ? 'Standortzugriff gesperrt. Erlaube ihn in den Einstellungen.' :
        error.code === 2 ? 'Kein GPS-Signal verfügbar.' : 'GPS-Zeitüberschreitung. Versuche es im Freien erneut.');
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 16000 });
    return () => { active = false; navigator.geolocation.clearWatch(watch); };
  }, [mode, conn, gpsRetry]);

  useEffect(() => { redraw.current(); }, [follow, mode, questTrack, questStates, pins.map(p => p.lat + ':' + p.lon).join('|')]);

  function choose(c: Mode) {
    saveConsent(c);
    modeRef.current = c;
    if (c === 'gps') {
      meRef.current = null;
      objsRef.current = [];
      centered.current = false;
    }
    gpsPos.current = null;
    setGpsErr('');
    setMode(c);
    redraw.current();
  }
  async function wipe() {
    if (!window.confirm('Alle gespeicherten Standortdaten wirklich löschen?')) return;
    const result = await net.req('geoWipe');
    if (result.t === 'err') { toast(result.err, 'err'); return; }
    const alreadyVirtual = modeRef.current === 'virtual';
    choose('virtual');
    if (alreadyVirtual) net.send('geoConsent', { on: true, visible: false, gps: false });
    targetRef.current = null;
    setWalking(false);
    toast('Standortdaten gelöscht');
  }
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
  const questDistance = questTarget && me ? haversine(me.lat, me.lon, questTarget.lat, questTarget.lon) : null;
  const portal = o && destinations?.portal === o.id ? destinations : null;
  const KIND: Record<string, string> = { teleporter: 'Teleportportal', mob: 'Monster', node: 'Ressource', dungeon: 'Dungeon', city: 'Stadt', house: 'Haus', npc: 'NPC', poi: 'Ort' };

  return (
    <div className="geo" style={hidden ? { display: 'none' } : undefined}>
      <style>{CSS}</style>
      <div className="map" ref={box} />
      <div className="top">
        <div className="status">
          <div>{mode === 'gps' ? 'GPS' : 'Virtuell'} · {(info.speed * 3.6).toFixed(0)} km/h{walking ? ' · ' + (eta > 60 ? Math.ceil(eta / 60) + ' Min.' : eta + ' Sek.') : ''}</div>
          {rejected && <div className="bad">⚠ Bewegung abgelehnt ({info.flags.join(', ')})</div>}
          {gpsErr && <div className="bad">{gpsErr}</div>}
          {mapError && <div>{mapError}</div>}
          {!info.hasMe && <div>Warte auf Position…</div>}
        </div>

      </div>
      <div className="side">
        <button onClick={() => zoom(1)} aria-label="Hineinzoomen">＋</button>
        <button onClick={() => zoom(-1)} aria-label="Herauszoomen">−</button>
        <button onClick={() => mapRef.current?.easeTo({ bearing: 0 })} aria-label="Nach Norden ausrichten" style={{ transform: `rotate(${-bearing}deg)` }}>N</button>
        <button className={follow ? 'on' : ''} onClick={() => { const p = myPos(); setFollow(f => !f); if (p && !follow) mapRef.current?.easeTo({ center: [p.lon, p.lat] }); }} aria-label="Figur folgen" aria-pressed={follow}>◎</button>
        <button className={mapSettings ? 'on' : ''} onClick={() => setMapSettings(v => !v)} aria-label="Karteneinstellungen" aria-expanded={mapSettings}>≡</button>
      </div>
      {mapSettings && <section className="settings" aria-label="Karteneinstellungen">
        <label>Kartentyp
          <select value={preferences.kind} onChange={e => setMapKind(e.target.value as MapKind)}>
            <option value="standard">Standard</option><option value="satellite">Satellit · Übersicht</option><option value="buildings">3D-Gebäude</option>
          </select>
        </label>
        <label>Helligkeit · {preferences.brightness} %
          <input type="range" min="40" max="100" value={preferences.brightness} onChange={e => setPreferences({ ...preferencesRef.current, brightness: Number(e.target.value) })} />
        </label>
        <label>Ausrichtung · {Math.round(preferences.bearing)}°
          <input type="range" min="-180" max="180" value={Math.round(preferences.bearing)} onChange={e => mapRef.current?.setBearing(Number(e.target.value))} />
        </label>
        <label>Neigung · {Math.round(preferences.pitch)}°
          <input type="range" min="0" max="65" value={Math.round(preferences.pitch)} onChange={e => mapRef.current?.setPitch(Number(e.target.value))} />
        </label>
        {gpsErr && <button onClick={() => setGpsRetry(n => n + 1)}>GPS erneut versuchen</button>}
      </section>}
      {!hidden && !controlsBlocked && !mapSettings && mode === 'virtual' && info.hasMe &&
        <Joystick bearing={() => mapRef.current?.getBearing() ?? 0} onStart={() => { setSel(null); setFollow(true); followRef.current = true; }} />}
      {trackedQuest && !o && <section className="quest-track" aria-label="Quest auf der Karte">
        <div className="row"><b className="grow">{trackedQuest.name}</b><button aria-label="Questmarkierungen schließen" onClick={() => setQuestTrack(null)}>×</button></div>
        {questTarget && <div>{pinLabels[questTarget.role]} · {questTarget.name}{questDistance !== null && ' · ' + distanceLabel(questDistance)}</div>}
        {questStates?.[trackedQuest.id] && <div>{trackedQuest.goals.map((goal, i) => <span key={i}>{i > 0 && ' · '}{questProgress[i] ?? 0}/{goal.n}{goal.label ? ' ' + goal.label : ''}</span>)}</div>}
        {questTrack?.navigate && questDistance !== null && mode === 'virtual' && questDistance > 200000 && <div>Für diese Entfernung ein Teleportportal nutzen.</div>}
        {questTrack?.navigate && mode === 'gps' && <div>Die Linie zeigt die Richtung zum Ziel.</div>}
        <div className="row">{pins.map(pin => <button key={pin.key} onClick={() => focusQuestPin(pin.role, false)}>{pinLabels[pin.role]}</button>)}</div>
      </section>}
      {o && (
        <div className="pop">
          <h3>{o.name}{o.lvl ? ` · Lv ${o.lvl}` : ''}</h3>
          <div className="dim">{KIND[o.k] || o.k}{o.fam ? ` · ${o.fam}` : ''}{o.role === 'elite' ? ' · Elite' : o.role === 'boss' ? ' · Weltboss' : ''}</div>
          <div style={{ marginTop: 6, color: inRange ? '#8affb0' : '#ffd27a' }}>{inRange ? 'In Reichweite' : `${Math.round(dist)} m entfernt`}</div>
          {portal && inRange && (
            <div className="portal-destinations">
              {mode === 'gps' && <p>Zum Teleportieren in den virtuellen Modus wechseln.</p>}
              {portal.rows.length === 0 && <p>Entdecke weitere Orte, um sie als Ziele freizuschalten.</p>}
              {portal.rows.map(d => <button key={d.id} disabled={busy || mode === 'gps' || d.cost > gold} onClick={() => interact(o.id, d.id)}>{d.name} · {d.cost} Gold</button>)}
            </div>
          )}
          <div className="row">
            {inRange ? !portal && <button className="on" disabled={busy} onClick={() => interact(o.id)}>{o.k === 'teleporter' ? 'Ziele anzeigen' : o.k === 'mob' ? 'Angreifen' : 'Interagieren'}</button>
              : mode === 'virtual' ? <button className="on" onClick={() => walkTo(o.lat, o.lon)}>Hinlaufen</button>
              : <button disabled>Zu weit entfernt</button>}
            <button onClick={() => { setSel(null); setDestinations(null); }}>Schließen</button>
          </div>
        </div>
      )}
    </div>
  );
}
