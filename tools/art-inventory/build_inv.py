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
ISLAND_TOY = {'Tropical':'tropical','Cliff':'cliff_cove','Glacial':'glacial','Shipwreck':'shipwreck','Volcanic':'volcanic','Mangrove':'mangrove','Abyssal':'abyss','Bone Sands':'bone_sands','Crystal':'crystal','Sunless':'caverns'}
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
# Every category has a redraw route (2026-10-12, owner: nothing stays code-drawn;
# code only places, stretches, crops, tints, turns, fades and animates the art).
CAT={
 'Player ships':('done','All 7 hulls are simple-toy 5-view sets (2026-10-08). Every enemy ship is recoloured from these, so they match too.'),
 'Enemies':('high','__CREATURES__'),
 'Bosses':('high',"Every boss is redone even simpler to match the ships and buildings (batch A). The current art stays in play until each replacement arrives."),
 'Boss effects':('medium','Drawn in code today. Redrawn as RING overlays (batch M: M7 ward bubble, M8 enrage ring, M9 elite aura) and the warlord crown (U8). Code scales, spins, pulses and fades them.'),
 'Harbour buildings':('done',"All six are simple-toy sprites (2026-10-09). The lamp beam, portal, forge and banner glows are code effects on top; they become glow images with the markers (M)."),
 'Harbour props':('medium','Drawn in code today. Redrawn as toy props (P11): jetty, rock cluster, buoys, rowboat, bush. Code blinks the buoy lights and moves the foam.'),
 'Landmarks':('medium','Set pieces on arena islands and the chart, drawn in code today. Toy FRONT-view versions, batch F.'),
 'Reef Defence':('medium','The six towers are busy (props, planks, crates): simplify (batch T). The Heart is close (low). The build spot and mine are code today (R3, R4). Level pips use the kit pips (K33); the range and build rings are M13 and M14. The maps use the toy terrain and props.'),
 'Terrain (biome islands)':('done','All 10 chart islands are toy images, all top-down (2026-10-11). Every chart island, the 3-5 plain pads per biome and a rock islet in the biome\'s rock colour are placed as sea obstacles in that biome\'s survival arenas. Too many pads are round: batch O2 asks for 30 named outlines.'),
 'Terrain in play (arena view)':('high',"Drawn in code today, in the toy board-piece look. Redrawn as textures (batch L): for each biome a SEAMLESS land top, a SHORE strip (the moulded rim from water to land) and a SEAMLESS water surface, plus Volcanic lava. The level generator still decides where the coast goes; the art decides how it looks. The terrain renderer gets a texture-sampling step when the first set (Tropical) arrives."),
 'Island decorations':('medium','Toy prop images stand on the land in the arenas and on Reef Defence maps for Tropical, Cliff & Cove, Glacial and Shipwreck (2026-10-11). P5-P10 cover the other six biomes, including the boulders, glowing mushrooms, glow coral and ember rocks still drawn in code; the harbour bush is in P11.'),
 'Weather objects':('low','Drawn in code today. Redrawn as toy images (batch W): floe, wreckage, falling rock and ice, ghost light, whirlpool, waterspout. Code drifts, drops and spins them. The lightning mark becomes the danger ring (M2) with a bolt (Q13).'),
 'Weather effects (in play)':('medium',"Code streaks and dots today. Redrawn as PARTICLE sets (batch Q): rain, snow, ash, embers, fog, sand, leaves, spores, bubbles, glints, foam, sparks, plus a bolt, a wind streak and a wave crest. The game copies them hundreds of times and tints, drifts and fades them."),
 'Effects':(None,'The explosion, splash, kill burst and muzzle flash are 12-frame toy animations and the hit spark is a toy image (all done 2026-10-08). Still drawn in code: shockwave rings (M6), the ship wake (Q11 foam), sinking bubbles (Q9), damage numbers (K37, a digit set) and the five status looks on the ship (M11 badges with Q particles).'),
 'Player shots':('medium','Drawn in code today. Toy TOP-DOWN images (batches X and X2); code spins them and draws their trails from the same art.'),
 'Enemy shots':('medium','Drawn in code today. Toy TOP-DOWN images (batches X and X2); the mortar\'s landing ring is M3.'),
 'In-world HUD':('medium','Drawn in code today. The hull bar under the ship is the kit bar (K27, K28), the lock-on reticle M1, the dive and charge telegraphs M3 and M4. Code places, crops and pulses them.'),
 'Ambient life':('low','Gulls are two strokes in code. A toy gull (P12), flapped by code.'),
 'Pickups':('done','Already simple: chunky single objects, flat colours.'),
 'UI · Screens':('high','No single image per screen: each one is built from the UI kit (batch K: frames, buttons, chips, bars, pips, cards), the icons (D, E), the title logo (U1) and the terrain textures (L). Styled in CSS today.'),
 'UI · Harbour HUD':('high','CSS today. Becomes kit pieces: chips and pills K17, the sound button K20 with its icon, the alert dot K26, the captain\'s progress bar K27 + K28.'),
 'UI · Voyage card':('high','CSS today. Becomes kit pieces: the panel K1, the mini-map frame K2, Set Sail K9, Defend the Reef K11, the stage arrows K20 with D16, level pips K33.'),
 'UI · Building panels':('high','CSS today. Becomes kit pieces: the panel K1, shop rows K2, Buy/Select buttons K13 and K16, tabs K18 and K19, back button K20 with D14.'),
 'UI · Panel parts':('high','CSS today. These are the kit itself: K1, K2, K13-K16, K18-K20.'),
 'UI · Chart parts':('medium','CSS and code today. The island names sit on the name plate (K8), the stage sheet is the panel (K1), the sea is the chart texture (K35) and the route uses K36.'),
 'UI · In-play HUD':('high','CSS today. Becomes kit pieces: chips K17, the XP and boss bars K27-K29, wave pips K33, pause K20 with D15, dash K22 with its cooldown ring K23, dock tiles K30-K32, the joystick K24 and K25, the warlord banner K7.'),
 'UI · Cards':('high','CSS today. The level-up card frames are K3-K6 (weapon, armament, ship upgrade, evolution); the words stay text.'),
 'UI · Menus':('high','CSS today. The pause and summary cards are the panel (K1) with the kit buttons (K9-K16).'),
 'UI · Reef Defence UI':('medium','CSS today. The same kit: chips K17, buttons K9-K16, the incoming strip uses dock tiles (K30).'),
}
FX={'Shockwave rings':'medium','Ship wake':'medium','Damage numbers':'medium','Sinking enemy':'low'}
NAME_PRI={'Build spot':'low','Mine':'low'}
# Review against the simple-toy standard (2026-10-08, harbour mockup).
# 'simple' = already passes; 'toy' = first toy pass, too busy, simplify.
SIMPLE={'Sea-glass gem (1 XP)','Sea-glass gem (5 XP)','Sea-glass gem (25 XP)','Anchor coin (Salvage)','Lodestone (pull all)','Life ring (repair)','Treasure chest',
 'Explosion','Hit spark','Splash','Kill burst','Muzzle flash',
 'Charm Shrine','Tower Yard','Shipyard','Armory','Workshop','Faction Hall',
 'Crystal Crab','Shard Crab','Prism Sprite','Sand Wyrm','Mirror Tortoise','Bone Vulture','Drift Jelly','Ink Squid','Bog Leech','Leech Swarm',
 'Anglerfish','Jelly Bloom','Bayou Gator','Bog Witch','Deep Troll','Cave Bat','Cave Bats','Stalker Eel','Ember Imp','Magma Golem',
 'Black Gale','The Black Gale','Drowned Admiral','The Drowned Admiral','Bloodfin Matriarch','The Bloodfin Matriarch',"Kraken's Anchor","The Kraken's Anchor",'Frost Leviathan','The Frost Leviathan','Caldera Wyrm','The Caldera Wyrm','Hollow King','The Hollow King','Old Mother Mire','The Old Mother Mire','Deep Mother','The Deep Mother','Dunemaw','The Dunemaw','Prism Colossus','The Prism Colossus','Warding Seal','The Warding Seal','Gullswarm Harpy','The Gullswarm Harpy','Deep Crawler','The Deep Crawler','Reef Shark','The Reef Shark','Sea Serpent','The Sea Serpent','Frost Narwhal','The Frost Narwhal','Ice Golem'}
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
    else: o['pri']=NAME_PRI.get(n) or pr or 'medium'
    if o['cat']=='Terrain (biome islands)':
        for pre,bid in ISLAND_TOY.items():
            if o['name'].startswith(pre): o['style']='simple'; o['pri']='done'; o['img']=_asset_tile('islands/'+bid)
    o.pop('status',None)
