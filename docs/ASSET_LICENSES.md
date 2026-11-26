# Asset-Herkunft
Szenen, Charaktere, Monster, Item-/Skillicons, Effekte, App-Icon und Töne werden **zur Laufzeit prozedural** durch eigenen Code erzeugt (Canvas2D/WebAudio). Die Oberfläche verwendet Systemschriften. Quellen für Kartenbilder und Kartenschriften stehen unten.
**Vorläufig:** Die prozedurale Optik ist ein Platzhalter-Niveau für die Alpha. Handgezeichnete/lizenzierte Endassets können später je Ort/Charakter ergänzt werden; jedes neue Asset muss hier mit Quelle und Lizenz eingetragen werden.
Abhängigkeiten (MIT/Apache): react, react-dom, vite, vite-plugin-pwa, ws, pg, tsx, typescript, @capacitor/*.


## Karten und Geodaten

- Die Standardkarte lädt sichtbare OSM-Kacheln gemäß der Tile Usage Policy. OpenStreetMap-Daten stehen unter ODbL. [OpenStreetMap](https://www.openstreetmap.org/copyright) · [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)
- 3D-Gebäude und Kartenstile verwenden OSM-Geometrien und verfügbare Gebäudehöhen von OpenFreeMap. Die Noto-Sans-Kartenschrift steht unter SIL OFL 1.1 und wird als Glyphendienst von OpenFreeMap geladen. [OpenFreeMap](https://openfreemap.org/) · [Schriftlizenz](https://github.com/openmaptiles/fonts/blob/master/noto-sans/LICENSE)
- Die Satellitendetailansicht lädt Sentinel-2 cloudless 2024 über den öffentlichen EOX-WMS. Die Karte zeigt die vorgeschriebene Quellenangabe mit Verweis auf EOX und Copernicus. [Quelle und Nutzungsbedingungen](https://s2maps.eu/) · [WMS-Quelle im OSM Editor Layer Index](https://github.com/osmlab/editor-layer-index/blob/gh-pages/sources/world/eox.at-2024-cloudless.geojson)
- Die mitgelieferte Satellitenübersicht stammt aus NASA Worldview. Dafür wurde das MODIS-Mosaik Blue Marble in Web Mercator umprojiziert und auf 1024 × 1024 Pixel verkleinert. Es bleibt als Weltübersicht verfügbar. Ab Zoomstufe 8 liegt die OSM-Straßenkarte unter den Detailkacheln, damit fehlende Satellitenkacheln die Orientierung nicht verhindern. [NASA-Hinweise zur Bildnutzung](https://github.com/nasa-gibs/worldview/blob/main/config/default/common/brand/about/imagery.md) · [Bildquelle](https://github.com/nasa-gibs/worldview/blob/1323548582f04ebf3e36eb2efe182ff03a03c4d2/web/images/map/bluemarble-geographic.jpg)
- Optionale regionale Orientierungspunkte: OpenStreetMap (ODbL). Ein konfigurierter Online-Server fragt einen Overpass-Dienst mit begrenzten regionalen Anfragen ab. Prozedurale Regionen bleiben bei Ausfällen spielbar.

Underground, Urban, Vintage, Adventure, Cyber, Pixel und Neonviertel verwenden eigene Kartenregeln und prozedurale Texturen. Die sieben Menübilder wurden mit diesen Regeln in MapLibre aus OSM-Geometrien von Monaco gerendert. Der Datenstand des Ausschnitts ist 28. April 2015. [Monaco-Extrakt](https://github.com/openmaptiles/openmaptiles-tools/blob/7c34679d32c28c93884157299b3c22a135f0128e/tests/http/monaco-20150428.osm.pbf) · [OpenStreetMap und ODbL](https://www.openstreetmap.org/copyright)

Immobilienkataloge und Valhalla-Geometrien können auf OpenStreetMap (ODbL) beruhen. Beim Bereitstellen eines Katalogs Quellenbezug, Datenstand und die ODbL-Bedingungen mitführen.

Der gebündelte Braunschweig-Katalog enthält aus dem Geofabrik-Auszug für Niedersachsen abgeleitete OpenStreetMap-Gebäudeumrisse unter ODbL 1.0. Datenstand, Lizenz und Herkunft stehen in der GeoJSON-Datei. [Geofabrik](https://download.geofabrik.de/europe/germany/niedersachsen.html) · [OpenStreetMap](https://www.openstreetmap.org/copyright) · [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/)

Das Braunschweiger Gehwegenetz beruht auf demselben Geofabrik-Extrakt und wird einschließlich Herkunft und ODbL-Hinweisen ausgeliefert. Zwei Beispielrouten wurden mit den ausgelieferten Geodaten berechnet. Der Datenworkflow prüft zudem eine öffentliche Sentinel-2-Detailkachel für Braunschweig auf JPEG und CORS.
