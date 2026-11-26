# Third-Party Notices (Kartenstyles)

Dieses Dokument ergänzt `docs/ASSET_LICENSES.md` um Herkunft, Lizenz und Änderungen der für die sechs Kartenstyles genutzten Drittquellen.

## Geodaten und Kacheln
| Quelle | Verwendung | Lizenz / Attribution |
|---|---|---|
| OpenStreetMap-Mitwirkende | Geometrien und Namen in allen Vektorkarten und der Standard-Rasterkarte | ODbL 1.0 – Attribution „© OpenStreetMap-Mitwirkende“ bleibt in der Karte sichtbar |
| OpenFreeMap (`tiles.openfreemap.org/planet`) | Vektorkacheln im OpenMapTiles-Schema (nur Daten, keine fremde Style-JSON, keine API-Schlüssel) | Daten ODbL; Schema © OpenMapTiles (CC BY 4.0) – Attribution in der Karte |
| LGLN Digitale Orthophotos DOP20 (Niedersachsen) | Satellitenkarte im Detailzoom (WMS, 20 cm) | CC BY 4.0, Quellenvermerk „Luftbilder © LGLN (DOP20)“; geprüft per GetCapabilities/GetMap (HTTP 200, CORS `*`, EPSG:3857) |
| EOX Sentinel-2 cloudless 2024 / NASA Blue Marble | nur Übersicht (≤ Zoom 14) | siehe `docs/ASSET_LICENSES.md` |
| BKG DOP (`sg.geodatenzentrum.de/wms_dop*`) | nicht genutzt | Endpunkte antworteten mit ERROR_UNKNOWN_SERVICE bzw. NOACCESS_SERVICE; nicht erreichbar/freigegeben |

## Schriften (lokal als SDF-Glyphen unter `apps/web/public/fonts/`)
Aus den OFL-lizenzierten Schriften wurden mit `fontnik` (BSD) Glyphen-PBFs (Latin 0–511, Satzzeichen 8192–8447) erzeugt. Die Stapel tragen eigene Namen (`NAM …`), da es sich um abgeleitete Daten handelt. Lizenztexte: `apps/web/public/fonts/licenses/`.

| Stapel | Quelle (npm `@fontsource/*`) | Lizenz | Einsatz |
|---|---|---|---|
| Noto Sans Regular / Bold | Noto Sans | SIL OFL 1.1 | Metro Noir |
| NAM Condensed Bold | Saira Condensed Bold | SIL OFL 1.1 | Underground |
| NAM Block Regular | Russo One | SIL OFL 1.1 | West Coast |
| NAM Chronicle Regular | IM Fell English | SIL OFL 1.1 | Frontier (Fließtext) |
| NAM Frontier Regular | Rye | SIL OFL 1.1 | Frontier (Ortsnamen) |
| NAM Pixel Bold | Silkscreen Bold | SIL OFL 1.1 | Pixel Adventure |
| NAM Neon Bold | Orbitron Bold | SIL OFL 1.1 | Neon District |

## Eigenentwicklung
Alle Layer-Definitionen (`apps/web/src/geo/styles/*.ts`), Piktogramme (Linien-Glyphen in `sprites.ts`), Pixel-Sprites, Papier-, Schraffur- und Pixelmuster werden zur Laufzeit prozedural durch eigenen Code erzeugt. Die Namen „Underground“, „Metro Noir“, „West Coast“, „Frontier“, „Pixel Adventure“ und „Neon District“ sind eigene Bezeichnungen; Spielnamen dienten nur als interne Designreferenz.

## Geprüfte, nicht übernommene Quellen
- **MapLibre GL JS / Style-Spezifikation**: bereits Abhängigkeit (BSD-3); Spezifikation als Referenz genutzt.
- **Maputnik, Planetiler**: nicht benötigt (Styles werden als Code erzeugt, Kacheln kommen von OpenFreeMap).
- **Protomaps basemaps, VersaTiles**: eigene Schemata (Protomaps / Shortbread), nicht kompatibel mit dem bestehenden OpenMapTiles-Datenschema; keine Übernahme von Styles oder Kachel-Endpunkten.
- **OpenMapTiles-Style-Repositories**: nicht als Vorlage kopiert; nur das öffentlich dokumentierte Schema wurde verwendet.
- **Snazzy Maps**: Google-Maps-Style-Format, nicht MapLibre-kompatibel und nicht pauschal frei – nur als visuelle Inspiration, nichts übernommen.
- **Game Map IRL und Spielkarten (NFS, GTA, RDR2, Pokémon)**: keine Assets, Icons, Schriften oder Daten übernommen.
