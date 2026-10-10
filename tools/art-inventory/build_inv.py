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
ISLAND_TOY = {'Tropical':'tropical','Cliff':'cliff_cove','Glacial':'glacial','Shipwreck':'shipwreck','Volcanic':'volcanic','Mangrove':'mangrove','Abyssal':'abyss','Bone Sands':'bone_sands','Crystal':'crystal'}
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
 'Player ships':('done','All 7 hulls are simple-toy 5-view sets (2026-10-08). Every enemy ship is recoloured from these, so they match too.'),
 'Enemies':('high','Every creature is redone even simpler to match the ships and buildings (batch G): 2-3 big rounded shapes, 2-3 flat colours. Enemy ships follow the player hulls and are done.'),
 'Bosses':('high',"Every boss is redone even simpler to match the ships and buildings (batch A). The current art stays in play until each replacement arrives."),
 'Boss effects':('low','Animated overlays: restyled in code to toy colours (flat fills, thick rounded outlines). No images needed.'),
 'Harbour buildings':('done',"All six are simple-toy sprites (2026-10-09). The lamp beam, portal, forge glow and banner glow stay code overlays on top."),
 'Harbour props':('low','Redesign as toy props (batch P): jetty, rock cluster, buoy, rowboat. Blinking lights and foam stay code overlays.'),
 'Landmarks':('medium','Set pieces on arena islands and the chart. Toy FRONT-view versions, batch F.'),
 'Reef Defence':('low','The six towers are busy (props, planks, crates): simplify (batch T). The Heart is close; low. Build spot and mine can take toy images too (batch X). Level pips and rings stay code.'),
 'Terrain (biome islands)':('high','Chart islands: 9 of 10 are toy images; Caverns still needed (batch I). Every island image (and any plain <biome>_pad image) is also placed as a sea obstacle in that biome's survival arenas (2026-10-10), so more plain pad outlines per biome add variety. Tropical and Cliff & Cove are side-on while the rest are top-down pads; redo those two as pads to match. The land/shore "tiles" that came back are shaped pads, not seamless textures, so the arena land will be restyled in code using their colours and soft bumps instead.'),
 'Terrain in play (arena view)':('high','Ground texture from one SWATCH image per biome (batch J), sampled as a repeating pattern; coastline, rounded beach rim and flat toy water stay code-drawn because they follow the generated map. Props from batch P on top.'),
 'Island decorations':('medium','Redesign as chunky toy props (batch P), stamped bigger than now so they read, like the harbour bushes. One set per biome.'),
 'Weather objects':('low','Can take toy images (batch W): floes, wreckage, rocks, ghost lights. Spinning whirlpools and spouts stay code-animated over a toy base.'),
 'Weather effects (in play)':('medium','The rain, snow, ash and cloud overlays are plain code streaks and dots. The Weather V2 sheet\'s painted textures can replace them (code work; art already supplied).'),
 'Effects':(None,'Already simple. Explosions, splashes and smoke are the effects you see most in combat. The explosion, splash, kill burst and muzzle flash are 12-frame toy animations; the hit spark is a single toy image that pops in and fades (all done 2026-10-08).'),
 'Player shots':('low','Can take small toy images (batch X); trails, spin and glow stay code.'),
 'Enemy shots':('low','Can take small toy images (batch X); trails and telegraph rings stay code.'),
 'In-world HUD':('low','Must stay crisp, so restyled in code to toy colours rather than swapped for images.'),
 'Ambient life':('low','Gulls drawn as two strokes. A toy gull (batch P) would be a nice touch.'),
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
 'Charm Shrine','Tower Yard','Shipyard','Armory','Workshop','Faction Hall'}
