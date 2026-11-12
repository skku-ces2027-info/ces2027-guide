# -*- coding: utf-8 -*-
"""Paint the site maps from the raw export. Run from the repository root:

    python3 tools/refine_maps.py RAW_STRIP.svg [--palette clear]

RAW_STRIP.svg is the raw strip map (the guidebook generator's public copy, as first committed in
maps/strip.svg). The script writes two maps from it.

maps/strip.svg, the watercolour picture on the first screen:

  - baked-in labels, leader lines, scale bar and title band are dropped (the page draws labels in HTML)
  - surrounding buildings become pale washes and minor streets are left out, so the venues stand out
  - outlines are roughened and paper grain shows through, like paint on paper
  - the view box keeps every venue building whole and adds an empty wash on the left,
    where the page fades the map into the paper behind the title

maps/strip_detail.svg, the plain map shown when a row is opened:

  - the same shapes and colours with crisp edges and every street, for finding the building

It also translates the labels in lvcc.svg and venetian_*.svg to English (once; safe to run again).
The colours in PALETTES must match the tokens at the top of style.css.
"""
import re
import sys
from pathlib import Path

MAPS = Path(__file__).resolve().parent.parent / 'maps'
MARK = '<!--refined-->'
VIEW = (-420, 240, 2120, 1940)         # x, y, width, height in the generator's 1700 x 2400 space.
                                       # Venues span x 144-1628, y 423-1718; the rest is room for the page to crop
DETAIL_VIEW = (0, 300, 1700, 1500)

# land, road, road edge, surrounding buildings (roof, wall, shaded wall), then roof/wall/shade per campus
PALETTES = {
    'clear': dict(land='#f0ece3', road='#ffffff', edge='#e3dfd5', context=('#d3dcdf', '#c5d0d4', '#b8c5ca'), sphere='#c9cfd1',
                  L=('#5e9fd6', '#3a78b5', '#2b5d92'), V=('#4db594', '#2a8f71', '#1f7059'), C=('#ef7f5f', '#d2573a', '#ad4329'), F=('#a183dc', '#7b5bc2', '#5f44a0')),
    'dusk': dict(land='#f6e7d6', road='#fffaf2', edge='#ebd9c4', context=('#edd3be', '#e5c6ae', '#ddb9a0'), sphere='#e3cdb8',
                 L=('#7b89d0', '#4a5aae', '#39478e'), V=('#5dbab6', '#24908c', '#1b7370'), C=('#f4cb5e', '#e0a626', '#bd8718'), F=('#d885b0', '#b4508a', '#923c6e')),
    'seaglass': dict(land='#edf3f0', road='#ffffff', edge='#dfe9e4', context=('#dce8e3', '#d0dfd9', '#c6d7d0'), sphere='#cfdcd6',
                     L=('#78a7d6', '#4479b4', '#345f93'), V=('#5fc2b2', '#2a9a8a', '#1f7b6e'), C=('#9ccb7a', '#6aa548', '#528638'), F=('#7c88c9', '#4c5aa6', '#3b4787')),
    'vivid': dict(land='#f4f1eb', road='#ffffff', edge='#e8e5de', context=('#e4e2dd', '#dad8d2', '#d1cec8'), sphere='#d6d3cd',
                  L=('#6e9bff', '#3566e0', '#264fb8'), V=('#4fd3a0', '#18a871', '#0f8659'), C=('#ffa552', '#f07c1a', '#c9620e'), F=('#ff7fae', '#e84882', '#bf2f66')),
}

RAW_CONTEXT = {'#dcd8cf': 0, '#c3bdb0': 1, '#a9a294': 2}
RAW_VENUE = {'#dcb271': ('C', 0), '#b07a2a': ('C', 1), '#80561a': ('C', 2), '#6f9cc2': ('L', 0), '#2f6592': ('L', 1), '#1f4a70': ('L', 2),
             '#5fb0a4': ('V', 0), '#1c7d74': ('V', 1), '#135a54': ('V', 2), '#9d8dc8': ('F', 0), '#63509a': ('F', 1), '#443671': ('F', 2)}
RAW_EDGE = '#d9d3c6'
MIN_ROAD = 9.4                         # edge width of the narrowest street class that is kept
ROAD_SCALE = 1.25

