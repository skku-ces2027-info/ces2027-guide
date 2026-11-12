# -*- coding: utf-8 -*-
"""Paint maps/city.svg, the map of the whole Las Vegas valley that the page opens on.

    python3 tools/city_map.py ROADS.json [MORE.json ...] [--venues RAW_STRIP.svg] [--palette clear]

Each input is an Overpass API result with geometry ("out geom;"). The data used for the published
file came from these queries, one file per road class, over the box 35.868,-115.367,36.370,-114.970:

    [out:json];way["highway"="motorway"](BOX);out geom;      (also trunk, primary, secondary)
    [out:json];way["aeroway"="runway"](BOX);out geom;

--venues takes the raw strip map (see tools/refine_maps.py) and marks the CES venues as small coloured shapes.

The picture uses the same projection as maps/strip.svg, shrunk 8 times around the middle of the venue map,
so when the page enlarges it 8 times it lies exactly under that map. Map data © OpenStreetMap contributors.
"""
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import re   # noqa: E402
from refine_maps import DEFS, MAPS, MARK, PALETTES, RAW_VENUE, VIEW   # noqa: E402

K = 8                                   # how many times wider this map is than the venue map
CX, CY = VIEW[0] + VIEW[2] / 2, VIEW[1] + VIEW[3] / 2      # the point both maps share

# the guidebook generator's projection: a plan view pressed to 58% of its height
LAT_S, LAT_N, LON_W, LON_E = 36.0885, 36.1452, -115.1830, -115.1452
TILT, MAP_TOP, MAP_BOT, TALL = 0.58, 205, 2250, 230 * 1.5
KX, KY = 111320 * math.cos(math.radians(36.12)), 110950
SC = min(1700 / ((LON_E - LON_W) * KX), (MAP_BOT - MAP_TOP) / ((LAT_N - LAT_S) * KY * TILT + TALL))
OX, OY = (1700 - (LON_E - LON_W) * KX * SC) / 2, MAP_TOP + TALL * SC


def place(lat, lon):
    """Latitude and longitude to this map's units."""
    x, y = OX + (lon - LON_W) * KX * SC, OY + (LAT_N - lat) * KY * SC * TILT
    return CX + (x - CX) / K, CY + (y - CY) / K


# class: (wash width, surface width), drawn in this order so wider roads lie on top. The wash is a broad pale
# stroke under each road; where the street grid is dense the washes run together and read as the built-up area
ROADS = [('secondary', 7.5, 1.5), ('primary', 9.0, 2.5), ('trunk', 10.0, 4.0), ('motorway', 12.0, 5.4)]


def venue_shapes(raw, pal):
    """The venue buildings from the raw strip map, shrunk to this map's scale, in their roof colour."""
    by = {}
    for m in re.finditer(r'<polygon points="([^"]*)" fill="(#[0-9a-f]{6})"', raw):
        if m.group(2) not in RAW_VENUE:
            continue
        campus = RAW_VENUE[m.group(2)][0]
        pts = [tuple(map(float, p.split(','))) for p in m.group(1).split()]
        by.setdefault(campus, []).append('M' + 'L'.join('%.1f %.1f' % (CX + (x - CX) / K, CY + (y - CY) / K) for x, y in pts) + 'Z')
    return ''.join('<path d="%s" fill="%s" stroke="%s" stroke-width="1.2" stroke-linejoin="round"/>' % (''.join(d), pal[c][1], pal[c][1]) for c, d in by.items())


def paint_city(files, pal, venues=''):
    x0, y0, w, h = VIEW
    lines = {name: [] for name, _, _ in ROADS}
    lines['runway'] = []
    for path in files:
        for el in json.load(open(path, encoding='utf-8'))['elements']:
            tags = el.get('tags', {})
            kind = tags.get('highway') or ('runway' if tags.get('aeroway') == 'runway' else None)
            if kind not in lines or 'geometry' not in el:
                continue
            pts, last = [], None
            for g in el['geometry']:
                p = place(g['lat'], g['lon'])
                if last is None or abs(p[0] - last[0]) + abs(p[1] - last[1]) >= 1.6:   # drop points too close to matter
                    pts.append(p); last = p
            end = place(el['geometry'][-1]['lat'], el['geometry'][-1]['lon'])
            if pts[-1] != end:
                pts.append(end)
            if len(pts) > 1 and any(x0 - 30 <= x <= x0 + w + 30 and y0 - 30 <= y <= y0 + h + 30 for x, y in pts):
                lines[kind].append('M' + 'L'.join('%d %d' % (round(p[0]), round(p[1])) for p in pts))
    # each class is written once and drawn twice (wash, then surface)
    shapes = ''.join('<path id="r-%s" d="%s"/>' % (name, ''.join(lines[name])) for name, _, _ in ROADS)
    out = ['<path d="%s" stroke="%s" stroke-width="5"/>' % (''.join(lines['runway']), pal['context'][2])]
    for name, wash, surface in ROADS:
        out.append('<use href="#r-%s" stroke="%s" stroke-width="%.1f"/>' % (name, pal['context'][0], wash))
    for name, wash, surface in ROADS:
        out.append('<use href="#r-%s" stroke="%s" stroke-width="%.1f"/>' % (name, pal['road'], surface))
    counts = ', '.join('%s %d' % (k, len(v)) for k, v in lines.items())
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="%d %d %d %d" role="img">%s' % (x0, y0, w, h, MARK) + DEFS
            + '<defs>' + shapes + '</defs>'
            + '<g filter="url(#paint)"><rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>' % (x0 - 80, y0 - 80, w + 160, h + 160, pal['land'])
            + '<g fill="none" stroke-linejoin="round" stroke-linecap="round">' + ''.join(out) + '</g>' + venues + '</g></svg>'), counts


if __name__ == '__main__':
    args = sys.argv[1:]
    name = 'clear'
    if '--palette' in args:
        i = args.index('--palette'); name = args[i + 1]; del args[i:i + 2]
    venues = ''
    if '--venues' in args:
        i = args.index('--venues'); venues = venue_shapes(Path(args[i + 1]).read_text(encoding='utf-8'), PALETTES[name]); del args[i:i + 2]
    assert args, __doc__
    svg, counts = paint_city(args, PALETTES[name], venues)
    (MAPS / 'city.svg').write_text(svg, encoding='utf-8')
    print('city.svg  %.0f KB  (%s)' % (len(svg.encode()) / 1024, counts))
