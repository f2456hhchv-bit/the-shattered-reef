# Keys a generated building image (on plain white) into a transparent
# 300px sprite in assets/buildings/. Needs Pillow, numpy, scipy.
import glob, numpy as np
from PIL import Image
from scipy import ndimage
import sys, os
OUT=os.path.join(os.path.dirname(__file__),'..','assets','buildings')+'/'
# usage: python3 tools/key-building.py <name> <generated image on white>
for name,src in [(sys.argv[1],sys.argv[2])]:
    im=np.asarray(Image.open(src).convert('RGB')).astype(float)
    bg=np.median(np.concatenate([im[:8].reshape(-1,3),im[-8:].reshape(-1,3),im[:,:8].reshape(-1,3),im[:,-8:].reshape(-1,3)]),axis=0)
    d=np.sqrt(((im-bg)**2).sum(-1))
    near=d<26
    lab,_=ndimage.label(near)
    edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bgmask=np.isin(lab,list(edge))
    if name=='shipyard':
        lab3,n3=ndimage.label(d<14)
        for i in range(1,n3+1):
            r=lab3==i
            if r.sum()>300: bgmask|=r
    fg=~bgmask
    fg=ndimage.binary_opening(fg,iterations=2)
    # keep largest components (> 0.2% area)
    lab2,n=ndimage.label(fg); sizes=ndimage.sum(fg,lab2,range(1,n+1))
    keep=np.isin(lab2,[i+1 for i,s in enumerate(sizes) if s>2000]); fg=keep
    # soft edge: alpha from distance to bg colour near the boundary
    dist=ndimage.distance_transform_edt(fg)
    a=np.clip(dist/2.0,0,1)
    edgeband=(dist>0)&(dist<3)
    a[edgeband]=np.minimum(a[edgeband],np.clip((d[edgeband]-10)/40,0,1))
    # un-premultiply white fringe
    rgb=im.copy()
    m=edgeband&(a>0.05)
    rgb[m]=np.clip((im[m]-bg*(1-a[m,None]))/a[m,None],0,255)
    out=np.dstack([rgb,a*255]).astype(np.uint8)
    ys,xs=np.where(a>0.05); x0,x1,y0,y1=xs.min(),xs.max()+1,ys.min(),ys.max()+1
    img=Image.fromarray(out).crop((x0,y0,x1,y1))
    W=300; s=W/max(img.size); img=img.resize((round(img.width*s),round(img.height*s)),Image.LANCZOS)
    img.save(OUT+name+'.png',optimize=True); print(name,img.size)
