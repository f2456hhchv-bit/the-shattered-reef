import json,sys
from PIL import Image
R='/home/claude/the-shattered-reef/assets/'
out=sys.argv[1]
frames=json.loads(sys.argv[2])
BG=(214,221,226,255)
def trim(im):
    im=im.convert('RGBA'); b=im.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
    return im.crop(b) if b else im
def fit(im,box):
    im=trim(im); s=min(box/im.width,box/im.height,3)
    return im.resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.LANCZOS)
def sheet(items,cell,cols,name,pad=14):
    rows=(len(items)+cols-1)//cols
    W=cols*(cell+pad)+pad; H=rows*(cell+pad)+pad
    c=Image.new('RGBA',(W,H),BG)
    for i,im in enumerate(items):
        im=fit(im,cell); x=pad+(i%cols)*(cell+pad)+(cell-im.width)//2; y=pad+(i//cols)*(cell+pad)+(cell-im.height)//2
        c.alpha_composite(im,(x,y))
    c.convert('RGB').save(out+'/'+name,optimize=True); print(name,W,H)
cre='deep_crawler ink_squid ice_golem gullswarm_harpy reef_shark jelly_bloom mirror_tortoise sea_serpent frost_narwhal black_gale drowned_admiral bloodfin_matriarch krakens_anchor frost_leviathan caldera_wyrm  mire_mother deep_mother dunemaw  warding_seal crystal_crab shard_crab prism_sprite sand_wyrm mirror_tortoise bone_vulture drift_jelly ink_squid bog_leech leech_swarm anglerfish jelly_bloom bayou_gator bog_witch deep_troll cave_bat stalker_eel ember_imp'.split(); cre=list(dict.fromkeys(cre))
items=[Image.open(R+'creatures/'+n+'.png') for n in cre]
for h,f in frames.items():
    a=Image.open(R+'ships/'+h+'.png'); x,y,w,hh=f[:4]; items.append(a.crop((x,y,x+w,y+hh)))
sheet(items,140,9,'style-creatures-ships.png')
import os
w=[Image.open(R+'buildings/'+n) for n in sorted(os.listdir(R+'buildings'))]
isl=['tropical','cliff_cove','glacial','shipwreck','volcanic','caverns','mangrove','abyss','bone_sands','crystal']
w+=[Image.open(R+'islands/'+n+'.png') for n in isl]
w+=[Image.open(R+'islands/'+n) for n in ['tropical_pad1.png','glacial_pad2.png','rock_grey.png','rock_purple.png']]
w+=[Image.open(R+'props/'+n) for n in sorted(os.listdir(R+'props'))]
w+=[Image.open(R+'pickups/'+n) for n in sorted(os.listdir(R+'pickups'))]
sheet(w,150,7,'style-world.png')
ic='anchor chest coin crown cutlass gem heart lock map scroll shield skull spyglass star trophy fire ice lightning gear target cannon magnet hourglass flag sound book wave tornado'.split()
it=[Image.open(R+'icons/ui/'+n+'.png') for n in ic]
for fx,n in [('explosion',12),('splash',12),('killburst',12)]:
    a=Image.open(R+'fx/'+fx+'.png'); cw=a.width//n; it.append(a.crop((cw*5,0,cw*6,a.height)))
it+=[Image.open(R+'fx/hitspark.png')]
sheet(it,110,8,'style-icons.png')