# Sea islands (plain pads + the biome's rock islet) and toy props, from the
# asset folders: every image the arenas use gets a tile (2026-10-11).
import glob as _glob, os as _os, base64 as _b64x, io as _iox
from PIL import Image as _ImX
_A='/home/claude/the-shattered-reef/assets/'
ROCKS={'tropical':'rock_grey','cliff_cove':'rock_grey','glacial':'rock_ice','shipwreck':'rock_grey','volcanic':'rock_black','caverns':'rock_purple','mangrove':'rock_grey','abyss':'rock_navy','bone_sands':'rock_sand','crystal':'rock_lilac'}
def _grid_tile(paths, size=336):
    ims=[_ImX.open(p).convert('RGBA') for p in paths]; n=len(ims); cols=2 if n<=4 else 3; rows=(n+cols-1)//cols
    cw=(size-12)//cols; ch=(size-12)//rows
    bg=_ImX.new('RGBA',(size,size),(37,104,138,255))
    for i,im in enumerate(ims):
        im.thumbnail((cw-6,ch-6)); x=6+(i%cols)*cw+(cw-im.width)//2; y=6+(i//cols)*ch+(ch-im.height)//2; bg.alpha_composite(im,(x,y))
    b=_iox.BytesIO(); bg.convert('RGB').save(b,'WEBP',quality=82); return 'data:image/webp;base64,'+_b64x.b64encode(b.getvalue()).decode()
