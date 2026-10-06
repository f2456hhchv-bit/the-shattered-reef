"""Cut a 5-view ship image (bow, bow-quarter, side with bow LEFT,
stern-quarter, stern; transparent background) into a 9-frame atlas for
engine/shipSprites.mjs, and patch that hull's frame table in place.

  python3 tools/cut-ship-views.py <hull> <image.png>
"""
import sys, re, json
from PIL import Image
import numpy as np
from scipy import ndimage

hull, path = sys.argv[1], sys.argv[2]
src = np.array(Image.open(path).convert('RGBA'))
r, g, b, A = [src[..., i].astype(int) for i in range(4)]
# Keying fringe: saturated red/yellow specks outside the solid body.
core = ndimage.binary_erosion(A > 240, iterations=2)
fringe = (~core) & (A < 250) & (((r > 170) & (g < 80) & (b < 80)) | ((r > 200) & (g > 190) & (b < 70)))
src[..., 3] = np.where(fringe | (A < 24), 0, A)
m = src[..., 3] > 128
l, k = ndimage.label(ndimage.binary_dilation(m, iterations=8))
sz = ndimage.sum(m, l, range(1, k + 1))
objs = sorted([i + 1 for i in range(k) if sz[i] > 0.2 * sz.max()], key=lambda i: ndimage.find_objects(l)[i - 1][1].start)
assert len(objs) == 5, f'expected 5 views, found {len(objs)}'
sl = ndimage.find_objects(l)
views = []
for i in objs:
    ys, xs = sl[i - 1]
    a = src[ys, xs].copy()
    al = np.where(l[ys, xs] == i, a[..., 3], 0)
    kk, kn = ndimage.label(al > 0)
    if kn > 1:
        s2 = ndimage.sum(al > 0, kk, range(1, kn + 1))
        al[~np.isin(kk, [j + 1 for j in range(kn) if s2[j] >= 0.02 * s2.max()])] = 0
    a[..., 3] = al
    yy, xx = np.nonzero(al > 20)
    views.append(a[yy.min():yy.max() + 1, xx.min():xx.max() + 1])
S = 90 / max(v.shape[0] for v in views)
small = [np.array(Image.fromarray(v).resize((max(1, round(v.shape[1] * S)), max(1, round(v.shape[0] * S))), Image.LANCZOS)) for v in views]
order = [0, 0, 1, 1, 2, 3, 3, 4, 4]  # 9 headings S -> W -> N, 22.5 deg apart
pad = 2
frames = [small[i] for i in order]
W = sum(f.shape[1] + pad * 2 for f in frames); H = max(f.shape[0] for f in frames) + pad * 2
atlas = np.zeros((H, W, 4), np.uint8); x = 0; fm = []
for f in frames:
    h, w = f.shape[:2]
    atlas[pad:pad + h, x + pad:x + pad + w] = f
    al = f[..., 3] > 80; low = int(h * 0.6); yy, xx = np.nonzero(al[low:])
    fm.append([x + pad, pad, w, h, round(float(xx.mean()), 1), round(float(yy.mean() + low), 1)])
    x += w + pad * 2
Image.fromarray(atlas).save(f'assets/ships/{hull}.png', optimize=True)
p = 'src/engine/shipSprites.mjs'; s = open(p).read()
body = f"  {hull}: [\n" + "".join(f"    [{', '.join(str(v) for v in f)}],\n" for f in fm) + "  ],"
pat = rf"  {hull}: \[\n(?:    \[.*\],\n)+  \],"
assert re.search(pat, s), 'frame table not found'
s2 = re.sub(pat, body, s, count=1)
open(p, 'w').write(s2)
print(hull, json.dumps(fm))
