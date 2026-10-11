# Splits a sheet of separate pieces (real alpha or a painted checkerboard)
# into <prefix><i>.png with real alpha, ordered by row then left to right.
# usage: python3 tools/split-sheet.py <sheet> <out-prefix>
import sys, numpy as np
from PIL import Image
from scipy import ndimage
src,outp=sys.argv[1],sys.argv[2]
im=Image.open(src); a=np.asarray(im.convert('RGBA')).astype(float); rgb=a[...,:3]
if im.mode=='RGBA' and a[...,3].min()<10: core=a[...,3]>235
else:
    mn=rgb.min(-1); sat=rgb.max(-1)-mn; v=rgb.mean(-1)
    c=rgb[:60,:300].reshape(-1,3).mean(1); lo,hi=np.median(c[c<230]),np.median(c[c>=230])
    near=(sat<=5)&(v>=lo-8)          # painted checkerboard: two light greys, no colour
    lab,_=ndimage.label(near); edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    core=~np.isin(lab,list(edge))
    core=ndimage.binary_opening(core,iterations=5)
core=ndimage.binary_opening(core,iterations=3)
lab,n=ndimage.label(ndimage.binary_dilation(core,iterations=6))
sizes=ndimage.sum(core,lab,range(1,n+1)); tot=core.size
keep=[i+1 for i,s in enumerate(sizes) if s>tot*0.01]
objs=ndimage.find_objects(lab)
pieces=[]
for k in keep:
    sl=objs[k-1]; m=(lab[sl]==k)&core[sl]
    m=ndimage.binary_fill_holes(m); m=ndimage.binary_erosion(m,iterations=2)
    al=ndimage.gaussian_filter(m.astype(float),0.8)
    pieces.append((sl[0].start,sl[1].start,np.dstack([rgb[sl],al*255]).astype(np.uint8)))
H=a.shape[0]
pieces.sort(key=lambda p:(round(p[0]/(H*0.35)),p[1]))
for i,(y,x,arr) in enumerate(pieces,1):
    Image.fromarray(arr).save(f'{outp}{i}.png'); print(f'{outp}{i}.png',arr.shape[1],arr.shape[0])
