import json
prev=json.load(open('prev-data.json'))
gal=json.load(open('gallery-data.json'))
emoji=json.load(open('emoji.json'))
for o in gal:
    if o['cat']=='Weather': o['cat']='Weather objects'
extra=[o for o in prev if o['cat'] in ('Terrain in play (arena view)','Weather effects (in play)') or o['cat'].startswith('UI · ')]
for o in extra: o['status']='code'
items=gal+extra
TYPES=[
 ('ships','Ships',['Player ships']),
 ('creatures','Creatures & enemies',['Enemies']),
 ('bosses','Bosses',['Bosses','Boss effects']),
 ('buildings','Buildings & landmarks',['Harbour buildings','Harbour props','Landmarks','Reef Defence']),
 ('terrain','Terrain',['Terrain (biome islands)','Terrain in play (arena view)','Island decorations']),
 ('weather','Weather',['Weather objects','Weather effects (in play)']),
 ('effects','Effects & shots',['Effects','Player shots','Enemy shots','In-world HUD','Ambient life']),
 ('pickups','Pickups',['Pickups']),
 ('icons','Icons',[]),
 ('ui','UI',['UI · Screens','UI · Harbour HUD','UI · Voyage card','UI · Building panels','UI · Panel parts','UI · Chart parts','UI · In-play HUD','UI · Cards','UI · Menus','UI · Reef Defence UI']),
 ('fonts','Fonts',[]),
 ('sound','Sound',[]),
]
CAT={
 'Player ships':('done','All 7 hulls are painted sprites now. Code art only shows while images load.'),
 'Enemies':('medium','Every regular enemy is a painted ship or creature sprite except the Warding Seal.'),
 'Bosses':('high','Biggest visible gap: 8 bosses are still code shapes next to painted creatures. One top-down image each, plus a second image for bosses that change form.'),
 'Boss effects':('keep','Rings, auras and the ward are animated effects drawn over the sprite. Keep as code.'),
 'Harbour buildings':('high','First thing anyone sees. Shipyard, Tower Yard and Charm Shrine are painted; the other three look flat beside them.'),
 'Harbour props':('low','Small and animated (blinking buoys, foam). Fine as code.'),
 'Landmarks':('medium','Set pieces on arena islands and the chart. Painted 3/4-view versions would match the buildings.'),
 'Reef Defence':('medium','Towers are seen up close in Reef Defence. Painted 3/4-view towers, one per level and specialisation, would lift that mode.'),
 'Terrain (biome islands)':('keep','Generated from each level\'s shape, so it can\'t be swapped for painted tiles. Its look changes through colours and textures in code.'),
 'Terrain in play (arena view)':('keep','Same renderer, as seen in play.'),
 'Island decorations':('keep','Baked into the terrain at a few pixels across. Painted versions wouldn\'t be visible.'),
 'Weather objects':('low','Animated shapes; fine as code.'),
 'Weather effects (in play)':('medium','The rain, snow, ash and cloud overlays are plain code streaks and dots. The Weather V2 sheet\'s painted textures can replace them (code work; art already supplied).'),
 'Effects':(None,'Explosions, splashes and smoke are the effects you see most in combat. Painted sprite sheets for those would lift the feel of every fight; the rest are fine as code.'),
 'Player shots':('keep','Tiny, fast and animated. Keep as code.'),
 'Enemy shots':('keep','Tiny, fast and animated. Keep as code.'),
 'In-world HUD':('keep','Readability elements: they must stay crisp at any zoom. Keep as code.'),
 'Ambient life':('low','Gulls drawn as two strokes. A small painted, flapping gull would be a nice touch, not a need.'),
 'Pickups':('low','Bobbing and glowing in code. Painted gem and coin icons would help if they look plain next to the ships.'),
 'UI · Screens':('medium','UI is built from CSS, so it\'s restyled in code, not swapped for images. A pass against the V3 UI style guide ties it to the new art.'),
 'UI · Harbour HUD':('medium','Restyle in code against the V3 UI guide; the icons inside are emoji (see Icons).'),
 'UI · Voyage card':('medium','Restyle in code against the V3 UI guide.'),
 'UI · Building panels':('medium','The shop lists are the plainest screens in the game.'),
 'UI · Panel parts':('medium','Restyle in code against the V3 UI guide.'),
 'UI · Chart parts':('low','Already closest to the target look.'),
 'UI · In-play HUD':('medium','Restyle in code; painted icons for the dock and strip would help most.'),
 'UI · Cards':('medium','Level-up cards are seen dozens of times per level; worth a polish pass.'),
 'UI · Menus':('medium','Restyle in code against the V3 UI guide.'),
 'UI · Reef Defence UI':('medium','Restyle in code against the V3 UI guide.'),
}
FX={'Explosion':'medium','Splash':'medium','Kill burst':'low','Hit spark':'low','Muzzle flash':'low'}
for o in items:
    pr=CAT.get(o['cat'],(None,''))[0]
    if o['status']!='code': o['pri']='done'
    elif o['cat']=='Effects': o['pri']=FX.get(o['name'],'keep')
    else: o['pri']=pr or 'keep'
    o.pop('status',None)
order={c:i for i,(_,_,cs) in enumerate(TYPES) for c in cs}
items.sort(key=lambda o:(order.get(o['cat'],99), [c for t in TYPES for c in t[2]].index(o['cat']) if o['cat'] in order else 0))
notes={k:v[1] for k,v in CAT.items()}
FILEN={'main':'harbour and HUD','survival':'level-up cards','tdMode':'Reef Defence','towerYard':'Tower Yard','progression':'achievements','worldMap':'voyage chart','upgrades':'upgrade cards','armaments':'armament cards','towers':'tower list','weather':'weather chip','tdArt':'Reef Defence map','meta':'shops','stages':'stage list','introScene':'intro','base':'harbour'}
for e in emoji: e['where']=sorted({FILEN.get(f,f) for f in e['files']})
from collections import Counter
cnt=Counter(o['pri'] for o in items)
cnt['high']+=len(emoji)
print(cnt, len(items))
tpl=open('inv_template.html').read()
html=tpl.replace('__DATA__',json.dumps(items)).replace('__NOTES__',json.dumps(notes)).replace('__TYPES__',json.dumps([[a,b,c] for a,b,c in TYPES])).replace('__EMOJI__',json.dumps(emoji,ensure_ascii=False))
open('art-inventory.html','w').write(html)
print(len(html)//1024,'KB')