_BNAME={}
for o in list(items):
    if o['cat']=='Terrain (biome islands)':
        for pre,bid in ISLAND_TOY.items():
            if o['name'].startswith(pre): _BNAME[bid]=o['name'].split(' (')[0]
for bid,bname in _BNAME.items():
    pads=sorted(_glob.glob(_A+'islands/'+bid+'_pad*.png'))+[_A+'islands/'+ROCKS[bid]+'.png']
    items.append({'cat':'Terrain (biome islands)','name':bname+' · sea pads + rock islet','img':_grid_tile(pads),'style':'simple','pri':'done'})
for f in sorted(_glob.glob(_A+'props/*.png')):
    stem=_os.path.basename(f)[:-4]; bid=max((b for b in _BNAME if stem.startswith(b+'_')), key=len, default=stem.split('_')[0])
    items.append({'cat':'Island decorations','name':stem[len(bid)+1:].replace('_',' ').capitalize()+' ('+_BNAME.get(bid,bid.capitalize())+')','img':_asset_tile('props/'+stem),'style':'simple','pri':'done'})
for o in items:
    if o['cat']=='Island decorations' and o.get('style')=='code': o['pri']='medium'
_cre=[o for o in items if o['cat']=='Enemies' and o['name'] not in TOY_SHIP_LOOKS and o['name']!='Warding Seal']
_cdone=sum(o['pri']=='done' for o in _cre)
CAT['Enemies']=('high',f"{_cdone} of {len(_cre)} creatures are in the new simpler style (2026-10-11). Left: {', '.join(o['name'] for o in _cre if o['pri']!='done')} (batch G; the Warding Seal is with the bosses, A12). Long thin bodies read as squiggles at play size, so batch N redraws the curved ones straight and chunkier. Enemy ships follow the player hulls and are done.")
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
_STANDIN={'↩':'cannon (wants a stern chaser)','⚔':'cutlass (wants crossed swords)','🔧':'gear (wants a wrench)','⚫':'cannon (wants cannonballs)','✈':'wing','⛓':'chain link'}
_CANVAS={'♪','♫','🪶','🐂'}
# Plain text glyphs in the UI: each gets a drawn icon too.
_GLYPH={'★':'Text star: becomes U6a (gold star)','☆':'Text star: becomes U6b (empty star)','❚':'Pause bars: becomes D15','◀':'Becomes D16 (play arrow, mirrored)','▶':'Becomes D16 (play arrow)','←':'Becomes D14 (back arrow)','↻':'Becomes D17 (retry arrow)','›':'Becomes D16, small','▼':'Tutorial arrow: becomes D13 turned','▲':'Damage mark: part of the digit set (K37)'}
for e in emoji:
    k=e['e'].replace('\ufe0f','')
    if k in _MAP:
        im=_Im.open('/home/claude/the-shattered-reef/assets/icons/ui/'+_MAP[k]+'.png').convert('RGBA'); im.thumbnail((56,56))
        b=_io.BytesIO(); im.save(b,'PNG',optimize=True); e['img']='data:image/png;base64,'+_b64.b64encode(b.getvalue()).decode()
        e['state']='standin' if k in _STANDIN else 'done'
        if k in _STANDIN: e['note']='Stand-in: '+_STANDIN[k]
    else: e['state']='need'; e['note']=_GLYPH.get(k) or ('Canvas mark' if k in _CANVAS else '')
_rk={'need':0,'standin':1,'done':2}
emoji.sort(key=lambda e:(_rk[e['state']],-e['n']))
from collections import Counter
cnt=Counter(o['pri'] for o in items)
cnt['high']+=sum(e['state']=='need' for e in emoji); cnt['medium']+=sum(e['state']=='standin' for e in emoji)
print(Counter(o['style'] for o in items if o['cat'] in ('Player ships','Enemies','Bosses','Harbour buildings')))
print(cnt, len(items))
tpl=open('inv_template.html').read()
def _std_img():
    import base64, io
    from PIL import Image
    im = Image.open('/home/claude/the-shattered-reef/docs/art-reference/toy-simple/harbour-mockup.png').convert('RGB'); im.thumbnail((360, 540))
    b = io.BytesIO(); im.save(b, 'WEBP', quality=82)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
import datetime as _dt
def _base_img(n):
    import io, base64
    from PIL import Image
    im = Image.open('/home/claude/the-shattered-reef/docs/art-reference/baseline/'+n).convert('RGB'); im.thumbnail((760, 760))
    b = io.BytesIO(); im.save(b, 'WEBP', quality=80)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()
html=tpl.replace('__BUILD_DATE__', _dt.date.today().isoformat()).replace('__STD_IMG__', _std_img()).replace('__BASE_CS__', _base_img('style-creatures-ships.png')).replace('__BASE_W__', _base_img('style-world.png')).replace('__BASE_I__', _base_img('style-icons.png')).replace('__DATA__',json.dumps(items)).replace('__NOTES__',json.dumps(notes)).replace('__TYPES__',json.dumps([[a,b,c] for a,b,c in TYPES])).replace('__EMOJI__',json.dumps(emoji,ensure_ascii=False))
open('art-inventory.html','w').write(html)
print(len(html)//1024,'KB')
