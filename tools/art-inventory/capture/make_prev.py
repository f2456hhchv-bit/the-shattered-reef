# Builds inv/prev-data.json (terrain in play, weather in play, UI) from the review captures.
import json, base64, io, os
from PIL import Image
import sys
# usage: python3 make_prev.py <captures dir> <inventory work dir>
#   captures dir holds shots-ui/, shots-game/ (terrain-N.png) and shots-weather/
R = sys.argv[1].rstrip('/') + '/'
INV = sys.argv[2].rstrip('/') + '/'
old = json.load(open(INV + 'prev-data.json'))
terrain_names = [o['name'] for o in old if o['cat'] == 'Terrain in play (arena view)']
def enc(path, kind):
    im = Image.open(path).convert('RGB')
    if kind == 'screen': im = im.resize((360, round(im.height * 360 / im.width)), Image.LANCZOS)
    elif kind == 'sq': im = im.resize((480, 480), Image.LANCZOS)
    elif im.width > 560: im = im.resize((560, round(im.height * 560 / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'WEBP', quality=80)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
out = []
for i, n in enumerate(terrain_names):
    out.append({'cat': 'Terrain in play (arena view)', 'name': n, 'img': enc(R + f'shots-game/terrain-{i + 1}.png', 'sq'), 'pri': 'low'})
for m in json.load(open(R + 'shots-weather/manifest.json')):
    out.append({'cat': m['cat'], 'name': m['name'], 'img': enc(R + 'shots-weather/' + m['file'] + '.png', 'sq'), 'pri': 'low'})
SKIP = {'Opening scene (early)', 'Opening scene (late)'}
seen = set()
for m in json.load(open(R + 'shots-ui/manifest.json')):
    if not m['cat'].startswith('UI · ') or m['name'] in SKIP or (m['cat'], m['name']) in seen: continue
    seen.add((m['cat'], m['name']))
    out.append({'cat': m['cat'], 'name': m['name'], 'img': enc(R + 'shots-ui/' + m['file'] + '.png', m['kind']), 'pri': 'low'})
# keep every old item we did not recapture (other categories), so nothing silently drops
have = {(o['cat'], o['name']) for o in out}
missing = [(o['cat'], o['name']) for o in old if (o['cat'].startswith('UI · ') or o['cat'] in ('Terrain in play (arena view)', 'Weather effects (in play)')) and (o['cat'], o['name']) not in have]
print('not recaptured:', missing)
json.dump(out + [o for o in old if not (o['cat'].startswith('UI · ') or o['cat'] in ('Terrain in play (arena view)', 'Weather effects (in play)'))], open(INV + 'prev-data.json', 'w'))
print(len(out), 'captured items;', sum(len(o['img']) for o in out) // 1024, 'KB')
