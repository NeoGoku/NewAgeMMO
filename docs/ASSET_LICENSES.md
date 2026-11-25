# Asset-Herkunft
Alle Grafiken (Szenen, Charaktere, Monster, Item-/Skillicons, Effekte, App-Icon) und Töne (Musik, Soundeffekte) werden **zur Laufzeit prozedural** durch eigenen Code erzeugt (Canvas2D/WebAudio). Es werden keine fremden Bild-, Ton- oder Schriftdateien eingebunden; es werden Systemschriften verwendet. Die Kartengrundlagen werden extern geladen und separat attribuiert.
**Vorläufig:** Die prozedurale Optik ist ein Platzhalter-Niveau für die Alpha. Handgezeichnete/lizenzierte Endassets können später je Ort/Charakter ergänzt werden; jedes neue Asset muss hier mit Quelle und Lizenz eingetragen werden.
Abhängigkeiten (MIT/Apache): react, react-dom, vite, vite-plugin-pwa, ws, pg, tsx, typescript, @capacitor/*.


## Karten und Geodaten

- Standardkarte: [OpenStreetMap](https://www.openstreetmap.org/copyright), Daten unter ODbL. Die [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) gilt für sichtbare Kartenkacheln. Der Service Worker speichert nur Spiel-Assets.
- 3D-Gebäude: [OpenFreeMap](https://openfreemap.org/) verwendet OSM-Gebäudegrundrisse und verfügbare Höhen. OSM und OpenFreeMap werden auf der Karte attribuiert.
- Satellitenübersicht: [NASA EOSDIS GIBS](https://www.earthdata.nasa.gov/data/projects/gibs), Blue Marble mit globaler Abdeckung und begrenzter Detailauflösung.
- Optionale regionale Orientierungspunkte: OpenStreetMap (ODbL). Ein konfigurierter Online-Server fragt einen Overpass-Dienst mit begrenzten regionalen Anfragen ab. Prozedurale Regionen bleiben bei Ausfällen spielbar.

Die Designs Underground, Urban, Vintage, Adventure und Cyber kombinieren eigene Farben und Linienregeln mit OSM-Vektordaten von OpenFreeMap. Spielporträts und Marker stammen aus demselben prozeduralen Spiel-Client in allen Ansichten.