DEFS = (
    '<defs>'
    # wobble the outlines, soften them, and let the paper grain show through the paint
    '<filter id="paint" x="-3%" y="-3%" width="106%" height="106%">'
    '<feTurbulence type="fractalNoise" baseFrequency=".014" numOctaves="3" seed="7" result="n"/>'
    '<feDisplacementMap in="SourceGraphic" in2="n" scale="11" xChannelSelector="R" yChannelSelector="G" result="d"/>'
    '<feGaussianBlur in="d" stdDeviation=".55" result="b"/>'
    '<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2" result="g"/>'
    '<feColorMatrix in="g" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -.4 1.1" result="grain"/>'
    '<feComposite in="b" in2="grain" operator="in"/></filter>'
    '</defs>'
)


def paint_strip(raw, pal, plain=False):
    """plain=False: the watercolour picture. plain=True: crisp edges, every street, no filter."""
    x0, y0, w, h = DETAIL_VIEW if plain else VIEW
    min_road, road_scale = (0, 1) if plain else (MIN_ROAD, ROAD_SCALE)
    shapes, roads, key, run = [], [], None, []

    def flush():
        nonlocal key, run
        if run:
            roof = plain and key in (pal['L'][0], pal['V'][0], pal['C'][0], pal['F'][0])
            shapes.append('<path d="%s" fill="%s"%s/>' % (''.join(run), key, ' stroke="#fff" stroke-width=".8"' if roof else ''))
        key, run = None, []

    def points(text, digits, margin):
        pts = [tuple(map(float, p.split(','))) for p in text.split()]
        if not any(x0 - margin <= x <= x0 + w + margin and y0 - margin <= y <= y0 + h + margin for x, y in pts):
            return None
        fmt = '%d' if digits == 0 else '%.1f'
        return [(fmt % round(x, digits), fmt % round(y, digits)) for x, y in pts]

    body = raw[raw.index('<polyline'):]
    for m in re.finditer(r'<(polyline|polygon|circle)\b[^>]*?/>', body):
        tag, el = m.group(1), m.group(0)
        if tag == 'polyline':
            stroke = re.search(r'stroke="([^"]*)"', el).group(1)
            width = float(re.search(r'stroke-width="([^"]*)"', el).group(1))
            is_edge = stroke == RAW_EDGE
            if (width if is_edge else width + 5) < min_road:
                continue
            pts = points(re.search(r'points="([^"]*)"', el).group(1), 1, 200)
            if pts:
                roads.append('<polyline points="%s" stroke="%s" stroke-width="%.1f"/>' % (
                    ' '.join(','.join(p) for p in pts), pal['edge'] if is_edge else pal['road'], width * road_scale))
        elif tag == 'polygon':
            fill = re.search(r'fill="([^"]*)"', el).group(1)
            if fill in RAW_CONTEXT:
                colour, digits = pal['context'][RAW_CONTEXT[fill]], 0
            elif fill in RAW_VENUE:
                campus, face = RAW_VENUE[fill]
                colour, digits = pal[campus][face], 1
            else:
                continue
            pts = points(re.search(r'points="([^"]*)"', el).group(1), digits, 40)
            if not pts:
                continue
            if colour != key:
                flush()
                key = colour
            run.append('M' + 'L'.join(' '.join(p) for p in pts) + 'Z')
        elif 'sphereFill' in el:
            flush()
            cx, cy, r = (re.search(r'\b%s="([^"]*)"' % a, el).group(1) for a in ('cx', 'cy', 'r'))
            shapes.append('<circle cx="%s" cy="%s" r="%s" fill="%s"/>' % (cx, cy, r, pal['sphere']))
    flush()
    inner = ('<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>' % (x0 - 80, y0 - 80, w + 160, h + 160, pal['land'])   # wider than the view: the filter wobbles its edge
             + '<g fill="none" stroke-linejoin="round" stroke-linecap="round">' + ''.join(roads) + '</g>' + ''.join(shapes))
    head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%d %d %d %d" role="img">%s' % (x0, y0, w, h, MARK)
    return head + inner + '</svg>' if plain else head + DEFS + '<g filter="url(#paint)">' + inner + '</g></svg>'

