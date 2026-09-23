"""Offline screenshot QA. Normalize framing, retain labeled crops and Lab metrics."""
import argparse,json
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFilter

p=argparse.ArgumentParser();p.add_argument('reference');p.add_argument('before');p.add_argument('after');p.add_argument('output');p.add_argument('--regions',default='.tmp/berlin-lab/regions03.json');a=p.parse_args()
out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
images=[Image.open(file).convert('RGB').resize((1672,941),Image.Resampling.LANCZOS) for file in (a.reference,a.before,a.after)]
labels=['Reference','Before','After'];regions=json.loads(Path(a.regions).read_text())
def lab(im):
    rgb=np.asarray(im,dtype=np.float64)/255
    linear=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    xyz=linear@np.array([[.4124,.2126,.0193],[.3576,.7152,.1192],[.1805,.0722,.9505]])/np.array([.95047,1,1.08883])
    f=np.where(xyz>.008856,np.cbrt(xyz),7.787*xyz+16/116)
    return np.stack([116*f[:,:,1]-16,500*(f[:,:,0]-f[:,:,1]),200*(f[:,:,1]-f[:,:,2])],axis=-1)
def stats(im):
    x=lab(im);l=x[:,:,0];rgb=np.asarray(im,dtype=np.float64);y=rgb@np.array([.2126,.7152,.0722])
    detail=np.abs(4*y[1:-1,1:-1]-y[1:-1,:-2]-y[1:-1,2:]-y[:-2,1:-1]-y[2:,1:-1]).mean()
    return {k:round(float(v),3) for k,v in {'L':l.mean(),'Lsd':l.std(),'p5':np.percentile(l,5),'p95':np.percentile(l,95),'a':x[:,:,1].mean(),'b':x[:,:,2].mean(),'detail':detail}.items()}
def panel(ims,path,blur=False):
    thumbs=[]
    for im in ims:
        scale=min(1,560/im.width,370/im.height);thumbs.append(im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS))
    w=sum(im.width for im in thumbs)+16*(len(thumbs)+1);h=max(im.height for im in thumbs)+54
    canvas=Image.new('RGB',(w,h),'#182a34');draw=ImageDraw.Draw(canvas);x=16
    for label,im in zip(labels,thumbs):
        draw.text((x,10),label,fill='white');canvas.paste(im.filter(ImageFilter.GaussianBlur(5)) if blur else im,(x,34));x+=im.width+16
    canvas.save(path)
panel(images,out/'comparison.png');panel(images,out/'squint.png',True)
report={'whole':dict(zip(labels,map(stats,images))),'regions':{}}
for r in regions:
    crops=[]
    for i,im in enumerate(images):
        x,y,w,h=r['ref' if i==0 else 'game'];crops.append(im.crop((x,y,x+w,y+h)))
    report['regions'][r['name']]=dict(zip(labels,map(stats,crops)))
    panel(crops,out/('crop-'+r['name']+'.png'))
(out/'metrics.json').write_text(json.dumps(report,indent=2))
lines=['| Region | Reference L | Before L | After L | Reference detail | Before detail | After detail |','|---|---:|---:|---:|---:|---:|---:|']
for name,values in report['regions'].items():lines.append('| '+name+' | '+' | '.join(str(values[label][metric]) for metric in ('L','detail') for label in labels)+' |')
(out/'metrics.md').write_text('\n'.join(lines)+'\n')
print(out/'metrics.md')
