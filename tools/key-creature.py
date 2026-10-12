# Keys a creature/boss image into assets/creatures/<name>.png (128px, real
# alpha). Handles real alpha, white or flat-colour backgrounds and painted
# checkerboards; keeps the largest shape, fills holes, soft 1px edge.
# usage: python3 tools/key-creature.py <name> <image> [<name> <image>]...
#        --size=<px> (default 128), --out=<dir> (default assets/creatures)
#        add --white=<min> to tune the white-background cut (default 200)
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','assets','creatures')
args=[a for a in sys.argv[1:] if not a.startswith('--')]
SIZE=int(next((a.split('=')[1] for a in sys.argv if a.startswith('--size=')),128))
OUT=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--out=')),OUT)
WHITE=int(next((a.split('=')[1] for a in sys.argv if a.startswith('--white=')),200))
def key(src):
    im=Image.open(src); a=np.asarray(im.convert('RGBA')).astype(float); rgb=a[...,:3]
    if im.mode=='RGBA' and a[...,3].min()<10:
        core=a[...,3]>235
    else:
        e=np.concatenate([rgb[:6].reshape(-1,3),rgb[-6:].reshape(-1,3),rgb[:,:6].reshape(-1,3),rgb[:,-6:].reshape(-1,3)])
        mn=rgb.min(-1); sat=rgb.max(-1)-mn; esat=np.median(e.max(-1)-e.min(-1)); emin=np.median(e.min(-1))
        if esat>120: near=np.sqrt(((rgb-np.median(e,axis=0))**2).sum(-1))<90      # magenta etc.
        elif emin>235: near=mn>WHITE                                                # white (+ light glow)
        else: near=(sat<22)&(mn>120)                                                # painted checkerboard
        lab,_=ndimage.label(near)
        edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
        core=~np.isin(lab,list(edge))
    core=ndimage.binary_opening(core,iterations=2)
    lab,n=ndimage.label(core); sizes=ndimage.sum(core,lab,range(1,n+1))
    core=lab==(1+int(np.argmax(sizes)))
    core=ndimage.binary_fill_holes(core); core=ndimage.binary_erosion(core,iterations=2)
    alpha=ndimage.gaussian_filter(core.astype(float),0.8)
    out=np.dstack([rgb,alpha*255]).astype(np.uint8)
    ys,xs=np.where(alpha>0.05); img=Image.fromarray(out).crop((xs.min(),ys.min(),xs.max()+1,ys.max()+1))
    s=SIZE/max(img.size); return img.resize((round(img.width*s),round(img.height*s)),Image.LANCZOS)
for i in range(0,len(args),2):
    img=key(args[i+1]); img.save(os.path.join(OUT,args[i]+'.png'),optimize=True); print(args[i],img.size)