EN = {
    '전시장 안 — 홀과 층': 'Inside the venues: halls and levels',
    '분야별로 모이는 홀과 층입니다. 왼쪽 쪽의 같은 색 건물을 확대했습니다.': 'Halls and levels by product category.',
    'LVCC 캠퍼스': 'LVCC campus',
    'West Hall은 Paradise Rd 서쪽, 나머지 세 홀은 동쪽입니다.': 'West Hall is west of Paradise Rd; the other three halls are east of it.',
    '차량 기술 · 첨단 모빌리티': 'Vehicle tech · Advanced mobility',
    '엔터프라이즈 · AI': 'Enterprise · AI',
    '지속가능성 · 에너지': 'Sustainability · Energy',
    '스마트시티 · IoT': 'Smart cities · IoT',
    'IoT 인프라': 'IoT infrastructure',
    '마이크로모빌리티': 'Micromobility',
    '게임': 'Gaming',
    '오디오 · 비디오': 'Audio · Video',
    '액세서리': 'Accessories',
    '디자인 · 소싱': 'Design · Sourcing',
    '야외 전시 · CP100–CP999': 'Outdoor exhibits · CP100–CP999',
    '숫자는 부스 번호 범위': 'Numbers are booth ranges',
    'CES 2026 기준 · 2027 배치는 12월 앱에서 다시 확인 · 건물 외곽선 © OpenStreetMap 기여자': 'Based on CES 2026 · Check the CES app in December for the 2027 layout · Building outlines © OpenStreetMap contributors',
    '같은 건물의 두 층입니다. 층 사이는 에스컬레이터로 오갑니다.': 'Two levels of one building, linked by escalators.',
    '2층': 'Level 2',
    '1층': 'Level 1',
    '국가관 · 스마트홈 · 라이프스타일': 'Country pavilions · Smart home · Lifestyle',
    '디지털 헬스 · 스포츠·피트니스 · 푸드테크': 'Digital health · Sports and fitness · Food tech',
    '혁신상 전시(Innovation Awards Showcase) · 50043번 부스': 'Innovation Awards Showcase · Booth 50043',
    'Eureka Park — 스타트업 전시관': 'Eureka Park: startups',
    '출처 · CES 2026 공식 LVCC · Venetian Campus 지도(2025-11-10) · 2027 배치는 12월 앱에서 다시 확인': 'Source: official CES 2026 LVCC and Venetian campus maps (2025-11-10) · Check the CES app in December for 2027',
    '건물 외곽선 © OpenStreetMap 기여자 · Central Plaza 범위는 대략적인 표시': 'Building outlines © OpenStreetMap contributors · Central Plaza extent is approximate',
}


def translate_plan(src):
    out = re.sub(r'(<text\b[^>]*>)([^<]*)</text>', lambda m: m.group(1) + EN.get(m.group(2), m.group(2)) + '</text>', src)
    left = sorted(set(t for t in re.findall(r'<text\b[^>]*>([^<]*)</text>', out) if re.search('[가-힣]', t)))
    assert not left, 'untranslated labels: %r' % left
    out = out.replace('font-family:"Noto Sans KR","Apple SD Gothic Neo",sans-serif',
                      'font-family:"Pretendard Variable",Pretendard,-apple-system,"Helvetica Neue",Arial,sans-serif')
    return out.replace('>', '>' + MARK, 1)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    name = sys.argv[sys.argv.index('--palette') + 1] if '--palette' in sys.argv else 'clear'
    if args and name in args:
        args.remove(name)
    if args:
        raw = Path(args[0]).read_text(encoding='utf-8')
        assert MARK not in raw and '<text' in raw, 'expected the raw export, not an already painted map'
        for target, plain in (('strip.svg', False), ('strip_detail.svg', True)):
            out = paint_strip(raw, PALETTES[name], plain)
            (MAPS / target).write_text(out, encoding='utf-8')
            print('%-17s %5.0f KB -> %5.0f KB  (%s)' % (target, len(raw.encode()) / 1024, len(out.encode()) / 1024, name))
    else:
        print('strip maps        skipped (pass the raw export to repaint them)')
    for plan in ('lvcc', 'venetian_1f', 'venetian_2f'):
        path = MAPS / (plan + '.svg')
        src = path.read_text(encoding='utf-8')
        if MARK in src:
            print('%-13s already translated' % (plan + '.svg'))
        else:
            path.write_text(translate_plan(src), encoding='utf-8')
            print('%-13s labels translated' % (plan + '.svg'))