# 2026-10-09: owner judged every creature and boss too detailed next to the simple ships/buildings: all redo.
SIMPLIFY_LOW={'Heart of the Reef'}
TOY_PRI={'Player ships':'high','Harbour buildings':'high','Bosses':'high','Enemies':'high','Reef Defence':'medium'}
for o in items:
    pr=CAT.get(o['cat'],(None,''))[0]
    n=o['name']
    if n in FX_TOY: o['style']='toy'; o['img']=_fx_tile(*FX_TOY[n])
    elif n in ASSET_TOY: o['style']='toy'; o['img']=_asset_tile(ASSET_TOY[n])
    elif o['cat']=='Player ships' or n in TOY: o['style']='toy'
    elif o['status']=='fallback': o['style']='old'
    else: o['style']='code'
    if n in SPR and n not in ASSET_TOY and o['cat'] in ('Player ships','Enemies','Bosses','Harbour buildings'): o['img']=SPR[n]
    if o['style']=='toy' and (n in SIMPLE or o['cat']=='Player ships' or (n in TOY_SHIP_LOOKS and o['cat']!='Bosses')): o['style']='simple'; o['pri']='done'
    elif o['style']=='toy':
        if n in TOY_SHIP_LOOKS and o['cat']!='Bosses': o['pri']='low'  # follows the player hull art once redone
        elif n in SIMPLIFY_LOW: o['pri']='low'
        else: o['pri']=TOY_PRI.get(o['cat'],'medium')
    elif o['cat']=='Enemies' and o['style']=='old': o['pri']='high' if n in EARLY else 'medium'
    elif o['cat']=='Effects': o['pri']=FX.get(o['name'],'low')
    else: o['pri']=pr or 'keep'
    if o['cat']=='Terrain (biome islands)':
        for pre,bid in ISLAND_TOY.items():
            if o['name'].startswith(pre): o['style']='simple'; o['pri']='done'; o['img']=_asset_tile('islands/'+bid)
    o.pop('status',None)
order={c:i for i,(_,_,cs) in enumerate(TYPES) for c in cs}
items.sort(key=lambda o:(order.get(o['cat'],99), [c for t in TYPES for c in t[2]].index(o['cat']) if o['cat'] in order else 0))
notes={k:v[1] for k,v in CAT.items()}
FILEN={'main':'harbour and HUD','survival':'level-up cards','tdMode':'Reef Defence','towerYard':'Tower Yard','progression':'achievements','worldMap':'voyage chart','upgrades':'upgrade cards','armaments':'armament cards','towers':'tower list','weather':'weather chip','tdArt':'Reef Defence map','meta':'shops','stages':'stage list','introScene':'intro','base':'harbour'}
for e in emoji: e['where']=sorted({FILEN.get(f,f) for f in e['files']})
# Emoji that now draw as toy icons (src/ui/emojiIcons.mjs). Canvas-only emoji stay as glyphs.
import re as _re, base64 as _b64, io as _io
from PIL import Image as _Im
_ICON_SRC=open('/home/claude/the-shattered-reef/src/ui/emojiIcons.mjs').read()
_MAP=dict(_re.findall(r"'([^']+)': '([^']+)'", _ICON_SRC.split('EMOJI_ICONS = {')[1].split('};')[0]))
_STANDIN={'⚔':'cutlass (wants crossed swords)','🔧':'gear (wants a wrench)','⚫':'cannon (wants cannonballs)','✈':'wing','⛓':'chain link'}
_CANVAS={'♪','♫','🪶','🐂'}
for e in emoji:
    k=e['e'].replace('\ufe0f','')
    if k in _MAP:
        im=_Im.open('/home/claude/the-shattered-reef/assets/icons/ui/'+_MAP[k]+'.png').convert('RGBA'); im.thumbnail((56,56))
        b=_io.BytesIO(); im.save(b,'PNG',optimize=True); e['img']='data:image/png;base64,'+_b64.b64encode(b.getvalue()).decode()
        e['state']='standin' if k in _STANDIN else 'done'
        if k in _STANDIN: e['note']='Stand-in: '+_STANDIN[k]
    elif k in ('★','☆','❚'): e['state']='keep'; e['note']='Text glyph, kept (rating stars / pause bars)'
    else: e['state']='need'; e['note']='Canvas mark' if k in _CANVAS else ''
_rk={'need':0,'standin':1,'keep':2,'done':3}
emoji.sort(key=lambda e:(_rk[e['state']],-e['n']))
from collections import Counter
cnt=Counter(o['pri'] for o in items)
cnt['high']+=sum(e['state']!='done' and e['state']!='keep' for e in emoji)
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
