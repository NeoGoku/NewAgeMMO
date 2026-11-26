import { defaultPropertyFilters, propertyBuildingNames, propertyModes, propertyTypes, type PropertyFilters } from '../geo/property-filter';
import { set, state, useS } from '../store';

const update = (filters: Partial<PropertyFilters>) => set({ propertyFilters: { ...state.propertyFilters, ...filters } });
const toggle = <T,>(values: readonly T[], value: T) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];

export function PropertyFilterFields({ compact, onOpenMarket }: { compact?: boolean; onOpenMarket?: () => void }) {
  const filters = useS(store => store.propertyFilters);
  const active = filters.modes.length + filters.types.length + [filters.building, filters.maxPrice, filters.minArea, filters.maxDistance].filter(Boolean).length;
  const priceLabel = filters.modes.length === 1 && filters.modes[0] === 'rent' ? 'Wochenmiete bis (Gold)' : 'Preis bis (Gold)';
  return <details className={compact ? 'property-filters' : 'property-filters card'}>
    <summary>Immobilien filtern{active > 0 && ` (${active})`}</summary>
    <div className="property-filter-body">
      <fieldset><legend>Angebot</legend>
        {propertyModes.map(({ id, label }) => <label key={id}>
          <input type="checkbox" checked={filters.modes.includes(id)} onChange={() => update({ modes: toggle(state.propertyFilters.modes, id) })} />
          {label}
        </label>)}
      </fieldset>
      <fieldset><legend>Immobilienart</legend>
        {propertyTypes.map(({ id, label }) => <label key={id}>
          <input type="checkbox" checked={filters.types.includes(id)} onChange={() => update({ types: toggle(state.propertyFilters.types, id) })} />
          {label}
        </label>)}
      </fieldset>
      <div className="property-filter-fields">
        <label>Gebäudetyp <select value={filters.building} onChange={event => update({ building: event.target.value })}>
          <option value="">Alle</option>
          {Object.entries(propertyBuildingNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <label>{priceLabel} <input inputMode="numeric" type="number" min="0" value={filters.maxPrice} onChange={event => update({ maxPrice: event.target.value })} /></label>
        <label>Fläche ab (m²) <input inputMode="numeric" type="number" min="0" value={filters.minArea} onChange={event => update({ minArea: event.target.value })} /></label>
        <label>Entfernung bis (m) <input inputMode="numeric" type="number" min="0" value={filters.maxDistance} onChange={event => update({ maxDistance: event.target.value })} /></label>
      </div>
      {(active > 0 || onOpenMarket) && <div className="property-filter-actions">
        {active > 0 && <button type="button" className="btn sm" onClick={() => set({ propertyFilters: defaultPropertyFilters })}>Zurücksetzen</button>}
        {onOpenMarket && <button type="button" className="btn sm" onClick={onOpenMarket}>Markt öffnen</button>}
      </div>}
    </div>
  </details>;
}
