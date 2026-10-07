import json
prev=json.load(open('prev-data.json'))
gal=json.load(open('gallery-data.json'))
emoji=json.load(open('emoji.json'))
# Real sprites as they draw in game (spritedata.mjs), keyed by name.
SPR={o['name']:o['img'] for o in json.load(open('sprite-data.json'))}
SPR={**SPR, **{k.lower():v for k,v in SPR.items()}}
# Style status per asset (2026-10-06): toy = matches the toy-render ships;
# old = painted in the earlier V3 style, needs restyling; code = drawn in code.
TOY_SHIP_LOOKS={'Reef Skimmer','Ironclad Brigand','Rigger','Pirate Cutter','Pirate Brig','The Black Gale','Fire Ship','Mortar Gunboat','Ghost Ship','Drowned Skiff','The Drowned Admiral','Obsidian Galley','Dune Raider','Raider Longboat','Skimmer Raider','Ice Skiff','Drowned Rower','Sand Skiff'}
TOY={"The Kraken's Anchor",'The Frost Leviathan','The Caldera Wyrm','Reef Shark','Gullswarm Harpy','Sea Serpent','Deep Crawler','Frost Narwhal','Ice Golem','Frost Wisp','Siren','Cinder Bat','Magma Golem','Cave Bats','Stalker Eel','Deep Troll','Bayou Gator','Bog Witch','Leech Swarm','Anglerfish','Jelly Bloom','Ink Squid','Bone Vulture','Cave Bat','Ember Imp','Bog Leech','Drift Jelly','Crystal Crab','Shard Crab','Mirror Tortoise','Prism Sprite','Sand Wyrm','The Hollow King'}|TOY_SHIP_LOOKS
EARLY={'Reef Shark','Gullswarm Harpy','Sea Serpent','Deep Crawler','Frost Narwhal','Ice Golem','Frost Wisp','Siren'}
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
 'Player ships':('done','All 7 hulls are toy-style 5-view sets (bow, bow-quarter, side, stern-quarter, stern), mirrored to 16 headings. This is the style every other asset must match.'),
 'Enemies':('medium','Enemy ships are the toy hulls recoloured, so they already match. The creatures are the older painted pack: right shapes, wrong finish (textured, detailed, painterly). Stage 2-4 creatures are seen first, so they go first.'),
 'Bosses':('high','Three bosses are toy style. Five are still code shapes and Bloodfin is old painted art, and a boss fills the screen on every level 5. Black Gale and Drowned Admiral are recoloured toy hulls: they match, but bespoke art would make them feel like bosses.'),
 'Boss effects':('keep','Rings, auras and the ward are animated effects drawn over the sprite. Keep as code.'),
 'Harbour buildings':('high','First screen anyone sees, and none of the six match the ships: Shipyard, Tower Yard and Charm Shrine are older painted art, the other three are code. Do all six together so the harbour reads as one set.'),
 'Harbour props':('low','Small and animated (blinking buoys, foam). Fine as code.'),
 'Landmarks':('medium','Set pieces on arena islands and the chart. Toy FRONT-view versions, batch F.'),
 'Reef Defence':('medium','Towers are seen up close in Reef Defence. One toy FRONT-view image per tower (batch B); levels and specialisations can stay code overlays.'),
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
 'Pickups':('medium','Sea glass and coins are on screen constantly in survival. Toy versions (batch C) keep the code bob and glow on top.'),
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
    n=o['name']
    if o['cat']=='Player ships' or n in TOY: o['style']='toy'
    elif o['status']=='fallback': o['style']='old'
    else: o['style']='code'
    if n in SPR and o['cat'] in ('Player ships','Enemies','Bosses','Harbour buildings'): o['img']=SPR[n]
    if o['style']=='toy': o['pri']='low' if n in ('The Black Gale','The Drowned Admiral') else 'done'
    elif o['cat']=='Enemies' and o['style']=='old': o['pri']='high' if n in EARLY else 'medium'
    elif o['cat']=='Effects': o['pri']=FX.get(o['name'],'keep')
    elif o['cat']=='Harbour buildings': o['pri']='high'
    else: o['pri']=pr or 'keep'
    if n=='Warding Seal': o['pri']='high'
    o.pop('status',None)
order={c:i for i,(_,_,cs) in enumerate(TYPES) for c in cs}
items.sort(key=lambda o:(order.get(o['cat'],99), [c for t in TYPES for c in t[2]].index(o['cat']) if o['cat'] in order else 0))
notes={k:v[1] for k,v in CAT.items()}
FILEN={'main':'harbour and HUD','survival':'level-up cards','tdMode':'Reef Defence','towerYard':'Tower Yard','progression':'achievements','worldMap':'voyage chart','upgrades':'upgrade cards','armaments':'armament cards','towers':'tower list','weather':'weather chip','tdArt':'Reef Defence map','meta':'shops','stages':'stage list','introScene':'intro','base':'harbour'}
for e in emoji: e['where']=sorted({FILEN.get(f,f) for f in e['files']})
from collections import Counter
cnt=Counter(o['pri'] for o in items)
cnt['high']+=len(emoji)
print(Counter(o['style'] for o in items if o['cat'] in ('Player ships','Enemies','Bosses','Harbour buildings')))
print(cnt, len(items))
tpl=open('inv_template.html').read()
html=tpl.replace('__DATA__',json.dumps(items)).replace('__NOTES__',json.dumps(notes)).replace('__TYPES__',json.dumps([[a,b,c] for a,b,c in TYPES])).replace('__EMOJI__',json.dumps(emoji,ensure_ascii=False))
open('art-inventory.html','w').write(html)
print(len(html)//1024,'KB')
