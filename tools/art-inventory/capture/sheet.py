# contact sheet: python3 sheet.py out.png cellW cellH cols file1 [file2 ...]
import sys
from PIL import Image, ImageDraw
out, cw, ch, cols = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]); fs = sys.argv[5:]
rows = (len(fs) + cols - 1) // cols
sh = Image.new('RGB', (cw * cols, (ch + 14) * rows), (30, 30, 36)); d = ImageDraw.Draw(sh)
for i, f in enumerate(fs):
    im = Image.open(f).convert('RGB'); im.thumbnail((cw - 4, ch - 4))
    x, y = (i % cols) * cw, (i // cols) * (ch + 14)
    sh.paste(im, (x + (cw - im.width) // 2, y + 2)); d.text((x + 3, y + ch), f.split('/')[-1][:28], fill='white')
sh.save(out)
