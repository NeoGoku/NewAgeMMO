import { RESIDENTIAL_BUILDINGS, VIRTUAL_PLOT, type GeoObj, type GeoPropertyOffer } from '@nam/shared';

export const propertyModes = [
  { id: 'buy', label: 'Kaufen' }, { id: 'rent', label: 'Mieten' }, { id: 'mine', label: 'Eigene oder gemietete' },
] as const;
export const propertyTypes = [
  { id: 'flat', label: 'Wohnungen' }, { id: 'house', label: 'Häuser' },
  { id: 'commercial', label: 'Gewerbe' }, { id: 'plot', label: 'Baugrundstücke' },
] as const;
export const propertyBuildingNames: Record<string, string> = {
  apartments: 'Mehrfamilienhaus', detached: 'Einfamilienhaus', house: 'Haus', residential: 'Wohngebäude',
  semidetached_house: 'Doppelhaushälfte', terrace: 'Reihenhaus', bungalow: 'Bungalow', dormitory: 'Wohnheim',
  commercial: 'Gewerbeimmobilie', retail: 'Ladenlokal', office: 'Bürogebäude', virtual_plot: 'Virtuelles Baugrundstück',
};
export type PropertyMode = typeof propertyModes[number]['id'];
export type PropertyType = typeof propertyTypes[number]['id'];
export type PropertyFilters = {
  modes: readonly PropertyMode[];
  types: readonly PropertyType[];
  building: string;
  maxPrice: string;
  minArea: string;
  maxDistance: string;
};
export const defaultPropertyFilters: PropertyFilters = {
  modes: [], types: [], building: '', maxPrice: '', minArea: '', maxDistance: '',
};
type SearchData = { building?: unknown; marketStatus?: unknown; buyGold?: number; rentGold?: number; areaM2?: number };

function propertyType(building: unknown): PropertyType | undefined {
  if (building === VIRTUAL_PLOT) return 'plot';
  if (building === 'apartments' || building === 'dormitory') return 'flat';
  if (building === 'commercial' || building === 'retail' || building === 'office') return 'commercial';
  if (RESIDENTIAL_BUILDINGS.some(value => value === building)) return 'house';
}

function threshold(raw: string) {
  const value = Number(raw);
  return raw.trim() && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function matchesProperty(candidate: GeoPropertyOffer | GeoObj, filters: PropertyFilters, distanceM?: number) {
  const data: SearchData | undefined = 'k' in candidate ? candidate.extra : {
    building: candidate.building,
    marketStatus: candidate.marketStatus ??
      (candidate.status === 'mine' ? candidate.rentUntil ? 'rent' : 'own'
        : candidate.status === 'owned' ? 'owned' : candidate.building === VIRTUAL_PLOT ? 'plot' : 'sale'),
    buyGold: candidate.buyGold,
    rentGold: candidate.rentGold,
    areaM2: candidate.areaM2 ?? candidate.unitAreaM2 ?? (candidate.floorAreaM2 || candidate.footprintM2),
  };
  const type = propertyType(data?.building);
  if (filters.types.length && (!type || !filters.types.includes(type))) return false;
  if (filters.building && data?.building !== filters.building) return false;
  const minArea = threshold(filters.minArea);
  const area = data?.areaM2;
  if (minArea !== undefined && (area === undefined || !Number.isFinite(area) || area < minArea)) return false;
  const maxDistance = threshold(filters.maxDistance);
  const distance = 'k' in candidate ? distanceM : candidate.distanceM;
  if (maxDistance !== undefined && (distance === undefined || !Number.isFinite(distance) || Math.round(distance) > maxDistance)) return false;

  const { marketStatus, rentGold, buyGold } = data ?? {};
  const maxPrice = threshold(filters.maxPrice);
  const matchesPrice = (price: number | undefined) => maxPrice === undefined ||
    (typeof price === 'number' && Number.isFinite(price) && price <= maxPrice);
  const currentPrice = marketStatus === 'rent' || marketStatus === 'rentable' ? rentGold : buyGold;
  if (!filters.modes.length) return matchesPrice(currentPrice);
  return filters.modes.some(mode => {
    if (mode === 'mine') return (marketStatus === 'own' || marketStatus === 'rent') && matchesPrice(currentPrice);
    if (mode === 'buy') return (marketStatus === 'sale' || marketStatus === 'plot') && matchesPrice(buyGold);
    return (marketStatus === 'sale' || marketStatus === 'rentable') && rentGold !== undefined && rentGold > 0 && matchesPrice(rentGold);
  });
}
