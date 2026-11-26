"""Small public WMS smoke checks for sources considered for the game."""
from concurrent.futures import ThreadPoolExecutor
from math import log, pi, radians, tan
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

SOURCES = [
    ('nrw', 'https://www.wms.nrw.de/geobasis/wms_nw_dop', 'nw_dop_rgb', 51.2277, 6.7735),
    ('sn', 'https://geodienste.sachsen.de/wms_geosn_dop-rgb/guest', 'sn_dop_020', 51.051, 13.738),
    ('st', 'https://www.geodatenportal.sachsen-anhalt.de/wss/service/ST_LVermGeo_DOP_WMS_OpenData/guest',
        'lsa_lvermgeo_dop20_2', 52.1304, 11.635),
]
PAGES = 'https://neogoku.github.io'


def fetch(url, query, origin=PAGES):
    request = Request(url + '?' + urlencode(query), headers={'Origin': origin, 'User-Agent': 'NewAgeMMO source verification'})
    with urlopen(request, timeout=12) as response:
        body = response.read(2_000_001)
        if len(body) > 2_000_000:
            raise ValueError('Antwort überschreitet 2 MB')
        return response.headers, body


def tile(url, layer, lat, lon, origin):
    x, y = 6378137 * radians(lon), 6378137 * log(tan(pi / 4 + radians(lat) / 2))
    args = dict(SERVICE='WMS', VERSION='1.1.1', REQUEST='GetMap', LAYERS=layer, STYLES='', FORMAT='image/png',
                TRANSPARENT='TRUE', SRS='EPSG:3857', WIDTH=256, HEIGHT=256,
                BBOX=','.join(str(v) for v in (x - 120, y - 120, x + 120, y + 120)))
    headers, body = fetch(url, args, origin)
    if headers.get('Access-Control-Allow-Origin') not in ('*', origin):
        raise ValueError(f'CORS fehlt für {origin}')
    if not body.startswith(b'\x89PNG\r\n\x1a\n') or len(body) < 300 or body[16:24] != b'\0\0\1\0\0\0\1\0':
        raise ValueError('Kein PNG mit 256×256 Pixeln')
    return body


def check(source):
    key, url, layer, lat, lon = source
    try:
        _, document = fetch(url, dict(SERVICE='WMS', VERSION='1.1.1', REQUEST='GetCapabilities'))
        root = ET.fromstring(document)
        if not any(node.text == layer for node in root.iter() if node.tag.split('}')[-1] == 'Name'):
            raise ValueError('Layer fehlt in GetCapabilities')
        tile(url, layer, lat, lon, PAGES)
        outer = tile(url, layer, 49.2, 9.2, PAGES)
        if outer[25] not in (4, 6) and b'tRNS' not in outer:
            raise ValueError('Keine Transparenz außerhalb der Abdeckung')
        try:
            tile(url, layer, lat, lon, 'http://localhost')
            android = 'ja'
        except (OSError, ValueError):
            android = 'nein'
        return f'{key} OK. Pages-PNG und Transparenz geprüft. Android-CORS {android}.'
    except (OSError, ValueError, ET.ParseError) as error:
        return f'{key} nicht freigegeben. {error}'


with ThreadPoolExecutor(max_workers=3) as pool:
    for result in pool.map(check, SOURCES):
        print('::notice::' + result)
