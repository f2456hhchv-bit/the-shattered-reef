import json
prev=json.load(open('prev-data.json'))
gal=json.load(open('gallery-data.json'))
emoji=json.load(open('emoji.json'))
# Real sprites as they draw in game (spritedata.mjs), keyed by name.
SPR={o['name']:o['img'] for o in json.load(open('sprite-data.json'))}
SPR={**SPR, **{k.lower():v for k,v in SPR.items()}}
# Frame-animated toy effects (assets/fx): show the peak frame on a sea tile.
def _fx_tile(file, frame, cell=192, cellH=None):
    import base64, io, os
    from PIL import Image
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'fx', file + '.png')
    if not os.path.exists(src): src = '/home/claude/the-shattered-reef/assets/fx/' + file + '.png'
    ch = cellH or cell
    im = Image.open(src).crop((frame * cell, 0, frame * cell + cell, ch))
    bg = Image.new('RGBA', (cell, cell), (37, 104, 138, 255)); bg.alpha_composite(im, (0, (cell - ch) // 2))
    b = io.BytesIO(); bg.convert('RGB').save(b, 'WEBP', quality=85)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
def _asset_tile(rel, size=160):
    import base64, io
    from PIL import Image
    im = Image.open('/home/claude/the-shattered-reef/assets/' + rel + '.png').convert('RGBA'); im.thumbnail((size - 16, size - 16))
    bg = Image.new('RGBA', (size, size), (37, 104, 138, 255)); bg.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    b = io.BytesIO(); bg.convert('RGB').save(b, 'WEBP', quality=85)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
# Toy art supplied as plain images (batch B): name -> asset path.
ASSET_TOY = {'Cannon Battery': 'towers/cannon', 'Grapeshot Nest': 'towers/grapeshot', 'Chain Mast': 'towers/chain', 'Depth Charge Post': 'towers/depth', 'Fire Brazier': 'towers/flame', 'Lighthouse tower': 'towers/lighthouse', 'Heart of the Reef': 'towers/heart', 'Charm Shrine': 'buildings/shrine', 'Tower Yard': 'buildings/lighthouse', 'Shipyard': 'buildings/shipyard', 'Armory': 'buildings/armory', 'Workshop': 'buildings/workshop', 'Faction Hall': 'buildings/hall', 'Sea-glass gem (1 XP)': 'pickups/gem_small', 'Sea-glass gem (5 XP)': 'pickups/gem_medium', 'Sea-glass gem (25 XP)': 'pickups/gem_large', 'Anchor coin (Salvage)': 'pickups/coin', 'Lodestone (pull all)': 'pickups/lodestone', 'Life ring (repair)': 'pickups/ring', 'Treasure chest': 'pickups/chest'}
FX_TOY = {'Explosion': ('explosion', 4), 'Hit spark': ('hitspark', 0, 160), 'Splash': ('splash', 5), 'Kill burst': ('killburst', 4), 'Muzzle flash': ('muzzle', 4, 192, 152)}
# Style status per asset (2026-10-06): toy = matches the toy-render ships;
# old = painted in the earlier V3 style, needs restyling; code = drawn in code.
TOY_SHIP_LOOKS={'Reef Skimmer','Ironclad Brigand','Rigger','Pirate Cutter','Pirate Brig','The Black Gale','Fire Ship','Mortar Gunboat','Ghost Ship','Drowned Skiff','The Drowned Admiral','Obsidian Galley','Dune Raider','Raider Longboat','Skimmer Raider','Ice Skiff','Drowned Rower','Sand Skiff'}
TOY={"The Kraken's Anchor",'The Frost Leviathan','The Caldera Wyrm','Reef Shark','Gullswarm Harpy','Sea Serpent','Deep Crawler','Frost Narwhal','Ice Golem','Frost Wisp','Siren','Cinder Bat','Magma Golem','Cave Bats','Stalker Eel','Deep Troll','Bayou Gator','Bog Witch','Leech Swarm','Anglerfish','Jelly Bloom','Ink Squid','Bone Vulture','Cave Bat','Ember Imp','Bog Leech','Drift Jelly','Crystal Crab','Shard Crab','Mirror Tortoise','Prism Sprite','Sand Wyrm','The Hollow King','Old Mother Mire','The Deep Mother','The Dunemaw','The Prism Colossus','The Bloodfin Matriarch','Bloodfin Matriarch','Warding Seal','The Black Gale','The Drowned Admiral'}|TOY_SHIP_LOOKS
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
 'Player ships':('high','All 7 hulls are first-pass toy art: rigging, ropes, cannons and plank lines make them busier than the simple standard. Redo as simple 5-view sets (batch S); every enemy ship is recoloured from these, so they follow for free.'),
 'Enemies':('medium','Sharks, jellies, squid, wisps, bats, the narwhal, serpent and troll already pass. The rest have scales, patterns or too many parts: simplify them (batch G). Enemy ships follow the player hulls.'),
 'Bosses':('medium',"Kraken's Anchor, Frost Leviathan and the Warding Seal pass. The other bosses are busy: simplify (batch A)."),
 'Boss effects':('keep','Rings, auras and the ward are animated effects drawn over the sprite. Keep as code.'),
 'Harbour buildings':('high',"The harbour terrain and UI are already in the simple style (2026-10-08), so these busy buildings clash most. Redo all six (batch B), a few big blocks each. The lamp beam, portal, forge glow and banner glow stay code overlays."),
 'Harbour props':('low','Small and animated (blinking buoys, foam). Fine as code.'),
 'Landmarks':('medium','Set pieces on arena islands and the chart. Toy FRONT-view versions, batch F.'),
 'Reef Defence':('keep','The six towers are busy (props, planks, crates): simplify (batch T). The Heart is close; low. Level pips and rings stay code.'),
 'Terrain (biome islands)':('keep','Generated from each level\'s shape, so it can\'t be swapped for painted tiles. Its look changes through colours and textures in code.'),
 'Terrain in play (arena view)':('keep','Same renderer, as seen in play.'),
 'Island decorations':('keep','Baked into the terrain at a few pixels across. Painted versions wouldn\'t be visible.'),
 'Weather objects':('low','Animated shapes; fine as code.'),
 'Weather effects (in play)':('medium','The rain, snow, ash and cloud overlays are plain code streaks and dots. The Weather V2 sheet\'s painted textures can replace them (code work; art already supplied).'),
 'Effects':(None,'Already simple. Explosions, splashes and smoke are the effects you see most in combat. The explosion, splash, kill burst and muzzle flash are 12-frame toy animations; the hit spark is a single toy image that pops in and fades (all done 2026-10-08).'),
 'Player shots':('keep','Tiny, fast and animated. Keep as code.'),
 'Enemy shots':('keep','Tiny, fast and animated. Keep as code.'),
 'In-world HUD':('keep','Readability elements: they must stay crisp at any zoom. Keep as code.'),
 'Ambient life':('low','Gulls drawn as two strokes. A small painted, flapping gull would be a nice touch, not a need.'),
 'Pickups':('done','Already simple: chunky single objects, flat colours. Keep.'),
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
# Review against the simple-toy standard (2026-10-08, harbour mockup).
# 'simple' = already passes; 'toy' = first toy pass, too busy, simplify.
SIMPLE={'Sea-glass gem (1 XP)','Sea-glass gem (5 XP)','Sea-glass gem (25 XP)','Anchor coin (Salvage)','Lodestone (pull all)','Life ring (repair)','Treasure chest',
 'Explosion','Hit spark','Splash','Kill burst','Muzzle flash',
 'Jelly Bloom','Drift Jelly','Ink Squid','Frost Narwhal','Reef Shark','Frost Wisp','Cinder Bat','Cave Bat','Warding Seal',"The Kraken's Anchor",'The Frost Leviathan','Sea Serpent','Deep Troll'}
SIMPLIFY_LOW={'Siren','Heart of the Reef','Bone Vulture','Prism Sprite'}
TOY_PRI={'Player ships':'high','Harbour buildings':'high','Bosses':'medium','Enemies':'medium','Reef Defence':'medium'}
for o in items:
    pr=CAT.get(o['cat'],(None,''))[0]
    n=o['name']
    if n in FX_TOY: o['style']='toy'; o['img']=_fx_tile(*FX_TOY[n])
    elif n in ASSET_TOY: o['style']='toy'; o['img']=_asset_tile(ASSET_TOY[n])
    elif o['cat']=='Player ships' or n in TOY: o['style']='toy'
    elif o['status']=='fallback': o['style']='old'
    else: o['style']='code'
    if n in SPR and n not in ASSET_TOY and o['cat'] in ('Player ships','Enemies','Bosses','Harbour buildings'): o['img']=SPR[n]
    if o['style']=='toy' and n in SIMPLE: o['style']='simple'; o['pri']='done'
    elif o['style']=='toy':
        if n in TOY_SHIP_LOOKS and o['cat']!='Bosses': o['pri']='low'  # follows the player hull art once redone
        elif n in SIMPLIFY_LOW: o['pri']='low'
        else: o['pri']=TOY_PRI.get(o['cat'],'medium')
    elif o['cat']=='Enemies' and o['style']=='old': o['pri']='high' if n in EARLY else 'medium'
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
print(Counter(o['style'] for o in items if o['cat'] in ('Player ships','Enemies','Bosses','Harbour buildings')))
print(cnt, len(items))
tpl=open('inv_template.html').read()
def _std_img():
    import base64, io
    from PIL import Image
    im = Image.open('/home/claude/the-shattered-reef/docs/art-reference/toy-simple/harbour-mockup.png').convert('RGB'); im.thumbnail((360, 540))
    b = io.BytesIO(); im.save(b, 'WEBP', quality=82)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
html=tpl.replace('__STD_IMG__', _std_img()).replace('__DATA__',json.dumps(items)).replace('__NOTES__',json.dumps(notes)).replace('__TYPES__',json.dumps([[a,b,c] for a,b,c in TYPES])).replace('__EMOJI__',json.dumps(emoji,ensure_ascii=False))
open('art-inventory.html','w').write(html)
print(len(html)//1024,'KB')
