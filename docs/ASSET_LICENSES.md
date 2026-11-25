# Asset-Herkunft
Szenen, Charaktere, Monster, Item-/Skillicons, Effekte, App-Icon und Töne werden **zur Laufzeit prozedural** durch eigenen Code erzeugt (Canvas2D/WebAudio). Die Oberfläche verwendet Systemschriften. Quellen für Kartenbilder und Kartenschriften stehen unten.
**Vorläufig:** Die prozedurale Optik ist ein Platzhalter-Niveau für die Alpha. Handgezeichnete/lizenzierte Endassets können später je Ort/Charakter ergänzt werden; jedes neue Asset muss hier mit Quelle und Lizenz eingetragen werden.
Abhängigkeiten (MIT/Apache): react, react-dom, vite, vite-plugin-pwa, ws, pg, tsx, typescript, @capacitor/*.


## Karten und Geodaten

- Die Standardkarte lädt sichtbare OSM-Kacheln gemäß der Tile Usage Policy. OpenStreetMap-Daten stehen unter ODbL. [OpenStreetMap](https://www.openstreetmap.org/copyright) · [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- 3D-Gebäude und Kartenstile verwenden OSM-Geometrien und verfügbare Gebäudehöhen von OpenFreeMap. Die Noto-Sans-Kartenschrift steht unter SIL OFL 1.1 und wird als Glyphendienst von OpenFreeMap geladen. [OpenFreeMap](https://openfreemap.org/) · [Schriftlizenz](https://github.com/openmaptiles/fonts/blob/master/noto-sans/LICENSE)
- Die Satellitendetailansicht lädt den Landsat-GWELD-Jahreskomposit in Echtfarben über öffentliches NASA GIBS WMTS ohne API-Schlüssel. Der Dienst liefert Web-Mercator-Kacheln bis Matrixstufe 12. [GIBS WMTS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/#ogc-web-map-tile-service-wmts) · [GWELD-Datensatz](https://doi.org/10.5067/MEaSUREs/GWELD/GWELDYR.031)
- Die mitgelieferte Satellitenübersicht stammt aus NASA Worldview. Dafür wurde das MODIS-Mosaik Blue Marble in Web Mercator umprojiziert und auf 1024 × 1024 Pixel verkleinert. Es bleibt bei Ausfällen externer Kacheln sichtbar. [NASA-Hinweise zur Bildnutzung](https://github.com/nasa-gibs/worldview/blob/main/config/default/common/brand/about/imagery.md) · [Bildquelle](https://github.com/nasa-gibs/worldview/blob/1323548582f04ebf3e36eb2efe182ff03a03c4d2/web/images/map/bluemarble-geographic.jpg)
- Optionale regionale Orientierungspunkte: OpenStreetMap (ODbL). Ein konfigurierter Online-Server fragt einen Overpass-Dienst mit begrenzten regionalen Anfragen ab. Prozedurale Regionen bleiben bei Ausfällen spielbar.

Underground, Urban, Vintage, Adventure, Cyber, Pixel und Neonviertel verwenden eigene Kartenregeln und prozedurale Texturen. Die sieben Menübilder wurden mit diesen Regeln in MapLibre aus OSM-Geometrien von Monaco gerendert. Der Datenstand des Ausschnitts ist 28. April 2015. [Monaco-Extrakt](https://github.com/openmaptiles/openmaptiles-tools/blob/7c34679d32c28c93884157299b3c22a135f0128e/tests/http/monaco-20150428.osm.pbf) · [OpenStreetMap und ODbL](https://www.openstreetmap.org/copyright)

Immobilienkataloge und Valhalla-Geometrien können auf OpenStreetMap (ODbL) beruhen. Beim Bereitstellen eines Katalogs Quellenbezug, Datenstand und die ODbL-Bedingungen mitführen.
