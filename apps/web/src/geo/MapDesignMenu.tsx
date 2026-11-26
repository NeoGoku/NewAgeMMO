import { useState, type ReactNode } from 'react';
import { MAP_STYLES, MAP_TYPES, mapThemePreview, mapWorldPreview, type MapKind, type MapPreferences, type MapTheme } from './map-style';

const previews = new Map(MAP_STYLES.map(style => [style.id, [mapThemePreview(style.id), mapWorldPreview(style.id)] as const]));

export function MapDesignMenu({ value, onType, onStyle, onClose, children }: {
  value: MapPreferences;
  onType: (value: MapKind) => void;
  onStyle: (value: MapTheme | null) => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [tab, setTab] = useState<'type' | 'style'>('type');
  return <section id="map-settings" className="settings" aria-label="Karteneinstellungen">
    <div className="row map-settings-head"><b className="grow">Kartenansicht</b><button type="button" onClick={onClose} aria-label="Karteneinstellungen schließen">×</button></div>
    <div className="row" role="tablist" aria-label="Kartenansicht">
      <button type="button" id="map-types-tab" role="tab" aria-controls="map-design-choices" aria-selected={tab === 'type'} className={tab === 'type' ? 'on' : ''} onClick={() => setTab('type')}>Kartentypen</button>
      <button type="button" id="map-styles-tab" role="tab" aria-controls="map-design-choices" aria-selected={tab === 'style'} className={tab === 'style' ? 'on' : ''} onClick={() => setTab('style')}>Kartenstyles</button>
    </div>
    <div id="map-design-choices" role="tabpanel" aria-labelledby={tab === 'type' ? 'map-types-tab' : 'map-styles-tab'}>
      {tab === 'type' ? <div className="map-types">
        {MAP_TYPES.map(type => <button key={type.id} type="button" aria-pressed={value.kind === type.id} className={value.kind === type.id ? 'on' : ''} onClick={() => onType(type.id)}>{type.label}</button>)}
      </div> : <>
        <div className="map-previews">
          {MAP_STYLES.map(style => <button key={style.id} type="button" aria-pressed={value.style === style.id} className={value.style === style.id ? 'on' : ''} onClick={() => onStyle(style.id)}>
            <span className="preview"><img src={previews.get(style.id)![0]} alt="" width={180} height={85} loading="lazy" /><img className="world" src={previews.get(style.id)![1]} alt="" width={40} height={40} loading="lazy" /></span>
            <span>{style.label}</span>
          </button>)}
        </div>
        <small>Vorschau: echte Karte, Braunschweig Innenstadt und Weltübersicht · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap-Mitwirkende</a> · © OpenMapTiles</small>
        {value.style && <button type="button" className="reset-theme" onClick={() => onStyle(null)}>Basisfarben verwenden</button>}
      </>}
    </div>
    <details><summary>Helligkeit und Kamera</summary>{children}</details>
  </section>;
}
