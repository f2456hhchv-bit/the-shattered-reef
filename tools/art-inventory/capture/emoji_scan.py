# Emoji used in the game's source, with counts, files and example names.
import re, os, json, glob  # usage: python3 emoji_scan.py  (writes emoji.json here)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'src')
# Emoji, symbols written with the emoji selector, and the plain UI glyphs
# (arrows, pause bars, damage marks) that also need drawn icons.
EMO = re.compile(r'([☀-➿⬀-⯿\U0001F000-\U0001FAFF])|([←-⇿⌀-⏿■-◿])️|([◀▶←↻›▲▼])')
NAME = re.compile(r"name:\s*(['\"])((?:\\.|(?!\1).)*)\1")
out = {}
for f in sorted(glob.glob(ROOT + '/**/*.mjs', recursive=True)):
    base = os.path.basename(f)[:-4]
    if base == 'emojiIcons': continue
    for line in open(f, encoding='utf-8'):
        s = line.strip()
        if s.startswith('//') or s.startswith('*'): continue
        names = [m.group(2) for m in NAME.finditer(line)]
        for m in EMO.finditer(line):
            e = m.group(1) or m.group(2) or m.group(3)
            o = out.setdefault(e, {'e': e, 'n': 0, 'files': set(), 'ctx': []})
            o['n'] += 1; o['files'].add(base)
            for nm in names:
                if nm not in o['ctx'] and len(o['ctx']) < 3: o['ctx'].append(nm)
res = sorted(out.values(), key=lambda o: -o['n'])
for o in res: o['files'] = sorted(o['files'])
json.dump(res, open('emoji.json', 'w'), ensure_ascii=False)
print(len(res), 'emoji;', sum(o['n'] for o in res), 'uses')
